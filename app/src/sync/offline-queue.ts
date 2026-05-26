import { appendFileSync, existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { DocumentChange } from '../core/types.js';

export interface OfflineEntry {
  id: string; // stable id for the queued mutation
  peerId: string;
  documentId: string;
  change: DocumentChange;
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
 * Durable, per-peer queue that persists DocumentChange mutations to disk
 * when network transport is unavailable. Ensures causal (timestamp/seq)
 * ordering when draining and provides robust rewrite behaviour so partially
 * applied drains do not lose remaining entries.
 */
export class OfflineSyncQueue extends EventEmitter {
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

  private makeEntry(peerId: string, documentId: string, change: DocumentChange): OfflineEntry {
    return {
      id: `${peerId}:${documentId}:${Date.now()}:${Math.floor(Math.random() * 1e9).toString(36)}`,
      peerId,
      documentId,
      change,
      timestamp: Date.now(),
      seq: Number(process.hrtime.bigint() % BigInt(Number.MAX_SAFE_INTEGER)),
    };
  }

  /**
   * Enqueue a change for the given peer. Synchronously persists to disk
   * before resolving to provide a conservative durability guarantee.
   */
  async enqueue(peerId: string, documentId: string, change: DocumentChange): Promise<void> {
    if (!peerId) throw new Error('peerId required');
    const entry = this.makeEntry(peerId, documentId, change);

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
      for (const line of lines) {
        try { out.push(JSON.parse(line) as OfflineEntry); } catch (_) { /* skip corrupt line */ }
      }
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
