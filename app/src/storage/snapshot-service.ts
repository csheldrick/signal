/*
 * DocumentSnapshotService
 *
 * Exposes a SnapshotStore contract and a DocumentSnapshotService that
 * periodically compacts document history into versioned snapshots and
 * provides compactClock utilities to bound VectorClock vector size.
 *
 * The service is defensive about IO, swallows errors from underlying
 * stores, and exposes a compactClock(clock) method which SyncManager and
 * SyncEngine can call during conflict resolution or outbound message
 * preparation.
 */

import type { DocumentSnapshot } from '../core/types.js';
import type { VectorClock } from '../sync/protocol.js';

export interface SnapshotStore {
  /** Return a list of known document ids (best-effort). */
  listDocumentIds(): Promise<string[]>;
  /** Get the latest stored snapshot for a document, or undefined */
  getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | undefined>;
  /** Persist a snapshot for a document. */
  putSnapshot(documentId: string, snapshot: DocumentSnapshot): Promise<void>;
}

export interface DocumentSnapshotServiceOptions {
  /** Number of ms between background compaction runs. Set <=0 to disable. */
  compactionIntervalMs?: number;
  /** Limit on the number of vector-clock entries retained by compactClock. */
  maxClockEntries?: number;
}

export class DocumentSnapshotService {
  private store?: SnapshotStore;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly compactionIntervalMs: number;
  private readonly maxClockEntries: number;
  private stopped = false;

  constructor(store?: SnapshotStore, opts?: DocumentSnapshotServiceOptions) {
    this.store = store;
    // Default to a longer interval (15 minutes) to reduce periodic IO bursts;
    // enforce a minimum of 60s to avoid pathological rapid compaction.
    const defaultInterval = 15 * 60 * 1000; // 15min default to reduce IO pressure
    const requested = typeof opts?.compactionIntervalMs === 'number' ? opts!.compactionIntervalMs : defaultInterval;
    this.compactionIntervalMs = Math.max(60_000, requested);
    this.maxClockEntries = typeof opts?.maxClockEntries === 'number' ? Math.max(4, opts!.maxClockEntries) : 64;

    if (this.store && this.compactionIntervalMs > 0) {
      try {
        this.timer = setInterval(() => { void this.runCompactionPass(); }, this.compactionIntervalMs);
      } catch (_) {
        this.timer = undefined;
      }
    }
  }

  /** Attach or replace the underlying SnapshotStore. */
  setSnapshotStore(store?: SnapshotStore): void {
    this.store = store;
    try {
      if (this.timer && !this.store) { clearInterval(this.timer); this.timer = undefined; }
      if (!this.timer && this.store && this.compactionIntervalMs > 0) {
        this.timer = setInterval(() => { void this.runCompactionPass(); }, this.compactionIntervalMs);
      }
    } catch (_) { /* swallow */ }
  }

  /**
   * Compact a VectorClock by removing zero/invalid entries and bounding
   * its size to the configured maxClockEntries. Returns a new VectorClock.
   */
  compactClock(clock?: VectorClock): VectorClock {
    const out: VectorClock = {};
    if (!clock || typeof clock !== 'object') return out;
    try {
      for (const [peer, tick] of Object.entries(clock)) {
        const t = Number.isFinite(tick as number) ? Math.max(0, tick as number) : 0;
        if (t > 0) out[peer] = t;
      }

      const entries = Object.entries(out);
      if (entries.length <= this.maxClockEntries) {
        return Object.fromEntries(entries) as VectorClock;
      }

      // Keep the highest ticks (most recent) to preserve useful causality
      entries.sort(([, aTick], [, bTick]) => (bTick as number) - (aTick as number));
      return Object.fromEntries(entries.slice(0, this.maxClockEntries)) as VectorClock;
    } catch (_) {
      return out;
    }
  }

  /**
   * Perform a best-effort compaction pass across snapshots in the store.
   * This function is defensive and swallows errors to avoid affecting
   * realtime flows. If a store is not attached it is a no-op.
   */
  async runCompactionPass(): Promise<void> {
    if (this.stopped) return;
    const store = this.store;
    if (!store) return;

    // Prevent overlapping compaction runs which can cause bursts of IO and
    // unexpectedly high load if a previous pass is still running.
    if ((this as any)._running) return;
    (this as any)._running = true;

    try {
      const ids = await Promise.resolve(store.listDocumentIds()).catch(() => []);
      if (!Array.isArray(ids) || ids.length === 0) return;

      // Bound the number of ids processed per pass to avoid long blocking
      const MAX_PER_PASS = 20; // further reduced to lower per-pass IO pressure
      let count = 0;
      for (const id of ids) {
        if (this.stopped) break;
        if (count++ >= MAX_PER_PASS) break;
        try {
          const snap = await Promise.resolve(store.getLatestSnapshot(id)).catch(() => undefined);
          if (!snap) continue;
          const compacted = this.compactSnapshot(snap);
          // Fire-and-forget put to avoid blocking the compaction loop on slow IO;
          // errors are swallowed to preserve best-effort semantics.
          void Promise.resolve(store.putSnapshot(id, compacted)).catch(() => { /* swallow */ });
        } catch (_) { /* continue on error */ }
      }
    } finally {
      try { delete (this as any)._running; } catch (_) { (this as any)._running = false; }
    }
  }

  /**
   * Trim any pathological snapshot fields to keep snapshots bounded.
   * This is intentionally conservative and mirrors DocumentSnapshot
   * shape expectations from core/types.
   */
  private compactSnapshot(s: DocumentSnapshot): DocumentSnapshot {
    try {
      const trimmed: DocumentSnapshot = {
        id: String(s.id),
        title: typeof s.title === 'string' ? (s.title.length > 5000 ? s.title.slice(0, 5000) : s.title) : (s.title as any),
        content: typeof s.content === 'string' ? (s.content.length > 200_000 ? s.content.slice(0, 200_000) : s.content) : (s.content as any),
        tags: Array.isArray(s.tags) ? s.tags.slice(0, 100).map(t => (typeof t === 'string' ? (t.length > 100 ? t.slice(0, 100) : t) : String(t))) : [],
        links: Array.isArray(s.links) ? s.links.map(l => ({ sourceId: String(l.sourceId), targetId: String(l.targetId), kind: (l.kind as any) })) : [],
        createdAt: Number.isFinite(s.createdAt) ? s.createdAt : Date.now(),
        updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : Date.now(),
      };
      return trimmed;
    } catch (_) {
      return s;
    }
  }

  stop(): void {
    this.stopped = true;
    try { if (this.timer) { clearInterval(this.timer); this.timer = undefined; } } catch (_) {}
  }
}

export default DocumentSnapshotService;
