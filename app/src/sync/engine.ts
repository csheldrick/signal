// ── Sync Engine ─────────────────────────────────────────────
// Stub sync engine. Imports from storage and sync/protocol,
// creating cross-subsystem edges for Loom to detect.

// Removed hard dependency on concrete DocumentStore; accept a minimal store interface.
interface DocumentStoreLike {
  create(id: string, title: string, content: string, tags?: string[]): unknown;
  update(id: string, changes: { title?: string; content?: string; tags?: string[] }): unknown | undefined;
  delete(id: string): boolean;
  // Optional link operation to create logical document links. Not all stores may implement it.
  link?(sourceId: string, targetId: string, kind?: string): unknown;
  // Optional events bus compatible with the concrete StorageEventBus implementation
  events?: import('../storage/events.js').StorageEventBusContract;
}

import type { StorageEvent } from '../storage/event-types.js';
import type { SyncMessage, VectorClock } from './protocol.js';
import { mergeClocks } from './protocol.js';
import { telemetry } from './telemetry.js';
import { isValidDocumentSnapshot } from '../core/types.js';
import { getSyncEngineFromStore, setSyncEngineOnStore } from '../storage/syncEngineRegistry.js';

export class SyncEngine {
  private readonly maxOutbound: number;
  private clock: VectorClock = {};
  private readonly peerId: string;
  private outbound: SyncMessage[] = [];
  // Incrementing counter for message id uniqueness without relying on Math.random();
  // keeps the engine stateless from a persistence PoV but improves determinism.
  private messageCounter: number = 0;
  // Registry of SyncEngine instances keyed by the concrete store object to detect accidental duplicates.

