// ── Sync Protocol ───────────────────────────────────────────
// Types for the eventual-consistency sync layer.

// Define core sync-related types here to reduce centrality of core/types
// and to keep the sync protocol self-contained. Other modules may import
// these types from sync/protocol.js directly.
export interface VectorClock {
  [peerId: string]: number;
}

export type SyncState = 'idle' | 'syncing' | 'conflicted' | 'resolved';

export type ConflictStrategy = 'last-write-wins' | 'first-write-wins' | 'merge-content';

export interface PeerInfo {
  peerId: string;
  clock: VectorClock;
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

export interface SyncMessage {
  operation: 'create' | 'update' | 'delete' | 'link';
  documentId: string;
  payload: unknown;
  clock: VectorClock;
  peerId: string;
  timestamp: number;
  messageId?: string;
}

// Offline queue types used by SyncManager and OfflineSyncQueue implementation
export interface OfflineEntry {
  id: string;
  peerId: string;
  documentId: string;
  payload: any;
  timestamp: number;
  seq: number;
}

export interface OfflineSyncQueueOptions {
  dataDir?: string;
  filePrefix?: string;
}

export interface OfflineSyncQueue {
  enqueue(peerId: string, documentId: string, payload: any): Promise<void>;
  size(peerId: string): number;
  list(peerId: string): any[];
  drain(peerId: string, handler: (entry: any) => Promise<void>): Promise<void>;
  clear(peerId: string): void;
  dispose(): void;
}

export interface SyncManagerOptions {
  peerId: string;
  conflictStrategy?: ConflictStrategy;
  flushIntervalMs?: number;
  engine?: any;
  sessionTracker?: { openSession(peerId: string, initialClock?: VectorClock): void; closeSession(peerId: string): void; updateHeartbeat?(peerId: string): void };
  snapshotService?: { compactClock?: (clock: VectorClock) => VectorClock };
  offlineQueue?: OfflineSyncQueue;
  offlineFirstMode?: boolean;
}

// Conflict candidate shape
export interface ConflictCandidate {
  documentId: string;
  local: any;
  localClock: any;
  remote: any;
  remoteClock: any;
}

export type ConflictCandidateRecord = ConflictCandidate;

export function mergeClocks(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [peer, tick] of Object.entries(b)) {
    // Coerce to finite non-negative numbers; guard against malformed input
    const safeTick = Number.isFinite(tick as number) ? Math.max(0, tick as number) : 0;
    merged[peer] = Math.max(merged[peer] ?? 0, safeTick);
  }

  // Remove zero/invalid entries to avoid noise
  for (const [peer, tick] of Object.entries(merged)) {
    if ((tick ?? 0) <= 0) delete merged[peer];
  }

  // Bound size to prevent unbounded growth in large deployments.
  // Use a generous limit to reduce frequent truncation which can cause
  // unnecessary synchronization churn (restore previous safe default).
  const MAX_CLOCK_ENTRIES = 50; // tightened to limit vector clock growth and memory pressure (reduced further to lower memory and comparison cost)
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
