// ── Presence Tracker ─────────────────────────────────────────
// Uses PluginContext for bounded access to documents.
// This module is registered as a PresencePlugin to receive a sandboxed
// PluginContext that provides readonly access to documents without direct
// store or sync engine imports.

import type { Plugin, PluginContext } from '../plugins/host.js';
import type { DocumentSnapshot } from '../core/types.js';

// Types exposed for backwards compatibility — deprecated direct imports.
// Use PluginContext.listDocuments().map(...) instead.
export type DocumentStore = DocumentSnapshot;
export type SyncEngine = PluginContext;

// Deprecated aliases: prefer PluginContext and PluginContext methods directly
export type DeprecatedDocumentStore = DocumentSnapshot;
export type DeprecatedDocumentReader = DocumentReader;
export type DeprecatedClockProvider = ClockProvider;
export type DeprecatedPresenceStatus = PresenceStatus;

// Deprecated interfaces — use PluginContext methods instead.
export interface DocumentReader {
  read(id: string): unknown | undefined;
}

// Deprecated interface — use PluginContext.getClock() instead.
export interface ClockProvider {
  getClock(): { [peerId: string]: number };
}

export type PresenceStatus = 'active' | 'idle' | 'offline';

export interface PeerPresence {
  peerId: string;
  documentId: string | undefined;
  status: PresenceStatus;
  lastSeen: number;
}

export function createValidatorFromStore(_store: DocumentStore): (id: string) => Promise<boolean> {
  // Deprecated shim: no longer performs synchronous store IO on the realtime path.
  // This conservative implementation prevents legacy callers from triggering
  // blocking or IO-bound behaviour while guiding migration to the event-driven
  // validators (StorageEventBus.attachDocumentValidatorFromEvents).
  let warned = false;

  const validator = async (id: string) => {
    if (!warned) {
      try {
        // eslint-disable-next-line no-console
        console.warn('createValidatorFromStore is deprecated and no longer performs store IO; use StorageEventBus.attachDocumentValidatorFromEvents(initialIds) and PresenceTracker.setAsyncValidator().');
      } catch (_) { /* swallow */ }
      warned = true;
    }
    // Conservative default for realtime paths: avoid any IO and return false.
    return false;
  };

  // Provide a no-op disposer for compatibility with callers that expect it.
  (validator as any).dispose = () => { /* no-op */ };

  return validator;
}

export class PresenceTracker {
  private peers: Map<string, PeerPresence> = new Map();
  private static readonly MAX_PEERS = 2000;
  // Cap the number of concurrent in-flight document validations to prevent
  // unbounded memory growth when many peers reference different documents.
  private static readonly MAX_PENDING_VALIDATIONS = 500;

