// ── Presence Tracker ─────────────────────────────────────────
// Uses PluginContext for bounded access to documents.
// This module is registered as a PresencePlugin to receive a sandboxed
// PluginContext that provides readonly access to documents without direct
// store or sync engine imports.

import type { Plugin, PluginContext } from '../plugins/host.js';
import type { DocumentSnapshot, PresenceTracker as PresenceTrackerContract, PeerPresence as PeerPresenceContract } from '../core/types.js';
import { getSignalStorageEventBus } from '../core/globals.js';
import { telemetry } from '../sync/telemetry.js';

// The presence subsystem uses a PluginContext sandbox for readonly
// document access. Legacy direct store/sync types have been removed to
// avoid accidental coupling during the TypeScript migration.

export type PresenceStatus = 'active' | 'idle' | 'offline';

export const PRESENCE_STATUS = {
  ACTIVE: 'active' as PresenceStatus,
  IDLE: 'idle' as PresenceStatus,
  OFFLINE: 'offline' as PresenceStatus,
} as const;

// Local concrete PeerPresence mirrors the lightweight contract exported in core/types
export interface PeerPresence extends PeerPresenceContract {}


export function createValidatorFromStore(_store: any): (id: string) => Promise<boolean> {
  // Deprecated: direct store validators are no longer supported for realtime
  // presence validation. Require a PluginContext to avoid accidental
  // synchronous IO on realtime paths and to make the sandbox contract
  // explicit. If a PluginContext is supplied, provide a thin wrapper that
  // uses PluginContext.getDocument. Otherwise fail fast so callers migrate.
  try {
    const maybeCtx = (_store as any) as PluginContext | undefined;
    if (maybeCtx && typeof (maybeCtx as any).getDocument === 'function') {
      let warned = false;
      const ctx = maybeCtx as PluginContext;
      const validator = async (id: string) => {
        if (!warned) {
          try { console.warn('createValidatorFromStore called with a PluginContext: using PluginContext.getDocument for validation. Prefer createValidatorFromPluginContext or PresenceTracker.setPluginContext.'); } catch (_) {}
          warned = true;
        }
        try {
          const d = ctx.getDocument(id);
          return !!d;
        } catch (_) {
          return false;
        }
      };
      (validator as any).dispose = () => { /* no-op */ };
      return validator;
    }
  } catch (_) {
    // fall through to throwing below
  }

  // Fail fast: callers must migrate to PluginContext-based validators which
  // provide a sandboxed, non-IO realtime contract. This avoids accidental
  // direct store or network IO on the realtime path.
  throw new Error('createValidatorFromStore is deprecated; use createValidatorFromPluginContext or PresenceTracker.setPluginContext to provide a PluginContext-based validator.');
}

/**
 * Create a safe async validator that uses a PluginContext sandbox to
 * determine whether a document id is valid. This performs no blocking IO and
 * is the recommended way to wire presence validation in the refactored code.
 */
export function createValidatorFromPluginContext(context?: PluginContext): (id: string) => Promise<boolean> {
  let warned = false;
  const validator = async (id: string) => {
    if (!warned) {
      try { console.warn('createValidatorFromPluginContext: PluginContext-based validator active. Prefer wiring this via PresenceTracker.setPluginContext.'); } catch (_) {}
      warned = true;
    }
    try {
      if (!context) return false;
      const d = context.getDocument(id);
      return !!d;
    } catch (_) {
      return false;
    }
  };
  (validator as any).dispose = () => { /* no-op */ };
  return validator;
}

export class PresenceTracker {
  private peers: Map<string, PeerPresence> = new Map();
  // Monotonic sequence counter to provide atomic versioning for presence entries.
  private nextSeq: number = 1;

  // Batch slot for non-blocking onPeerLeave hook invocation. When many peers
  // leave concurrently scheduling a setTimeout per-leave creates heavy
  // macrotask churn; coalesce them into a single macrotask to reduce fan-out.
  private leaveBatch: Map<string, string | undefined> = new Map();
  private leaveBatchScheduled: boolean = false;

