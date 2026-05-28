/*
 * DocumentSnapshotService
 *
 * Best-effort service that compacts document snapshots and provides a
 * compactClock utility to bound VectorClock size.
 */

import type { DocumentSnapshot } from '../core/types.js';
import type { VectorClock } from '../sync/protocol.js';

export interface SnapshotStore {
  listDocumentIds(): Promise<string[]>;
  getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | undefined>;
  putSnapshot(documentId: string, snapshot: DocumentSnapshot): Promise<void>;
}

export interface DocumentSnapshotServiceOptions {
  compactionIntervalMs?: number;
  maxClockEntries?: number;
}

export class DocumentSnapshotService {
  private store?: SnapshotStore;
  private timer?: ReturnType<typeof setInterval>;
  private readonly compactionIntervalMs: number;
  private readonly maxClockEntries: number;
  private stopped = false;

  constructor(store?: SnapshotStore, opts?: DocumentSnapshotServiceOptions) {
    this.store = store;
    const defaultInterval = 60 * 60 * 1000; // 60 minutes (less frequent compaction to reduce SnapshotStore pressure)
    const requested = opts && typeof opts.compactionIntervalMs === 'number' ? opts.compactionIntervalMs : defaultInterval;
    // minimum 10 minutes
    this.compactionIntervalMs = Math.max(10 * 60 * 1000, requested);
    this.maxClockEntries = opts && typeof opts.maxClockEntries === 'number' ? Math.max(4, opts.maxClockEntries) : 8;

    if (this.store && this.compactionIntervalMs > 0) {
      try {
        this.timer = setInterval(() => { void this.runCompactionPass(); }, this.compactionIntervalMs);
      } catch (_) {
        this.timer = undefined;
      }
    }
  }

  setSnapshotStore(store?: SnapshotStore): void {
    this.store = store;
    try {
      if (this.timer && !this.store) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
      if (!this.timer && this.store && this.compactionIntervalMs > 0) {
        this.timer = setInterval(() => { void this.runCompactionPass(); }, this.compactionIntervalMs);
      }
    } catch (_) {
      // swallow
    }
  }

  compactClock(clock?: VectorClock): VectorClock {
    const out: VectorClock = {};
    if (!clock || typeof clock !== 'object') return out;
    try {
      for (const k of Object.keys(clock)) {
        const v = Number(clock[k]);
        if (Number.isFinite(v) && v > 0) out[k] = v;
      }

      const entries = Object.entries(out);
      if (entries.length <= this.maxClockEntries) return { ...out } as VectorClock;
      entries.sort(([, a], [, b]) => (b as number) - (a as number));
      return Object.fromEntries(entries.slice(0, this.maxClockEntries)) as VectorClock;
    } catch (_) {
      return out;
    }
  }

  async runCompactionPass(): Promise<void> {
    if (this.stopped) return;
    const store = this.store;
    if (!store) return;
    if ((this as any)._running) return;
    (this as any)._running = true;

    try {
      const ids = await Promise.resolve(store.listDocumentIds()).catch(() => [] as string[]);
      if (!Array.isArray(ids) || ids.length === 0) return;
      const MAX_PER_PASS = 2; // reduce per-pass work to avoid IO spikes
      let count = 0;
      for (const id of ids) {
        if (this.stopped) break;
        if (count++ >= MAX_PER_PASS) break;
        try {
          const snap = await Promise.resolve(store.getLatestSnapshot(id)).catch(() => undefined);
          if (!snap) continue;
          const compacted = this.compactSnapshot(snap);
          void Promise.resolve(store.putSnapshot(id, compacted)).catch(() => {});
        } catch (_) {
          // continue on error
        }
      }
    } finally {
      try { delete (this as any)._running; } catch (_) { (this as any)._running = false; }
    }
  }

  private compactSnapshot(s: DocumentSnapshot): DocumentSnapshot {
    try {
      const trimmed: DocumentSnapshot = {
        id: String(s.id),
        title: typeof s.title === 'string' ? (s.title.length > 5000 ? s.title.slice(0, 5000) : s.title) : String(s.title),
        content: typeof s.content === 'string' ? (s.content.length > 200000 ? s.content.slice(0, 200000) : s.content) : String(s.content),
        tags: Array.isArray(s.tags) ? s.tags.slice(0, 100).map(t => String(t)) : [],
        links: Array.isArray(s.links) ? s.links.map(l => ({ sourceId: String((l as any).sourceId), targetId: String((l as any).targetId), kind: (l as any).kind })) : [],
        createdAt: Number.isFinite((s as any).createdAt) ? (s as any).createdAt : Date.now(),
        updatedAt: Number.isFinite((s as any).updatedAt) ? (s as any).updatedAt : Date.now(),
        version: typeof (s as any).version === 'number' ? (s as any).version : undefined,
      } as DocumentSnapshot;
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

export { default as DiskDocumentSnapshotStore } from './snapshotService.js';

export default DocumentSnapshotService;
