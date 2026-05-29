// ── Sync Protocol Runtimes ──────────────────────────────────
// Lightweight runtime utilities for vector clock operations used by the
// sync subsystem. Type-level sync contracts (VectorClock, SyncMessage, etc.)
// have been migrated into core/types to reduce coupling and centrality.

import type { VectorClock } from '../core/types.js';

export function mergeClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [peer, tick] of Object.entries(b as VectorClock)) {
    // Coerce to finite non-negative numbers; guard against malformed input
    const safeTick = Number.isFinite(tick as number) ? Math.max(0, tick as number) : 0;
    merged[peer] = Math.max(merged[peer] ?? 0, safeTick);
  }

  // Remove zero/invalid entries to avoid noise
  for (const [peer, tick] of Object.entries(merged)) {
    if ((tick ?? 0) <= 0) delete merged[peer];
  }

  // Bound size to prevent unbounded growth in large deployments.
  const MAX_CLOCK_ENTRIES = 50;
  const entries = Object.entries(merged);
  if (entries.length > MAX_CLOCK_ENTRIES) {
    entries.sort(([, aTick], [, bTick]) => (bTick as number) - (aTick as number));
    return Object.fromEntries(entries.slice(0, MAX_CLOCK_ENTRIES)) as VectorClock;
  }

  return merged;
}

export function clocksEqual(a: VectorClock | undefined, b: VectorClock | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  }
  return true;
}

export function isAncestor(ancestor: VectorClock, descendant: VectorClock): boolean {
  for (const [peer, tick] of Object.entries(ancestor)) {
    const safeTick = Number.isFinite(tick as number) ? Math.max(0, tick as number) : 0;
    if ((descendant[peer] ?? 0) < safeTick) return false;
  }
  return true;
}

export function isConcurrent(a: VectorClock, b: VectorClock): boolean {
  return !isAncestor(a, b) && !isAncestor(b, a);
}
