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

import type { StorageEvent } from '../storage/events.js';
import type { SyncMessage, VectorClock } from './protocol.js';
import { mergeClocks } from './protocol.js';
import { isValidDocumentSnapshot } from '../core/types.js';
import { getSyncEngineFromStore, setSyncEngineOnStore } from '../storage/syncEngineRegistry.js';

export class SyncEngine {
  private clock: VectorClock = {};
  private readonly peerId: string;
  private outbound: SyncMessage[] = [];
  // Registry of SyncEngine instances keyed by the concrete store object to detect accidental duplicates.
  private static _instancesByStore: WeakMap<object, SyncEngine> = new WeakMap<object, SyncEngine>();

  /**
   * Canonical factory to obtain a SyncEngine bound to a concrete store and peerId.
   * Preference order:
   *  1) If the store exposes getSyncEngine/setSyncEngine, use that API to get/create the engine.
   *  2) Fallback to a WeakMap keyed by the concrete store object.
   * This centralizes registration and avoids silent duplicate engines.
   */
  static getOrCreate(store: DocumentStoreLike, peerId: string): SyncEngine {
    try {
      const fromStore = getSyncEngineFromStore(store as any);
      if (fromStore && fromStore !== undefined) return fromStore;
      const created = new SyncEngine(store, peerId, { internal: true });
      try { setSyncEngineOnStore(store as any, created); } catch (_) {}
      return created;
    } catch (_) {}

    // Fallback to WeakMap registry
    const keyObj = (typeof store === 'object' && store !== null) ? (store as unknown as object) : undefined;
    if (!keyObj) return new SyncEngine(store, peerId, { internal: true });

    try {
      const existing = SyncEngine._instancesByStore.get(keyObj);
      if (existing) return existing;
    } catch (_) {}

    const created = new SyncEngine(store, peerId, { internal: true });
    try { SyncEngine._instancesByStore.set(keyObj, created); } catch (_) {}
    return created;
  }

  constructor(
    private readonly store: DocumentStoreLike,
    peerId: string,
    options?: { internal?: boolean },
  ) {
    this.peerId = peerId;
    this.clock[peerId] = 0;

    // If constructed directly (without options.internal), perform duplicate
    // detection and fail fast so callers discover misconfiguration early.
    if (!options?.internal) {
      try {
        const existing = getSyncEngineFromStore(this.store as any);
        if (existing && existing !== undefined) {
          throw new Error('SyncEngine: duplicate engine already registered on store');
        } else {
          const keyObj = (typeof this.store === 'object' && this.store !== null) ? (this.store as unknown as object) : undefined;
          if (keyObj) {
            try {
              const existing2 = SyncEngine._instancesByStore.get(keyObj);
              if (existing2 && existing2 !== undefined) {
                throw new Error('SyncEngine: duplicate engine already registered for this store');
              }
            } catch (e) {
              // Surface registry read errors so callers can migrate to getOrCreate
              throw e;
            }
          }
        }
      } catch (e) {
        // Fail fast on duplicates / registry errors so callers can migrate to getOrCreate
        throw e;
      }
    }

    // Register only when constructed directly (non-internal). The factory
    // (getOrCreate) will perform registration itself to avoid double-setting.
    if (!options?.internal) {
      try {
        try { setSyncEngineOnStore(this.store as any, this); } catch (e) {
          const keyObj = (typeof this.store === 'object' && this.store !== null) ? (this.store as unknown as object) : undefined;
          if (keyObj) {
            try { SyncEngine._instancesByStore.set(keyObj, this); } catch (e2) { console.warn('SyncEngine: instance registry unavailable (write)', e2); }
          } else {
            console.warn('SyncEngine: instance registry unavailable (write)', e);
          }
        }
      } catch (e) {
        console.warn('SyncEngine: instance registry unavailable (write)', e);
      }
    }

    // Subscribe to store events when available. This subscription is orthogonal
    // to registration but is suppressed by earlier duplicate-detection via
    // throwing (we want callers to fail fast instead of quietly running).
    try {
      const bus = this.store?.events;
      if (bus && typeof bus.on === 'function') {
        const buffer: StorageEvent[] = [];
        const MAX_BUFFERED_EVENTS = 500;
        let scheduled = false;
        const flush = () => {
          if (scheduled) return;
          scheduled = true;
          Promise.resolve().then(() => {
            scheduled = false;
            const toProcess = buffer.splice(0);
            for (const ev of toProcess) {
              try {
                this.generateOutbound(ev);
              } catch (err) {
                try { console.error('SyncEngine: error handling storage event', err); } catch (_) { /* swallow */ }
              }
            }
          }).catch(err => { try { console.error('SyncEngine: flush error', err); } catch (_) {} });
        };

        const pushAndFlush = (ev: StorageEvent) => {
          try {
            if (buffer.length >= MAX_BUFFERED_EVENTS) buffer.shift();
            buffer.push(ev);
            flush();
          } catch (err) {
            try { console.error('SyncEngine: error buffering storage event', err); } catch (_) { /* swallow */ }
          }
        };

        try {
          if (typeof bus.onAsync === 'function') {
            try { bus.onAsync('created', pushAndFlush); } catch (_) {}
            try { bus.onAsync('updated', pushAndFlush); } catch (_) {}
            try { bus.onAsync('deleted', pushAndFlush); } catch (_) {}
            try { bus.onAsync('linked', pushAndFlush); } catch (_) {}
          } else {
            try { bus.on('created', pushAndFlush); } catch (_) {}
            try { bus.on('updated', pushAndFlush); } catch (_) {}
            try { bus.on('deleted', pushAndFlush); } catch (_) {}
            try { bus.on('linked', pushAndFlush); } catch (_) {}
          }
        } catch (_) {};

      }
    } catch (err) {
      console.warn('SyncEngine: failed to subscribe to store events', err);
    }
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
    const makeMessageId = (docId: string) => `${this.peerId}:${docId}:${Date.now()}:${Math.floor(Math.random() * 1e9).toString(36)}`;

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
        this.outbound.push(message);
      } else if (message.operation === 'create') {
        // Create supersedes prior messages for same doc.
        if (idx !== -1) this.outbound.splice(idx, 1);
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
    } catch (_) {
      // swallow — compaction is best-effort
    }
  }
}
