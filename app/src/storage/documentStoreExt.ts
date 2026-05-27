import { DocumentStore } from './store.js';

// Explicit helper functions that operate on DocumentStore instances instead
// of mutating the prototype at import time. This avoids brittle import-order
// races and makes the mutation-log API explicit and testable. Callers are
// encouraged to use the public methods on DocumentStore (getMutationLog,
// enqueueOfflineMutation, replayMutationLog, markMutationApplied,
// trimAppliedMutations). These helpers provide lightweight fallbacks for
// older code paths that may still introspect store internals.

export function enqueueOfflineMutation(store: DocumentStore, op: 'create' | 'update' | 'delete' | 'link', mutationId: string, payload: any): number {
  try {
    if (!store || typeof (store as any).recordBufferedMutation !== 'function') return 0;
    return (store as any).recordBufferedMutation(mutationId, op, payload);
  } catch (_) {
    try { return 0; } catch (_) { return 0; }
  }
}

export function getMutationLog(store: DocumentStore): ReadonlyArray<{ seq: number; id: string; op: string; payload: any }> {
  try {
    if (!store) return [];
    if (typeof (store as any).getMutationLog === 'function') return (store as any).getMutationLog();
    // Best-effort introspection fallback (non-ideal; prefer public API).
    const raw = Array.isArray((store as any).mutationLog) ? (store as any).mutationLog.slice() : [];
    raw.sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));
    return raw.map((e: any) => ({ seq: e.seq, id: e.id, op: e.op, payload: e.payload }));
  } catch (_) {
    return [];
  }
}

export async function replayMutationLog(store: DocumentStore, replayer: (entry: { seq: number; id: string; op: string; payload: any }) => Promise<void> | void): Promise<void> {
  try {
    if (!store) return;
    if (typeof (store as any).replayMutationLog === 'function') {
      return await (store as any).replayMutationLog(replayer);
    }
    if (typeof (store as any).replayBufferedMutations === 'function') {
      return await (store as any).replayBufferedMutations(replayer);
    }

    // Fallback: iterate over internal mutationLog if present.
    const entries = (Array.isArray((store as any).mutationLog) ? (store as any).mutationLog.slice() : []).sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));
    for (const e of entries) {
      try {
        const applied = ((store as any).appliedMutationIds instanceof Set) ? (store as any).appliedMutationIds.has(String(e.id)) : false;
        if (applied) continue;
        await Promise.resolve(replayer({ seq: e.seq, id: String(e.id), op: String(e.op), payload: e.payload }));
        try { if ((store as any).appliedMutationIds instanceof Set) (store as any).appliedMutationIds.add(String(e.id)); } catch (_) { /* swallow */ }
      } catch (_) {
        // swallow individual entry errors to allow forward progress
      }
    }
  } catch (_) {
    /* swallow */
  }
}

export function markMutationApplied(store: DocumentStore, id: string): void {
  try {
    if (!store) return;
    if (typeof (store as any).markMutationApplied === 'function') {
      (store as any).markMutationApplied(id);
      return;
    }
    if ((store as any).appliedMutationIds instanceof Set) {
      (store as any).appliedMutationIds.add(String(id));
    }
  } catch (_) { /* swallow */ }
}

export function trimAppliedMutations(store: DocumentStore): void {
  try {
    if (!store) return;
    if (typeof (store as any).trimAppliedMutations === 'function') {
      (store as any).trimAppliedMutations();
      return;
    }
    if (!Array.isArray((store as any).mutationLog) || (store as any).mutationLog.length === 0) return;
    const applied = ((store as any).appliedMutationIds instanceof Set) ? (store as any).appliedMutationIds : new Set<string>();
    (store as any).mutationLog = (store as any).mutationLog.filter((e: any) => !applied.has(String(e.id)));
  } catch (_) { /* swallow */ }
}

export {};

