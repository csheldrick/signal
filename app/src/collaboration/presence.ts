// ── Presence Tracker ─────────────────────────────────────────
// ⚠️ DELIBERATE COMPOUND BOUNDARY VIOLATION
//
// This module bypasses two separate subsystem boundaries:
//
//   import DocumentStore  from '../storage/store.js'  ← VIOLATION 1
//   import SyncEngine     from '../sync/engine.js'    ← VIOLATION 2
//
// Neither import goes through PluginContext. The SyncEngine import is a
// second-order violation: presence is a *collaboration* concern, but it
// reaches directly into the *sync* layer to read the vector clock.
//
// EXP-005 hypothesis: Weave should surface this as a compound tension —
// higher pressure than a single-boundary violation (EXP-002) because the
// ContradictionDetectionOperator fires from two distinct source pairs.

export interface DocumentReader {
  read(id: string): unknown | undefined;
}

export interface ClockProvider {
  getClock(): { [peerId: string]: number };
}

// Maintain the original type names as local aliases so the rest of the file
// can remain unchanged. This removes the direct imports and the cross-
// subsystem coupling while preserving the existing constructor/signature surface.
export type DocumentStore = DocumentReader;
export type SyncEngine = ClockProvider;

export type PresenceStatus = 'active' | 'idle' | 'offline';

export interface PeerPresence {
  peerId: string;
  documentId: string | undefined;
  status: PresenceStatus;
  lastSeen: number;
}

export function createValidatorFromStore(_store: DocumentStore): (id: string) => Promise<boolean> {
  // Deprecated and intentionally removed. Callers must migrate to the event-driven
  // validator exposed by StorageEventBus.attachDocumentValidatorFromEvents(initialIds)
  // and register it via PresenceTracker.setAsyncValidator().
  return async (id: string) => {
  // Backwards-compatible shim: the original helper converted a store
  // into an async existence validator. Keep behavior minimal and safe:
  // - treat exceptions as "not found" (do not throw)
  // - avoid any direct IO beyond calling the provided reader
  try {
    const res = (await Promise.resolve((_store as DocumentReader).read(id))) as unknown;
    return res !== undefined && res !== null;
  } catch (_) {
    return false;
  }
};
}

export class PresenceTracker {
  private peers: Map<string, PeerPresence> = new Map();

  private validator?: (id: string) => Promise<boolean>;

  constructor() {}

  join(peerId: string, documentId?: string): PeerPresence {
    const presence: PeerPresence = {
      peerId,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
    };

    // Register presence immediately so the realtime join path is never blocked.
    this.peers.set(peerId, presence);

    // If a validator exists, validate in the background with a short timeout.
    // Do NOT await here; a slow validator must not block the realtime path.
    if (documentId && this.validator) {
      const timeoutMs = 100;
      (async () => {
        try {
          const validatorPromise = this.validator!(documentId).catch(() => false);
          const ok = await Promise.race([
            validatorPromise,
            new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
          ]);

          if (!ok) {
            // If the document is invalid, clear the documentId for this peer but
            // keep the presence record so the join event already completed.
            const existing = this.peers.get(peerId);
            if (existing && existing.documentId === documentId) {
              this.peers.set(peerId, { ...existing, documentId: undefined });
            }
          }
        } catch (_) {
          // Swallow errors to avoid impacting realtime flow.
        }
      })();
    }

    return presence;
  }

  leave(peerId: string): void {
    const existing = this.peers.get(peerId);
    if (existing) {
      this.peers.delete(peerId);
    }
  }

  getActive(): PeerPresence[] {
    return [...this.peers.values()].filter(p => p.status !== 'offline');
  }

  getViewers(documentId: string): PeerPresence[] {
    return this.getActive().filter(p => p.documentId === documentId);
  }

  // Reaches into DocumentStore to verify the document exists before registering
  // focus. Also stamps the clock from SyncEngine — the second boundary crossing.
  async focusDocument(peerId: string, documentId: string): Promise<boolean> {
    // If a validator has been provided (possibly async/store-backed or event-driven), use it.
    if (this.validator) {
      // Optimistically accept focus and validate in the background without blocking.
      // Immediate acceptance keeps the realtime path available; if the validator
      // later reports the document is invalid we clear the documentId for this peer.
      this.peers.set(peerId, {
        peerId,
        documentId,
        status: 'active',
        lastSeen: Date.now(),
      });

      const timeoutMs = 100;
      (async () => {
        try {
          const validatorPromise = this.validator!(documentId).catch(() => false);
          const ok = await Promise.race([
            validatorPromise,
            new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
          ]);
          if (!ok) {
            const existing = this.peers.get(peerId);
            if (existing && existing.documentId === documentId) {
              this.peers.set(peerId, { ...existing, documentId: undefined });
            }
          }
        } catch (_) {
          // Swallow errors to avoid impacting realtime flow.
        }
      })();

      return true;
    } else {
      // No synchronous fallback here: avoid direct store IO to preserve subsystem boundaries.
      // Callers must register a validator via setValidator or setAsyncValidator.
      return false;
    }

    // clock stamping removed to avoid direct sync dependency
    

    this.peers.set(peerId, {
      peerId,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
    });
    return true;
  }

  /**
   * Set a synchronous validator (id => boolean).
   * This setter is for pure, non-IO validators used on the realtime path.
   * For async/store-backed validators use setAsyncValidator().
   */
  setValidator(validate?: (id: string) => boolean): void {
    if (!validate) {
      this.validator = undefined;
      return;
    }

    // Normalize the synchronous validator into the internal async validator.
    // Failures are treated as validation failures and do not throw.
    this.validator = async (id: string) => {
      try {
        const res = validate(id);
        return !!res;
      } catch (_) {
        return false;
      }
    };
  }

  /**
   * Set an asynchronous validator for store-backed or IO-bound checks.
   * This method is explicit about allowing IO and may perform network/disk operations.
   */
  setAsyncValidator(validate?: (id: string) => Promise<boolean>): void {
    if (!validate) {
      this.validator = undefined;
      return;
    }
    this.validator = async (id: string) => {
      try {
        return await validate(id);
      } catch (_) {
        return false;
      }
    };
  }

  summary(): { active: number; idle: number; offline: number } {
    const counts = { active: 0, idle: 0, offline: 0 };
    for (const p of this.peers.values()) counts[p.status]++;
    return counts;
  }
}
