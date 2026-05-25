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
    try {
      const key = (this.store as unknown) as object;
      const existing = SyncEngine._instancesByStore.get(key);
      if (existing && existing !== this) {
        // Throw to make misconfiguration explicit: multiple engines for same store
        // lead to divergent vector clocks and conflict-resolution issues.
        throw new Error('SyncEngine: multiple engines bound to the same DocumentStore instance; this may cause divergent VectorClock histories.');
      }
      SyncEngine._instancesByStore.set(key, this);
    } catch (e) {
      // If registry fails for any reason, log and continue — this is defensive.
      console.warn('SyncEngine: instance registry unavailable', e);
    }

    // If the store exposes the event bus with the standard .on() API, subscribe
    // to all events so a single engine drives outbound message coalescing and
    // clock progression. This reduces the chance of divergent clocks when
    // multiple writers exist.
    try {
      const bus = this.store?.events;
      if (bus && typeof bus.on === 'function') {
        bus.on('*', (e: StorageEvent) => {
          try {
            this.generateOutbound(e);
          } catch (err) {
            // Keep listener resilient
            console.error('SyncEngine: error handling storage event', err);
          }
        });
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

    switch (event.type) {
      case 'created':
        message = {
          operation: 'create',
          documentId: event.document.id,
          payload: {
            title: event.document.title,
            content: event.document.content,
            tags: event.document.tags,
          },
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        };
        break;
      case 'updated':
        message = {
          operation: 'update',
          documentId: event.documentId,
          payload: {
            title: event.current.title,
            content: event.current.content,
            tags: event.current.tags,
          },
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        };
        break;
      case 'deleted':
        message = {
          operation: 'delete',
          documentId: event.documentId,
          payload: null,
          clock: { ...this.clock },
          peerId: this.peerId,
          timestamp: event.timestamp,
        };
        break;
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
