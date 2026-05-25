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

export function createValidatorFromStore(store: DocumentStore): (id: string) => Promise<boolean> {
  // Backwards-compatible helper: callers that previously relied on
  // createValidatorFromStore can use this to obtain an async validator
  // without reaching into internal migration shims. The implementation
  // is intentionally simple and safe: it checks existence and guards
  // against unexpected store errors.
  return async (id: string) => {
    try {
      const doc = store.read(id);
      return doc !== undefined && doc !== null;
    } catch (err) {
      // If the store throws for any reason, treat as non-existent but
      // avoid bubbling errors into realtime presence flows.
      return false;
    }
  };
}

export class PresenceTracker {
  private peers: Map<string, PeerPresence> = new Map();

  private validator?: (id: string) => Promise<boolean>;

  constructor(
    private readonly store: DocumentStore,
    private readonly sync?: SyncEngine,
  ) {}

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
      this.peers.set(peerId, { ...existing, status: 'offline', lastSeen: Date.now() });
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
      // Fallback to the synchronous store check for backwards compatibility when no validator is set.
      const doc = this.store.read(documentId);
      if (!doc) return false;
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
   * Set a synchronous validator. This setter is pure (no IO) per the public contract.
   * For async/store-backed validators use setAsyncValidator instead.
   */
  setValidator(validate?: (id: string) => boolean): void {
    if (!validate) {
      this.validator = undefined;
      return;
    }
    // Wrap sync validator into async internal validator without performing IO here.
    this.validator = async (id: string) => {
      try {
        return Boolean(validate(id));
      } catch (_) {
        // Treat thrown errors as validation failure but do not propagate to realtime flows.
        return false;
      }
    };
  }

  /**
   * Set an asynchronous validator for store-backed or IO-bound checks.
   * This method is explicit about allowing IO and may perform network/disk operations.
   */
  setAsyncValidator(validate?: (id: string) => Promise<boolean> | boolean): void {
    if (!validate) {
      this.validator = undefined;
      return;
    }
    // Normalize async or sync inputs into the internal async validator.
    this.validator = async (id: string) => {
      try {
        return await Promise.resolve(validate(id) as Promise<boolean> | boolean);
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
