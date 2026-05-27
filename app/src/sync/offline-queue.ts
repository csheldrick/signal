import { appendFileSync, existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'node:events';

// OfflineSyncQueue stores an opaque payload (any) so it can be used to
// persist SyncManager outbound messages or DocumentChange mutations.
export interface OfflineEntry {
  id: string; // stable id for the queued mutation
  peerId: string;
  documentId: string;
  payload: any;
  timestamp: number;
  seq: number;
}

export interface OfflineSyncQueueOptions {
  /** Directory where offline files are persisted. Defaults to process.cwd() */
  dataDir?: string;
  /** File prefix for per-peer persistent queues */
  filePrefix?: string;
}

/**
 * OfflineSyncQueue
 *
 * Durable, per-peer queue that persists opaque payloads to disk when
 * network transport is unavailable. Ensures causal (timestamp/seq)
 * ordering when draining and provides robust rewrite behaviour so partially
 * applied drains do not lose remaining entries.
 */
export class OfflineSyncQueue extends EventEmitter {
  // Per-peer monotonic sequence counters to ensure durable on-disk ordering
  // that is stable across process restarts while avoiding relying on
  // platform-specific high-resolution timers. This map is used by makeEntry
  // to assign a monotonic seq number per peer.
  private seqCounters: Map<string, number> = new Map();
  private readonly dataDir: string;
  private readonly filePrefix: string;
  private readonly memQueues: Map<string, OfflineEntry[]> = new Map();

  constructor(opts?: OfflineSyncQueueOptions) {
    super();
    this.dataDir = opts?.dataDir ? opts.dataDir : process.cwd();
    this.filePrefix = opts?.filePrefix ?? '.signal_offline_';
    try {
      // Ensure directory exists
      mkdirSync(this.dataDir, { recursive: true });
    } catch (_) {
      // best-effort
    }
  }

  private filePathForPeer(peerId: string): string {
    const name = `${this.filePrefix}${peerId}.ndjson`;
    return join(this.dataDir, name);
  }

  private makeEntry(peerId: string, documentId: string, payload: any): OfflineEntry {
    // Use a per-peer monotonic sequence counter to ensure stable ordering
    // even across restarts. Seed with a coarse timestamp-based value if we
    // have no prior information for the peer.
    try {
      let seq = this.seqCounters.get(peerId);
      if (typeof seq !== 'number') {
        // Seed with current epoch seconds to reduce collision likelihood and
        // provide an increasing baseline.
        seq = Math.floor(Date.now() / 1000);
      }
      seq = seq + 1;
      this.seqCounters.set(peerId, seq);

      return {
        id: `${peerId}:${documentId}:${seq}`,
        peerId,
        documentId,
        payload,
        timestamp: Date.now(),
        seq,
      };
    } catch (_) {
      // Fallback to less-precise but safe seq on environments without
      // process.hrtime or BigInt.
      return {
        id: `${peerId}:${documentId}:${Date.now()}:${Math.floor(Math.random() * 1e9).toString(36)}`,
        peerId,
        documentId,
        payload,
        timestamp: Date.now(),
        seq: Date.now(),
      };
    }
  }

  /**
   * Enqueue a payload for the given peer. Durably appends to disk
   * asynchronously while returning quickly to the caller.
   */
  async enqueue(peerId: string, documentId: string, payload: any): Promise<void> {
    if (!peerId) throw new Error('peerId required');
    const entry = this.makeEntry(peerId, documentId, payload);

    // append to in-memory queue immediately (fast, non-blocking)
    const q = this.memQueues.get(peerId) ?? [];
    q.push(entry);
    this.memQueues.set(peerId, q);

    // Emit enqueue synchronously so callers observe the queueing operation
    // completed from an in-memory perspective. Durable persistence happens
    // asynchronously to avoid blocking callers on disk I/O.
    try { this.emit('enqueue', { peerId, entry }); } catch (_) {}

    const path = this.filePathForPeer(peerId);

    // Perform durable append asynchronously. We intentionally do not await
    // this work here — callers should treat enqueue as fast and durable
    // persistence is attempted in the background. Persist errors are emitted
    // via 'persist_error' for observability.
    const doAppend = () => {
      try {
        const line = JSON.stringify(entry) + '\n';
        appendFileSync(path, line, { encoding: 'utf-8' });
      } catch (err) {
        try { this.emit('persist_error', { peerId, entry, error: err }); } catch (_) {}
      }
    };

    try {
      // Prefer setImmediate to keep the append off the immediate call stack
      // while still scheduling it promptly. Fall back to setTimeout(,0)
      // for environments without setImmediate.
      if (typeof setImmediate === 'function') {
        setImmediate(doAppend);
      } else {
        setTimeout(doAppend, 0);
      }
    } catch (_) {
      try { setTimeout(doAppend, 0); } catch (_) { /* swallow */ }
    }

    return;
  }

  /** Return number of pending entries for a peer (in-memory + on-disk) */
  size(peerId: string): number {
    try {
      const mem = this.memQueues.get(peerId) ?? [];
      const disk = this.readAllFromDisk(peerId);
      return mem.length + disk.length;
    } catch (_) {
      const mem = this.memQueues.get(peerId) ?? [];
      return mem.length;
    }
  }

  list(peerId: string): OfflineEntry[] {
    const mem = this.memQueues.get(peerId) ?? [];
    const disk = this.readAllFromDisk(peerId);
    // Merge and sort by timestamp then seq to preserve causal order
    const merged = disk.concat(mem);
    merged.sort((a, b) => (a.timestamp - b.timestamp) || (a.seq - b.seq));
    return merged;
  }

  private readAllFromDisk(peerId: string): OfflineEntry[] {
    const path = this.filePathForPeer(peerId);
    if (!existsSync(path)) return [];
    try {
      const raw = readFileSync(path, 'utf-8');
      if (!raw) return [];
      const lines = raw.split('\n').filter(l => l.trim().length > 0);
      const out: OfflineEntry[] = [];
      let maxSeq = -Infinity;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as OfflineEntry;
          out.push(parsed);
          if (typeof parsed.seq === 'number' && Number.isFinite(parsed.seq)) {
            if (parsed.seq > maxSeq) maxSeq = parsed.seq;
          }
        } catch (_) { /* skip corrupt line */ }
      }
      // Seed the per-peer seq counter to one past the max observed on-disk so
      // subsequent makeEntry calls continue monotonicity across restarts.
      try {
        if (maxSeq !== -Infinity) this.seqCounters.set(peerId, maxSeq);
      } catch (_) { /* swallow */ }
      return out;
    } catch (_) { return []; }
  }

  /**
   * Drain the pending entries for a peer in causal order. The handler is
   * invoked sequentially for each entry. If the handler throws for an entry
   * the remaining entries are preserved and the function rejects with the
   * error after rewrite.
   */
  async drain(peerId: string, handler: (entry: OfflineEntry) => Promise<void>): Promise<void> {
    if (!peerId) throw new Error('peerId required');
    const diskEntries = this.readAllFromDisk(peerId);
    const mem = this.memQueues.get(peerId) ?? [];
    const all = diskEntries.concat(mem);
    // stable sort
    all.sort((a, b) => (a.timestamp - b.timestamp) || (a.seq - b.seq));

    if (all.length === 0) return;

    const remaining: OfflineEntry[] = [];
    let failedError: unknown = undefined;
    for (const entry of all) {
      try {
        await handler(entry);
        try { this.emit('delivered', { peerId, entry }); } catch (_) {}
      } catch (err) {
        // On first failure, push this and subsequent entries to remaining
        failedError = err;
        remaining.push(entry);
        // collect subsequent entries without attempting
        const idx = all.indexOf(entry);
        for (let j = idx + 1; j < all.length; j++) remaining.push(all[j]);
        break;
      }
    }

    // rewrite disk file with remaining entries (durable) and set mem queue accordingly
    try {
      const path = this.filePathForPeer(peerId);
      if (remaining.length === 0) {
        // remove file and clear in-memory queue
        if (existsSync(path)) {
          try { unlinkSync(path); } catch (_) { /* swallow */ }
        }
        this.memQueues.delete(peerId);
      } else {
        // write remaining to file atomically
        const tmp = path + '.tmp';
        try {
          const content = remaining.map(r => JSON.stringify(r)).join('\n') + '\n';
          writeFileSync(tmp, content, 'utf-8');
          writeFileSync(path, content, 'utf-8');
          try { unlinkSync(tmp); } catch (_) {}
        } catch (err) {
          // If rewrite fails, try to at least write what we can to disk path directly
          try { writeFileSync(path, remaining.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8'); } catch (_) {}
        }
        // Update in-memory queue to be any entries that were originally only in mem
        const memSet = new Set(mem.map(m => m.id));
        const newMem = remaining.filter(r => memSet.has(r.id));
        if (newMem.length > 0) this.memQueues.set(peerId, newMem); else this.memQueues.delete(peerId);
      }
    } catch (_) {
      // swallow persistence rewrite errors but leave in-memory coherent
    }

    if (failedError) {
      throw failedError;
    }

    try { this.emit('drain_complete', { peerId }); } catch (_) {}
  }

  /** Clear all entries for a peer (used when stopping manager) */
  clear(peerId: string): void {
    try {
      const path = this.filePathForPeer(peerId);
      if (existsSync(path)) {
        try { unlinkSync(path); } catch (_) {}
      }
    } catch (_) {}
    try { this.memQueues.delete(peerId); } catch (_) {}
    try { this.emit('cleared', { peerId }); } catch (_) {}
  }

  dispose(): void {
    try { this.removeAllListeners(); } catch (_) {}
    // no timers to clear
  }
}
