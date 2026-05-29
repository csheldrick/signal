// ── Sync Queue ───────────────────────────────────────────────
// Ordered, deduplicated outbound message queue with exponential-backoff retry.
// Depends on: sync/protocol.

import type { SyncMessage, VectorClock } from '../core/types.js';
import { clocksEqual } from './protocol.js'; // runtime utility (equality check)

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
  /** Maximum number of queued messages. Default 500. */
  maxQueueSize?: number;
  /** Overflow handling strategy when the queue is full. 'reject' will reject enqueue, 'drop_oldest' will remove the oldest entry and enqueue the new one. Default 'drop_oldest'. */
  overflowStrategy?: 'reject' | 'drop_oldest';
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
  private readonly overflowStrategy: 'reject' | 'drop_oldest';

  constructor(opts: SyncQueueOptions = {}) {
    this.maxQueueSize = opts.maxQueueSize ?? 100; // reduced default to apply backpressure earlier and bound memory under load
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.maxDelayMs = opts.maxDelayMs ?? 30_000;
    this.overflowStrategy = opts.overflowStrategy ?? 'drop_oldest';

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
    // Non-blocking enqueue: return immediately after scheduling the entry
    // so callers (e.g. SyncManager.flush) do not block waiting for delivery/acks.
    // Maintain an internal ack promise (settled by ack()/fail()) so the queue
    // still has a mechanism to resolve/reject delivery lifecycle, but avoid
    // exposing that promise to the flush path which must remain responsive.

    const key = this.keyFor(message);

    // Internal ack promise (not returned to callers). Keep references to
    // its resolve/reject so ack()/fail() can settle it. Swallow unhandled
    // rejections to avoid noisy runtime warnings when nobody awaits the ack.
    let ackResolve: () => void = () => {};
    let ackReject: (err: Error) => void = () => {};
    const ackPromise = new Promise<void>((res, rej) => { ackResolve = res; ackReject = rej; });
    ackPromise.catch(() => { /* swallow */ });

    const entry: QueueEntry = {
      message,
      attempts: 0,
      nextRetryAt: 0,
      // resolve/reject operate on the internal ack promise
      resolve: () => { try { ackResolve(); } catch (_) { /* swallow */ } },
      reject: (err: Error) => { try { ackReject(err); } catch (_) { /* swallow */ } },
    };

    const existing = this.index.get(key);
    if (existing && existing.attempts === 0) {
      // Replace pending unattempted entry (dedup). Reject the old ack promise
      // so producers can react to being superseded.
      try {
        existing.reject(new Error(`Superseded by newer ${message.operation} for ${message.documentId}`));
      } catch (_) { /* ignore */ }

      const idx = this.entries.indexOf(existing);
      if (idx !== -1) this.entries.splice(idx, 1, entry);
      else this.entries.push(entry);
      this.index.set(key, entry);
    } else {
      if (this.entries.length >= this.maxQueueSize) {
        // Queue is full. Apply configured overflow strategy.
        if (this.overflowStrategy === 'drop_oldest') {
          const removed = this.entries.shift()!;
          const removedKey = this.keyFor(removed.message);
          this.index.delete(removedKey);
          try { removed.reject(new Error('Queue full — dropped oldest entry')); } catch (_) { /* ignore */ }
          try { /* emit telemetry for overflow */ } catch (_) {}
        } else {
          // Default behavior: reject to surface backpressure to callers.
          const removed = this.entries.shift()!;
          const removedKey = this.keyFor(removed.message);
          this.index.delete(removedKey);
          try { removed.reject(new Error('Queue full — dropped oldest entry')); } catch (_) { /* ignore */ }
          return Promise.reject(new Error('Queue full — cannot enqueue new entry'));
        }
      }
      this.entries.push(entry);
      this.index.set(key, entry);
    }

    // Return a resolved promise to indicate enqueue completed (non-blocking).
    return Promise.resolve();
  }

  peek(now = Date.now()): QueueEntry[] {
    // Return entries due now. Keep the returned objects live (not removed)
    // so callers decide ack/fail semantics. To avoid returning an unbounded
    // set (which can overload consumers), cap the batch size.
    const out: QueueEntry[] = [];
    const MAX_BATCH = 10; // smaller batches to avoid overloading recipients during flush
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

  /** Return lightweight stats for diagnostics. */
  getStats(): { size: number; maxQueueSize: number; maxAttempts: number; overflowStrategy: string } {
    return { size: this.entries.length, maxQueueSize: this.maxQueueSize, maxAttempts: this.maxAttempts, overflowStrategy: this.overflowStrategy };
  }

  clear(): void {
    for (const e of this.entries) {
      try { e.reject(new Error('Queue cleared')); } catch (_) { /* ignore */ }
    }
    this.entries.length = 0;
    this.index.clear();
  }

  private clocksEqual(a: VectorClock | undefined, b: VectorClock | undefined): boolean {
    return clocksEqual(a, b);
  }
}
