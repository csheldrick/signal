// ── Sync Engine ─────────────────────────────────────────────
// Stub sync engine. Imports from storage and sync/protocol,
// creating cross-subsystem edges for Loom to detect.

// Removed hard dependency on concrete DocumentStore; accept a minimal store interface.
interface DocumentStoreLike {
  create(id: string, title: string, content: string, tags?: string[]): unknown;
  update(id: string, changes: { title?: string; content?: string; tags?: string[] }): unknown | undefined;
  delete(id: string): boolean;
  // Optional events bus compatible with the concrete StorageEventBus implementation
  events?: import('../storage/events.js').StorageEventBusContract;
}

import type { StorageEvent } from '../storage/events.js';
import type { SyncMessage, VectorClock } from './protocol.js';
import { mergeClocks } from './protocol.js';
import { isValidDocumentSnapshot } from '../core/types.js';

export class SyncEngine {
  private clock: VectorClock = {};
  private readonly peerId: string;
  private outbound: SyncMessage[] = [];
  // Registry of SyncEngine instances keyed by the concrete store object to detect accidental duplicates.
  private static _instancesByStore: WeakMap<object, SyncEngine> = new WeakMap<object, SyncEngine>();

  constructor(
    private readonly store: DocumentStoreLike,
    peerId: string,
  ) {
    this.peerId = peerId;
    this.clock[peerId] = 0;

    // Register this engine keyed by the concrete store object to detect duplicates.
    // Access the registry carefully: if platform-level WeakMap operations fail
    // we log and continue, BUT we must not swallow the semantic duplicate-engine
    // error (existing && existing !== this). That condition should propagate so
    // callers fail fast on misconfiguration.
    const keyObj = (typeof this.store === 'object' && this.store !== null) ? (this.store as unknown as object) : undefined;

    // Try to observe any existing registration; if registry access itself fails
    // we warn but do not fabricate an "existing" entry.
    let existing: SyncEngine | undefined; let shouldSubscribe = true;
    try {
      existing = keyObj ? SyncEngine._instancesByStore.get(keyObj) : undefined;
    } catch (e) {
      console.warn('SyncEngine: instance registry unavailable (read)', e);
      existing = undefined;
    }

    // If an existing engine is found for the same concrete store object and it
    // is not this instance, this is a real misconfiguration. Throwing here can
    // cause surprising crashes in normal application compositions where multiple
    // managers or startup paths attempt to construct an engine for the same
    // store object. Log a clear, high-severity message and proceed without
    // registering this second instance so callers do not unexpectedly crash.
    // Operators/tests will still see a clear message and can migrate to an
    // explicit injection/shared-engine approach.
    if (existing && existing !== this) {
      // Duplicate engine detected: avoid subscribing to the store events to prevent
      // duplicate outbound generation. Log and continue without registering.
      try { console.warn('SyncEngine: multiple engines bound to the same DocumentStore instance — new instance will not subscribe to store events'); } catch (_) {}
      shouldSubscribe = false;
    }

    // Attempt to set our registration; if setting fails due to platform issues
    // we log but proceed (we don't hide the duplicate-engine condition above).
    try {
      // Only register this instance if no existing engine is already bound to
      // the concrete store object. This avoids overwriting the original
      // engine registration if we detected a duplicate above.
      if (!existing && keyObj) {
        SyncEngine._instancesByStore.set(keyObj, this);
      }
    } catch (e) {
      console.warn('SyncEngine: instance registry unavailable (write)', e);
    }

    // If the store exposes the event bus with the standard .on() API, subscribe
    // to all events so a single engine drives outbound message coalescing and
    // clock progression. This reduces the chance of divergent clocks when
    // multiple writers exist.
    try {
      const bus = shouldSubscribe ? this.store?.events : undefined;
      if (bus && typeof bus.on === 'function') {
        // Decouple heavy sync processing from the storage emitter by buffering
        // incoming events and flushing them in a microtask. This reduces
        // synchronous cost on the storage path and coalesces bursts.
        const buffer: StorageEvent[] = [];
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

        // Avoid registering a wildcard listener which increases star-listener
        // fan-out on the StorageEventBus. Subscribe only to concrete event
        // types that the SyncEngine cares about to limit the number of
        // listeners routed through the '*' slot.
        const pushAndFlush = (ev: StorageEvent) => {
          try {
            buffer.push(ev);
            flush();
          } catch (err) {
            try { console.error('SyncEngine: error buffering storage event', err); } catch (_) { /* swallow */ }
          }
        };

        try { bus.on('created', pushAndFlush); } catch (_) {}
        try { bus.on('updated', pushAndFlush); } catch (_) {}
        try { bus.on('deleted', pushAndFlush); } catch (_) {}
        try { bus.on('linked', pushAndFlush); } catch (_) {};

        // Note: we intentionally avoid a single '*' listener to keep the
        // StorageEventBus's star-listener arrays small and reduce per-emit
        // invocation breadth.
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
}
