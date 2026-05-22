// ── Sync Protocol ───────────────────────────────────────────
// Types for the eventual-consistency sync layer.

export type SyncState = 'idle' | 'syncing' | 'conflicted' | 'resolved';

export interface VectorClock {
  [peerId: string]: number;
}

export interface SyncMessage {
  operation: 'create' | 'update' | 'delete' | 'link';
  documentId: string;
  payload: unknown;
  clock: VectorClock;
  peerId: string;
  timestamp: number;
}

export function mergeClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [peer, tick] of Object.entries(b)) {
    merged[peer] = Math.max(merged[peer] ?? 0, tick);
  }
  return merged;
}

export function isAncestor(ancestor: VectorClock, descendant: VectorClock): boolean {
  for (const [peer, tick] of Object.entries(ancestor)) {
    if ((descendant[peer] ?? 0) < tick) return false;
  }
  return true;
}

export function isConcurrent(a: VectorClock, b: VectorClock): boolean {
  return !isAncestor(a, b) && !isAncestor(b, a);
}
