// ── Sync Queue ───────────────────────────────────────────────
// Ordered, deduplicated outbound message queue with exponential-backoff retry.
// Depends on: sync/protocol.

import type { SyncMessage } from './protocol.js';

export interface QueueEntry {
  message: SyncMessage;
  attempts: number;
  nextRetryAt: number;
  /** Resolved once the message is successfully acknowledged. */
  resolve: () => void;
  reject: (err: Error) => void;
}

export interface SyncQueueOptions {
  /** Maximum delivery attempts before the entry is dropped. Default 5. */
  maxAttempts?: number;
  /** Base retry delay in ms (doubles each attempt). Default 500. */
  baseDelayMs?: number;
  /** Hard cap on retry delay ms. Default 30_000. */
  maxDelayMs?: number;
  /** Maximum number of queued messages. Default 1000. */
  maxQueueSize?: number;
}

export class SyncQueue {
  // Keep an ordered list for stable FIFO dispatch, but maintain a Map for
  // O(1) lookup by the deduplication key (documentId + operation). This
  // retains existing semantics while avoiding O(n) scans on ack/fail/enqueue.
  private readonly entries: QueueEntry[] = [];
  private readonly index: Map<string, QueueEntry> = new Map();
  private readonly maxQueueSize: number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(opts: SyncQueueOptions = {}) {
    this.maxQueueSize = opts.maxQueueSize ?? 1000;
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.maxDelayMs = opts.maxDelayMs ?? 30_000;
  }

  private keyFor(msg: SyncMessage): string {
    // Prefer an explicit stable messageId when present (set by producers like
    // SyncEngine or SyncManager). This allows ack/fail to reliably match
    // queued entries even when message objects are deserialized/reconstructed
    // across transport boundaries. When no messageId is present (tests / old
    // callers), fall back to deduping by documentId + operation to preserve
    // existing semantics.
    if (msg && typeof (msg as any).messageId === 'string' && (msg as any).messageId.length > 0) {
      return `id:${(msg as any).messageId}`;
    }
    return `docop:${msg.documentId}::${msg.operation}`;
  }

  enqueue(message: SyncMessage): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const key = this.keyFor(message);

      const entry: QueueEntry = {
        message,
        attempts: 0,
        nextRetryAt: 0,
        resolve,
        reject,
      };

      const existing = this.index.get(key);
      if (existing && existing.attempts === 0) {
        // Replace pending unattempted entry (dedup). Reject the old promise
        // so callers can react to being superseded.
        try {
          existing.reject(new Error(`Superseded by newer ${message.operation} for ${message.documentId}`));
        } catch (_) { /* ignore */ }
        // Replace in-place in the ordered list to preserve position.
        const idx = this.entries.indexOf(existing);
        if (idx !== -1) this.entries.splice(idx, 1, entry);
        else this.entries.push(entry);
        this.index.set(key, entry);
      } else {
        if (this.entries.length >= this.maxQueueSize) {
          const removed = this.entries.shift()!;
          const removedKey = this.keyFor(removed.message);
          this.index.delete(removedKey);
          try {
            removed.reject(new Error('Queue full — dropped oldest entry'));
          } catch (_) { /* ignore */ }
        }
        this.entries.push(entry);
        this.index.set(key, entry);
      }
    });
  }

  peek(now = Date.now()): QueueEntry[] {
    // Return entries due now. Keep the returned objects live (not removed)
    // so callers decide ack/fail semantics. To avoid returning an unbounded
    // set (which can overload consumers), cap the batch size.
    const out: QueueEntry[] = [];
    const MAX_BATCH = 50;
    for (const e of this.entries) {
      if (e.nextRetryAt <= now) {
        out.push(e);
        if (out.length >= MAX_BATCH) break;
      }
    }
    return out;
  }

  ack(message: SyncMessage): void {
    const key = this.keyFor(message);
    const entry = this.index.get(key);
    if (!entry) return;
    // Remove from ordered list and index
    const idx = this.entries.indexOf(entry);
    if (idx !== -1) this.entries.splice(idx, 1);
    this.index.delete(key);
    try { entry.resolve(); } catch (_) { /* ignore */ }
  }

  fail(message: SyncMessage, err?: Error): void {
    const key = this.keyFor(message);
    const entry = this.index.get(key);
    if (!entry) return;

    entry.attempts += 1;

    if (entry.attempts >= this.maxAttempts) {
      // Remove permanently and reject
      const idx = this.entries.indexOf(entry);
      if (idx !== -1) this.entries.splice(idx, 1);
      this.index.delete(key);
      try { entry.reject(err ?? new Error(`Sync failed after ${entry.attempts} attempts for ${message.documentId}`)); } catch (_) { /* ignore */ }
      return;
    }

    const delay = Math.min(this.baseDelayMs * Math.pow(2, entry.attempts - 1), this.maxDelayMs);
    entry.nextRetryAt = Date.now() + delay;
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    for (const e of this.entries) {
      try { e.reject(new Error('Queue cleared')); } catch (_) { /* ignore */ }
    }
    this.entries.length = 0;
    this.index.clear();
  }

  private clocksEqual(a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean {
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
}