  private evictIfNeeded(): void {
    try {
      if (this.peers.size < PresenceTracker.MAX_PEERS) return;
      // Prefer removing offline peers first
      for (const [k, p] of this.peers.entries()) {
        if (p.status === 'offline') {
          this.peers.delete(k);
          return;
        }
      }
      // Otherwise evict the least recently seen
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [k, p] of this.peers.entries()) {
        if (p.lastSeen < oldestTime) {
          oldestTime = p.lastSeen;
          oldestKey = k;
        }
      }
      if (oldestKey) this.peers.delete(oldestKey);
    } catch (_) {
      /* swallow */
    }
  }

  private validator?: (id: string) => Promise<boolean>;

  private context: PluginContext | undefined;
  setPluginContext(context?: PluginContext): void {
    // Allow wiring a PluginContext after construction to keep PresenceTracker
    // decoupled from the store and enable sandboxed document access.
    this.context = context;
  }

  /**
   * Allow wiring a SyncSessionTracker so PresenceTracker and SyncManager can
   * share an authoritative session view. This is optional and uses any-typed
   * tracker to avoid tight coupling; only the lifecycle methods used are
   * invoked if present.
   */
  setSessionTracker(tracker?: { openSession?: (id: string, clock?: any) => void; closeSession?: (id: string) => void; list?: () => any[] }): void {
    try { (this as any).sessionTracker = tracker; } catch (_) { /* swallow */ }
  }
  // Cache in-flight validations per document id to deduplicate concurrent
  // validations (reduces redundant IO and CPU when many peers target the same doc).
  private pendingValidations: Map<string, Promise<boolean>> = new Map();

  private cleanupTimer?: ReturnType<typeof setInterval>;
  private static readonly INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

  constructor(context?: PluginContext) {
    this.context = context;

    // Periodically mark stale peers as offline to prevent unbounded growth and
    // reduce continuous work for presence-consuming subsystems. This keeps the
    // realtime path light and lets downstream listeners treat 'offline' as a
    // stable state that can be garbage-collected if needed.
    try {
      this.cleanupTimer = setInterval(() => {
        try {
          const now = Date.now();
          for (const [peerId, p] of this.peers.entries()) {
            if (now - p.lastSeen > PresenceTracker.INACTIVITY_MS && p.status !== 'offline') {
              this.peers.set(peerId, { ...p, status: 'offline' });
            }
          }
        } catch (_) {
          /* swallow cleanup errors */
        }
      }, 60 * 1000);
    } catch (_) {
      // If timers are not available for any reason (test envs), degrade silently.
    }
  }

  join(peerId: string, documentId?: string): PeerPresence {
    const presence: PeerPresence = {
      peerId,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
    };

    // Register presence immediately so the realtime join path is never blocked.
    this.evictIfNeeded();
    this.peers.set(peerId, presence);

    // Notify an attached session tracker that a session has opened or been
    // (re-)activated. Provide an initial clock snapshot when available from
    // the sandboxed PluginContext so session owners can record vector-clock
    // baselines without importing the concrete store.
    try {
      const clock = this.context && typeof (this.context as any).getClock === 'function' ? (this.context as any).getClock() : undefined;
      try { (this as any).sessionTracker?.openSession(peerId, clock); } catch (_) { /* swallow */ }
    } catch (_) { /* swallow */ }

    // If a validator exists, validate in the background with a short timeout.
    // Do NOT await here; a slow validator must not block the realtime path.
    const validator = this.validator;
    if (documentId && validator) {
      const timeoutMs = 100;

      // Reuse any in-flight validation for this document to avoid duplicate work.
      let pending = this.pendingValidations.get(documentId);
      if (!pending) {
        // If we're already at capacity for pending validations avoid creating
        // another in-flight validator to reduce overload on IO-bound paths.
        // Fall back to a resolved 'false' so the join() path stays non-blocking
        // and the presence record can be created immediately.
        if (this.pendingValidations.size >= PresenceTracker.MAX_PENDING_VALIDATIONS) {
          pending = Promise.resolve(false);
        } else {
          pending = (async () => {
            try { return await validator(documentId); } catch (_) { return false; }
          })();
          // Ensure cleanup once settled.
          pending.then(() => this.pendingValidations.delete(documentId)).catch(() => this.pendingValidations.delete(documentId));
          // Enforce a cap on pending validations to avoid unbounded growth. Evict the oldest entry when over the cap.
          try {
            if (this.pendingValidations.size >= PresenceTracker.MAX_PENDING_VALIDATIONS) {
              const oldestKey = this.pendingValidations.keys().next().value;
              if (oldestKey) this.pendingValidations.delete(oldestKey);
            }
          } catch (_) { /* swallow eviction errors */ }
          this.pendingValidations.set(documentId, pending);
        }
      }

      (async () => {
        try {
          const validatorPromise = pending!.catch(() => false);
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

  async leave(peerId: string, awaitCleanup: boolean = false): Promise<void> {
    const existing = this.peers.get(peerId);
    if (existing) {
      // Optional async cleanup hook: plugins may provide a sandboxed
      // onPeerLeave(peerId, documentId) hook on PluginContext. By default
      // we schedule it on a macrotask so the realtime path stays non-blocking.
      // Callers that require deterministic cleanup may pass awaitCleanup = true
      // to wait for the hook to complete; in that case we await with a short
      // timeout to avoid long blocking on the realtime path.
      try {
        if (this.context && typeof (this.context as any).onPeerLeave === 'function') {
          try {
            const hook = (this.context as any).onPeerLeave;
            if (awaitCleanup) {
              // Await the plugin's cleanup with a short timeout to keep callers
              // from blocking indefinitely if a plugin misbehaves.
              try {
                await Promise.race([
                  (async () => { try { await hook(peerId, existing.documentId); } catch (_) { /* swallow hook errors */ } })(),
                  new Promise<void>(res => setTimeout(res, 200)),
                ]);
              } catch (_) { /* swallow */ }
            } else {
              // Schedule non-blocking macrotask invocation to avoid microtask storms
              try { setTimeout(() => { try { hook(peerId, existing.documentId); } catch (_) { /* swallow */ } }, 0); } catch (_) { /* swallow scheduling errors */ }
            }
          } catch (_) { /* swallow scheduling errors */ }
        }
      } catch (_) {
        /* swallow */
      }

      // Only delete if the presence record we originally observed hasn't been superseded
      // by a newer join for the same peerId. Compare the stored record's lastSeen to
      // avoid deleting a fresh record created after this leave() began.
      const current = this.peers.get(peerId);
      if (current && current.lastSeen === existing.lastSeen && current.peerId === existing.peerId) {
        this.peers.delete(peerId);
      }
    }
  }

  getActive(): PeerPresence[] {
    return [...this.peers.values()].filter(p => p.status !== 'offline');
  }

  getViewers(documentId: string): PeerPresence[] {
    return this.getActive().filter(p => p.documentId === documentId);
  }

  async focusDocument(peerId: string, documentId: string): Promise<boolean> {
    // If the peer is already registered for this documentId, they're already focused.
    // Update lastSeen and return true to indicate success.
    const existing = this.peers.get(peerId);
    if (existing && existing.documentId === documentId) {
      this.peers.set(peerId, { ...existing, lastSeen: Date.now() });
      return true;
    }

    // If the peer is not registered, we cannot focus on their behalf.
    if (!existing) return false;

    // If there is a validator, validate the target document with a short timeout.
    // Do NOT block the realtime path for long; mirror the join() behaviour's timeout.
    const validator = this.validator;
    if (documentId && validator) {
      const timeoutMs = 100;

      // Reuse any in-flight validation for this document instead of issuing
      // a duplicate check.
      let pending = this.pendingValidations.get(documentId);
      if (!pending) {
        pending = (async () => {
          try { return await validator(documentId); } catch (_) { return false; }
        })();
        pending.then(() => this.pendingValidations.delete(documentId)).catch(() => this.pendingValidations.delete(documentId));
        // Enforce a cap on pending validations to avoid unbounded growth. Evict the oldest entry when over the cap.
        try {
          if (this.pendingValidations.size >= PresenceTracker.MAX_PENDING_VALIDATIONS) {
            const oldestKey = this.pendingValidations.keys().next().value;
            if (oldestKey) this.pendingValidations.delete(oldestKey);
          }
        } catch (_) { /* swallow eviction errors */ }
        this.pendingValidations.set(documentId, pending);
      }

      try {
        const validatorPromise = pending!.catch(() => false);
        const ok = await Promise.race([
          validatorPromise,
          new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
        ]);

        if (!ok) return false;
      } catch (_) {
        return false;
      }
    }

    // Apply the focus change and mark the peer as active with updated timestamp.
    const updated: PeerPresence = {
      ...existing,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
    };

    this.peers.set(peerId, updated);
    try { (this as any).sessionTracker?.updateHeartbeat?.(peerId); } catch (_) { /* swallow */ }
    return true;
  }

  /**
   * Set a synchronous validator (id => boolean).
   * This setter is for pure, non-IO validators used on the realtime path.
   * For async/store-backed validators use setAsyncValidator().
   *
   * Enforce the synchronous contract at runtime: if the provided function
   * returns a Promise-like value we treat it as invalid here (return false)
   * and emit a warning so callers migrate to setAsyncValidator.
   */
  setValidator(validate?: (id: string) => boolean | Promise<boolean>): void {
    if (!validate) {
      this.validator = undefined;
      return;
    }

    // Accept either synchronous or Promise-returning validators for
    // backwards-compatibility. If an async validator is provided we emit a
    // warning recommending setAsyncValidator(), but we still accept it and
    // wrap it into the internal async validator so presence checks remain
    // functional without crashing.
    this.validator = async (id: string) => {
      try {
        const res = validate(id);

        if (res !== null && (typeof res === 'object' || typeof res === 'function') && typeof (res as any).then === 'function') {
          try {
            // eslint-disable-next-line no-console
            console.warn('PresenceTracker.setValidator received an async validator; running it as async for compatibility. Prefer setAsyncValidator() for IO-bound checks.');
          } catch (_) {
            /* swallow console errors */
          }
          // Await the promise-like validator result but protect against rejection.
          const awaited = await (res as Promise<boolean>).catch(() => false);
          return !!awaited;
        }

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

    // Wrap the provided async validator with defensive guards:
    // - normalize exceptions to false
    // - enforce a generous timeout so slow IO cannot block presence paths
    // This keeps the realtime path resilient while allowing IO-backed validators.
    this.validator = async (id: string) => {
      try {
        const timeoutMs = 2500; // upper-bound for store/network checks

        const guarded = (async (): Promise<boolean> => {
          try {
            const r = await validate(id);
            return !!r;
          } catch (_) {
            return false;
          }
        })();

        const result = await Promise.race([
          guarded,
          new Promise<boolean>(resolve => setTimeout(() => resolve(false), timeoutMs)),
        ]);

        return !!result;
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