  /**
   * Canonical factory to obtain a SyncEngine bound to a concrete store and peerId.
   * Preference order:
   *  1) If the store exposes getSyncEngine/setSyncEngine, use that API to get/create the engine.
   *  2) No fallback: rely solely on the canonical store-backed registry.
   * This centralizes registration and avoids silent duplicate engines.
   */
  static getOrCreate(store: DocumentStoreLike, peerId: string): SyncEngine {
    // Prefer returning an already-registered engine to avoid duplicates.
    let fromStore: any;
    try {
      fromStore = getSyncEngineFromStore(store as any);
      if (fromStore !== undefined && fromStore) return fromStore as SyncEngine;
    } catch (e) {
      // Propagate registry read errors so callers become aware of misconfiguration
      // rather than silently proceeding and creating duplicate engines.
      throw e instanceof Error ? e : new Error(String(e));
    }
    // If a store exposes a getSyncEngine() that returns a proxy wrapper rather
    // than the concrete SyncEngine, prefer to re-use it to avoid duplicate
    // instances; but guard against self-referential wrappers by checking for
    // a getClock method that matches expectations.


    // Create a new engine but do not bypass registration logic; attempt to
    // register it and surface any conflicts to the caller so they can
    // address duplicate-registration issues instead of silently proceeding.
    const created = new SyncEngine(store, peerId, { internal: true });

    // Try to register the created engine. If registration fails due to a
    // conflicting engine, attempt to read the canonical engine and return it
    // (fail-fast behavior). Do not silently swallow registry errors as that
    // leads to duplicated engine instances and duplicate subscriptions.
    try {
      setSyncEngineOnStore(store as any, created);
      // Re-read to ensure the engine we registered is visible via the getter
      let rechecked: any;
      try { rechecked = getSyncEngineFromStore(store as any); } catch (err) { throw err; }
      if (rechecked !== undefined && rechecked !== created) {
        // Another engine beat us to registration — surface this as an error so
        // callers can decide how to proceed instead of creating a duplicate.
        try { console.warn('SyncEngine.getOrCreate: another engine registered concurrently; returning canonical engine'); } catch (_) {}
        return rechecked as SyncEngine;
      }
      return created;
    } catch (e) {
      // If a conflict occurred, prefer returning the canonical engine if it
      // exists; otherwise rethrow to surface unexpected registry failures.
      try {
        const existing = getSyncEngineFromStore(store as any);
        if (existing !== undefined && existing) return existing as SyncEngine;
      } catch (_) {
        // ignore read failures here — we'll rethrow the original error below
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  constructor(
    private readonly store: DocumentStoreLike,
    peerId: string,
    options?: { internal?: boolean; maxOutbound?: number },
  ) {
    this.maxOutbound = options?.maxOutbound ?? 500; // hard cap to avoid unbounded outbound growth

    this.peerId = peerId;
    this.clock[peerId] = 0;

    // Attempt to seed the engine clock with any persisted clocks published
    // on the underlying store so that vector-clock based decisions remain
    // deterministic after restarts. This is best-effort and must not throw.
    try {
      try {
        const maybeGet = (this.store as any).getPersistedClocks;
        if (typeof maybeGet === 'function') {
          const persisted = maybeGet.call(this.store);
          if (persisted && typeof persisted === 'object') {
            this.clock = mergeClocks(this.clock, persisted as VectorClock);
          }
        }
      } catch (_) {
        // ignore
      }
    } catch (_) {}

    // When constructed directly (non-internal), perform duplicate detection
    // and registration. For internally-constructed instances (e.g. by the
    // getOrCreate factory) the factory handles registration to avoid races.
    if (!options?.internal) {
      // Duplicate detection: prefer failing early so callers must use the
      // canonical getOrCreate factory which centralizes registration.
      try {
        const existing = getSyncEngineFromStore(this.store as any);
        if (existing !== undefined && existing && existing !== this) {
          throw new Error('SyncEngine: duplicate engine already registered on store');
        }
      } catch (e) {
        // Propagate registry errors to the caller so config issues are visible.
        throw e;
      }

      // Register using the canonical registry helper. If registration fails
      // due to a conflicting engine, surface the error rather than silently
      // proceeding and creating duplicate subscriptions.
      try {
        setSyncEngineOnStore(this.store as any, this);
      } catch (e) {
        // Surface registry write failures to help callers detect misconfiguration
        // — do not silently ignore; rethrow after logging.
        try { console.warn('SyncEngine: instance registry unavailable (write)', e); } catch (_) {}
        throw e instanceof Error ? e : new Error(String(e));
      }
    }

    // NOTE: SyncEngine no longer subscribes to store events directly.
    // Subscription and forwarding of StorageEvent → engine.generateOutbound
    // is the responsibility of SyncManager to centralize event handling and
    // avoid duplicate subscriptions across multiple engine instances.
    // This keeps the engine focused on transforming events to SyncMessages
    // and maintaining vector clocks rather than managing event listeners.
  }

  applyRemoteChange(message: SyncMessage): boolean {
    this.clock = mergeClocks(this.clock, message.clock);

    switch (message.operation) {
      case 'create': {
        const payload = message.payload as { title: string; content: string; tags?: string[] };
        this.store.create(message.documentId, payload.title, payload.content, payload.tags ?? []);
        return true;
      }
      case 'update': {
        const changes = message.payload as { title?: string; content?: string; tags?: string[] };
        return this.store.update(message.documentId, changes) !== undefined;
      }
      case 'delete':
        return this.store.delete(message.documentId);
      case 'link': {
        // Attempt to apply a logical link. Many store implementations may
        // not support an explicit link API; call it if present and return
        // a boolean-ish success indicator. Be defensive and avoid throwing
        // so that unsupported operations degrade gracefully.
        try {
          const payload = message.payload as { link?: any } | undefined;
          const link = payload && typeof payload === 'object' ? payload.link ?? payload : undefined;
          const storeAny: any = this.store;
          if (typeof storeAny.link === 'function') {
            if (link && typeof link === 'object') {
              const sourceId = (link as any).sourceId ?? message.documentId;
              const targetId = (link as any).targetId ?? message.documentId;
              const kind = (link as any).kind ?? undefined;
              try {
                const res = storeAny.link(sourceId, targetId, kind);
                return res !== undefined ? !!res : true;
              } catch (_) {
                // If calling with object form is supported, try that too.
              }
              try {
                const res2 = storeAny.link(link);
                return res2 !== undefined ? !!res2 : true;
              } catch (_) {
                return false;
              }
            }

            // Fallback: attempt to call link with the document id as a single arg
            try {
              const res3 = storeAny.link(message.documentId);
              return res3 !== undefined ? !!res3 : true;
            } catch (_) {
              return false;
            }
          }
        } catch (_) {
          /* swallow and fall through */
        }
        return false;
      }
      default:
        return false;
    }
  }

  generateOutbound(event: StorageEvent): SyncMessage | undefined {
    this.clock[this.peerId] = (this.clock[this.peerId] ?? 0) + 1;

    let message: SyncMessage | undefined;

    // Defensive validation: drop created/updated events that carry malformed snapshots.
    if (event.type === 'created' || event.type === 'updated') {
      const snap = (event.type === 'created') ? (event as any).document : (event as any).current;
      if (!isValidDocumentSnapshot(snap)) {
        try { console.warn('SyncEngine: ignoring storage event with invalid document snapshot', event); } catch (_) {}
        return undefined;
      }
    }

    // Helper to produce a compact, stable-ish id when the engine must generate one.
    // The id includes the peer, document grouping and a timestamp+random suffix to
    // avoid accidental collisions while remaining stable for the immediate pipeline.
    const makeMessageId = (docId: string) => `${this.peerId}:${docId}:${Date.now()}:${(this.messageCounter++).toString(36)}`;

    switch (event.type) {
      case 'created': {
        const docId = (event as any).document?.id ?? '';
        message = ({
          messageId: makeMessageId(docId),
          operation: 'create',
          documentId: docId,
          payload: {
            title: (event as any).document.title,
            content: (event as any).document.content,
            tags: (event as any).document.tags,
          },
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        } as any) as SyncMessage;
        break;
      }
      case 'updated': {
        const docId = (event as any).documentId ?? '';
        message = ({
          messageId: makeMessageId(docId),
          operation: 'update',
          documentId: docId,
          payload: {
            title: (event as any).current.title,
            content: (event as any).current.content,
            tags: (event as any).current.tags,
          },
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        } as any) as SyncMessage;
        break;
      }
      case 'linked': {
        // Map storage 'linked' events to a logical 'link' SyncMessage. Prefer
        // targetId then sourceId as the grouping document id.
        const link = (event as any).link || {};
        const docId = link.targetId ?? link.sourceId ?? link.documentId ?? '';
        message = ({
          messageId: makeMessageId(docId),
          operation: 'link',
          documentId: docId,
          payload: {
            link: {
              ...link,
            },
          },
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        } as any) as SyncMessage;
        break;
      }
      case 'deleted': {
        const docId = (event as any).documentId ?? '';
        message = ({
          messageId: makeMessageId(docId),
          operation: 'delete',
          documentId: docId,
          payload: null,
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        } as any) as SyncMessage;
        break;
      }
    }

    if (message) {
      try { telemetry.emit('engine_outbound_update', { operation: message.operation, documentId: message.documentId, outboundLength: this.outbound.length, clockSize: Object.keys(this.clock).length, timestamp: Date.now() }); } catch (_) {}
      // Persistence of outbound messages is a responsibility of the SyncManager
      // or an explicitly provided OfflineSyncQueue. The engine must avoid
      // durably persisting outbound messages to prevent duplicated writes and
      // conflicting ordering when both engine and manager attempt persistence.
      // Keep the engine stateless with respect to durable outbound logs.
      // No-op: durable buffering should be handled by the manager layer.

      // Coalesce outbound messages per-document to avoid noisy churn. Behavior:
      // - delete takes precedence and will replace earlier create/update entries.
      // - create supersedes prior entries for the same document.
      // - update will merge into an existing create/update when present; if a
      //   delete is pending we ignore the update (delete wins).
      const docId = message.documentId;
      const idx = this.outbound.findIndex(m => m.documentId === docId);

      if (message.operation === 'delete') {
        // Remove any prior messages for this doc and append delete.
        if (idx !== -1) this.outbound.splice(idx, 1);
        // Ensure we have room in the outbound buffer
        if (this.outbound.length >= this.maxOutbound) {
          try { telemetry.emit('engine_outbound_overflow', { action: 'drop_oldest', outboundLength: this.outbound.length, maxOutbound: this.maxOutbound, timestamp: Date.now() }); } catch (_) {}
          this.outbound.shift();
        }
        this.outbound.push(message);
      } else if (message.operation === 'create') {
        // Create supersedes prior messages for same doc.
        if (idx !== -1) this.outbound.splice(idx, 1);
        if (this.outbound.length >= this.maxOutbound) {
          try { telemetry.emit('engine_outbound_overflow', { action: 'drop_oldest', outboundLength: this.outbound.length, maxOutbound: this.maxOutbound, timestamp: Date.now() }); } catch (_) {}
          this.outbound.shift();
        }
        this.outbound.push(message);
      } else if (message.operation === 'update') {
        if (idx !== -1) {
          const existing = this.outbound[idx];
          if (existing.operation === 'create' || existing.operation === 'update') {
            // Replace existing create/update with the newest update payload
            // and metadata (clock/timestamp/peerId) to reflect latest state.
            this.outbound[idx] = {
              ...existing,
              payload: message.payload,
              clock: message.clock,
              timestamp: message.timestamp,
              peerId: message.peerId,
            };
          } else {
            // existing is delete — keep delete, ignore update
          }
        } else {
          if (this.outbound.length >= this.maxOutbound) {
            try { telemetry.emit('engine_outbound_overflow', { action: 'drop_oldest', outboundLength: this.outbound.length, maxOutbound: this.maxOutbound, timestamp: Date.now() }); } catch (_) {}
            this.outbound.shift();
          }
          this.outbound.push(message);
        }
      }
    }

    return message;
  }

  drainOutbound(): SyncMessage[] {
    const messages = [...this.outbound];
    this.outbound = [];
    return messages;
  }

  getClock(): VectorClock {
    return { ...this.clock };
  }

  /**
   * Best-effort clock compaction hook. Accepts a compactor function (e.g.
   * provided by SyncManager.snapshotService.compactClock) and replaces the
   * engine's internal clock with a compacted, validated clock. Never throws.
   */
  compactClock(compactor: (clock: VectorClock) => VectorClock): void {
    try {
      if (typeof compactor !== 'function') return;
      const candidate = compactor({ ...this.clock }) || {};
      const normalized: VectorClock = {};
      for (const [k, v] of Object.entries(candidate)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) normalized[k] = n;
      }
      this.clock = normalized;

      // Best-effort persist of compacted clocks onto the store so that
      // subsequent process restarts can restore causally-relevant state.
      try {
        const maybeSet = (this.store as any).setPersistedClocks;
        if (typeof maybeSet === 'function') {
          try { maybeSet.call(this.store, { ...this.clock }); } catch (_) { /* swallow */ }
        }
      } catch (_) { /* swallow */ }
    } catch (_) {
      // swallow — compaction is best-effort
    }
  }
}
