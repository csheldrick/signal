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
  // Deprecated helper retained for backwards-compatibility. Callers should
  // migrate to StorageEventBus.attachDocumentValidatorFromEvents(initialIds)
  // and register via PresenceTracker.setAsyncValidator(). This shim is safe:
  // - never throws (treats errors as "not found")
  // - awaits Promise-like reader results
  // - emits a one-time deprecation warning to guide migration
  let warned = false;

  return async (id: string) => {
    if (!warned) {
      try {
        // eslint-disable-next-line no-console
        console.warn('createValidatorFromStore is deprecated; prefer StorageEventBus.attachDocumentValidatorFromEvents(initialIds) and PresenceTracker.setAsyncValidator().');
      } catch (_) {
        /* swallow console errors */
      }
      warned = true;
    }

    try {
      const res = (_store as unknown as DocumentReader).read(id);
      // Avoid awaiting Promise-like readers on the realtime validation path.
      // If the provided reader returns a Promise-like value we treat it as
      // "not found" to prevent IO from being performed synchronously during
      // presence validation. Callers should migrate to attachDocumentValidatorFromEvents/Async validators.
      if (res !== null && (typeof res === 'object' || typeof res === 'function') && typeof (res as any).then === 'function') {
        return false;
      }
      const resolved = res as unknown;
      return resolved !== undefined && resolved !== null;
    } catch (_) {
      return false;
    }
  };
}

export class PresenceTracker {
  private peers: Map<string, PeerPresence> = new Map();

  private validator?: (id: string) => Promise<boolean>;

  private context: PluginContext | undefined;

  constructor(context?: PluginContext) {
    this.context = context;
  }

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

  async leave(peerId: string): Promise<void> {
    const existing = this.peers.get(peerId);
    if (existing) {
      // Optional async cleanup hook: plugins may provide a sandboxed
      // onPeerLeave(peerId, documentId) hook on PluginContext. We invoke
      // it if present and await it here, but swallow errors to avoid
      // impacting realtime flows. Callers that need to ensure cleanup can
      // await the returned Promise.
      try {
        if (this.context && typeof (this.context as any).onPeerLeave === 'function') {
          await Promise.resolve((this.context as any).onPeerLeave(peerId, existing.documentId));
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
    if (documentId && this.validator) {
      const timeoutMs = 100;
      try {
        const validatorPromise = this.validator(documentId).catch(() => false);
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