  private static readonly MAX_PEERS = 150; // tightened to reduce memory/processing pressure
  // Cap the number of concurrent in-flight document validations to prevent
  // unbounded memory growth when many peers reference different documents.
  private static readonly MAX_PENDING_VALIDATIONS = 4; // lower cap to avoid IO burst when many peers reference many docs

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
    // decoupled from the store and enable sandboxed document access. When the
    // context is removed, clear in-flight validations to avoid memory growth
    // and accidental continued IO against a stale context. Automatically wire
    // a safe PluginContext-based validator when a context is provided.
    try {
      if (!context) {
        this.context = undefined;
        this.validator = undefined;
        try {
          // Drop references to any pending validation promises so they can be GC'd.
          this.pendingValidations.clear();
        } catch (_) { /* swallow */ }
        try { telemetry.emit('plugin_context_cleared', { timestamp: Date.now() }); } catch (_) { /* swallow */ }
        return;
      }

      this.context = context;

      // Wire a safe validator that uses the PluginContext sandbox. This avoids
      // any synchronous/blocking IO on the realtime path and centralizes the
      // presence -> document validation coupling to the PluginContext API.
      try {
        this.validator = createValidatorFromPluginContext(context);
      } catch (_) {
        // If wiring the validator fails for any reason, degrade safely.
        this.validator = undefined;
      }
    } catch (_) {
      this.context = context;
      try { this.validator = createValidatorFromPluginContext(context); } catch (_) { this.validator = undefined; }
    }
  }

  /**
   * Allow wiring a SyncSessionTracker so PresenceTracker and SyncManager can
   * share an authoritative session view. This is optional and uses any-typed
   * tracker to avoid tight coupling; only the lifecycle methods used are
   * invoked if present.
   */
  setSessionTracker(tracker?: { openSession?: (id: string, clock?: any) => void; closeSession?: (id: string) => void; list?: () => any[] }): void {
    // Wrap and store a safe, minimal session-tracker to avoid leaking rich
    // cross-subsystem objects directly into PresenceTracker. In addition to
    // forwarding calls to the provided tracker we also emit lightweight
    // session lifecycle events on the app StorageEventBus (if present) so
    // other subsystems can react without polling. All emissions are
    // defensive and non-blocking.
    try {
      if (!tracker) {
        (this as any).sessionTracker = undefined;
        return;
      }

      const bus = getSignalStorageEventBus();
      const emitSafe = (ev: any) => {
        try {
          if (bus) {
            try {
              // Prefer non-blocking async emission when available to avoid
              // synchronous fan-out on session lifecycle events.
              if (typeof (bus as any).emitAsync === 'function') {
                try { (bus as any).emitAsync(ev); } catch (_) { /* swallow bus errors */ }
              } else if (typeof (bus as any).emit === 'function') {
                try { (bus as any).emit(ev); } catch (_) { /* swallow bus errors */ }
              }
            } catch (_) { /* swallow bus errors */ }
          }
        } catch (_) { /* swallow */ }
      };

      const safe: any = {
        openSession: typeof tracker.openSession === 'function' ? (id: string, clock?: any) => {
          try { tracker.openSession!(id, clock); } catch (_) {}
          try { emitSafe({ type: 'sync_session_opened', peerId: id, clock: clock ?? undefined, timestamp: Date.now() }); } catch (_) {}
        } : undefined,
        closeSession: typeof tracker.closeSession === 'function' ? (id: string) => {
          try { tracker.closeSession!(id); } catch (_) {}
          try { emitSafe({ type: 'sync_session_closed', peerId: id, timestamp: Date.now() }); } catch (_) {}
        } : undefined,
        list: typeof tracker.list === 'function' ? () => { try { return tracker.list!(); } catch (_) { return []; } } : undefined,
      };

      if (typeof (tracker as any).updateHeartbeat === 'function') {
        safe.updateHeartbeat = (peerId: string) => {
          try { (tracker as any).updateHeartbeat(peerId); } catch (_) {}
          try { emitSafe({ type: 'sync_session_heartbeat', peerId, timestamp: Date.now() }); } catch (_) {}
        };
      }

      (this as any).sessionTracker = safe;
    } catch (_) { /* swallow */ }
  }
  // Cache in-flight validations per document id to deduplicate concurrent
  // validations (reduces redundant IO and CPU when many peers target the same doc).
  private pendingValidations: Map<string, Promise<boolean>> = new Map();
  private lastClockTs: number = 0;
  private lastClock: { [peerId: string]: number } = {};

  private cleanupTimer?: ReturnType<typeof setInterval>;
  private static readonly INACTIVITY_MS = 2 * 60 * 1000; // 2 minutes (shorter to free inactive peers sooner)

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
      }, 60 * 1000); // run cleanup every 1 minute to reduce stale entries faster
    } catch (_) {
      // If timers are not available for any reason (test envs), degrade silently.
    }
  }

  stopCleanupTimer(): void {
    try {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }
    } catch (_) { /* swallow */ }
  }

  join(peerId: string, documentId?: string): PeerPresence {
    const presence: PeerPresence = {
      peerId,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
      seq: this.nextSeq++,
    };

    // Register presence immediately so the realtime join path is never blocked.
    this.evictIfNeeded();
    this.peers.set(peerId, presence);

    // Best-effort, non-blocking observable lifecycle event so other subsystems
    // can react to joins without importing PresenceTracker internals.
    try {
      const bus = getSignalStorageEventBus();
      if (bus && typeof (bus as any).emitAsync === 'function') {
        try { (bus as any).emitAsync({ type: 'presence_joined', peerId, documentId, timestamp: Date.now() } as any); } catch (_) { /* swallow */ }
      } else if (bus && typeof (bus as any).emit === 'function') {
        try { (bus as any).emit({ type: 'presence_joined', peerId, documentId, timestamp: Date.now() } as any); } catch (_) { /* swallow */ }
      }
    } catch (_) { /* swallow */ }

    // Notify an attached session tracker that a session has opened or been
    // (re-)activated. Provide an initial clock snapshot when available from
    // the sandboxed PluginContext so session owners can record vector-clock
    // baselines without importing the concrete store.
    try {
      const clock = (() => {
        try {
          const now = Date.now();
          if (this.lastClockTs && (now - this.lastClockTs) < 500) return { ...this.lastClock };
          const maybe = this.context && typeof (this.context as any).getClock === 'function' ? (this.context as any).getClock() : undefined;
          if (maybe && typeof maybe === 'object') {
            this.lastClock = { ...maybe };
            this.lastClockTs = now;
            return { ...maybe };
          }
        } catch (_) { /* swallow */ }
        return undefined;
      })();
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
              // Schedule non-blocking batched macrotask invocation to avoid microtask storms
              try {
                // If the hook is not present bail out
                if (!hook) {
                  // nothing to schedule
                } else {
                  // Add to the batch; latest entry for a peerId wins
                  try {
                    const MAX_LEAVE_BATCH = 20; // smaller batch to bound macrotask coalescing work
                    if (this.leaveBatch.size >= MAX_LEAVE_BATCH) {
                      // Batch full: avoid unbounded growth. Invoke the hook immediately
                      // for this peer as a best-effort, swallowing errors to keep the
                      // realtime path non-blocking.
                      try { hook(peerId, existing.documentId); } catch (_) { /* swallow */ }
                    } else {
                      this.leaveBatch.set(peerId, existing.documentId);
                    }
                  } catch (_) { /* swallow */ }

                  if (!this.leaveBatchScheduled) {
                    this.leaveBatchScheduled = true;
                    setTimeout(() => {
                      try {
                        const batch = new Map(this.leaveBatch);
                        this.leaveBatch.clear();
                        this.leaveBatchScheduled = false;

                        for (const [pId, docId] of batch.entries()) {
                          try { hook(pId, docId); } catch (_) { /* swallow individual hook errors */ }
                        }
                      } catch (_) {
                        /* swallow batch delivery errors */
                        try { this.leaveBatch.clear(); } catch (_) {}
                        this.leaveBatchScheduled = false;
                      }
                    }, 0);
                  }
                }
              } catch (_) { /* swallow scheduling errors */ }
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
      if (current && current.seq === existing.seq && current.peerId === existing.peerId) {
        try {
      this.peers.delete(peerId);
    } catch (_) { /* swallow */ }

    // Best-effort, non-blocking observable lifecycle event so other subsystems
    // can react to leaves without importing PresenceTracker internals.
    try {
      const bus = getSignalStorageEventBus();
      if (bus && typeof (bus as any).emitAsync === 'function') {
        try { (bus as any).emitAsync({ type: 'presence_left', peerId, documentId: existing.documentId, timestamp: Date.now() } as any); } catch (_) { /* swallow */ }
      } else if (bus && typeof (bus as any).emit === 'function') {
        try { (bus as any).emit({ type: 'presence_left', peerId, documentId: existing.documentId, timestamp: Date.now() } as any); } catch (_) { /* swallow */ }
      }
    } catch (_) { /* swallow */ }
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
      seq: this.nextSeq++,
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
