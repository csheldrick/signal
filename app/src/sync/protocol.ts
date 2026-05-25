// ── Sync Protocol ───────────────────────────────────────────
// Types for the eventual-consistency sync layer.

export type SyncState = 'idle' | 'syncing' | 'conflicted' | 'resolved';

export type ConflictStrategy = 'last-write-wins' | 'first-write-wins' | 'merge-content';

export interface PeerInfo {
  peerId: string;
  /** Last vector clock we received from this peer. */
  clock: VectorClock;
  /** Epoch ms of the last successful exchange. */
  lastSeen: number;
  state: SyncState;
}

export interface SyncAck {
  kind: 'ack';
  peerId: string;
  documentId: string;
  clock: VectorClock;
  timestamp: number;
}

export interface ConflictRecord {
  documentId: string;
  localClock: VectorClock;
  remoteClock: VectorClock;
  localTimestamp: number;
  remoteTimestamp: number;
  resolvedBy: ConflictStrategy;
  resolvedAt: number;
}

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
