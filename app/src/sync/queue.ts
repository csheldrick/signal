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
}

export class SyncQueue {
  private readonly entries: QueueEntry[] = [];
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(opts: SyncQueueOptions = {}) {
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.maxDelayMs = opts.maxDelayMs ?? 30_000;
  }

  /**
   * Enqueue a message. If a message for the same (documentId, operation)
   * already exists and has not been attempted yet, it is replaced (dedup).
   * Returns a Promise that resolves when the message is acked or rejects
   * after maxAttempts are exhausted.
   */
  enqueue(message: SyncMessage): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Dedup: replace a pending entry for the same document+op.
      const existingIdx = this.entries.findIndex(
        e =>
          e.message.documentId === message.documentId &&
          e.message.operation === message.operation &&
          e.attempts === 0,
      );

      const entry: QueueEntry = {
        message,
        attempts: 0,
        nextRetryAt: 0,
        resolve,
        reject,
      };

      if (existingIdx !== -1) {
        // Reject the old promise so callers can handle it, then replace.
        this.entries[existingIdx].reject(
          new Error(`Superseded by newer ${message.operation} for ${message.documentId}`),
        );
        this.entries.splice(existingIdx, 1, entry);
      } else {
        this.entries.push(entry);
      }
    });
  }

  /**
   * Returns all entries that are due to be sent right now (nextRetryAt <= now).
   * Does NOT remove them from the queue — call ack() or fail() after dispatch.
   */
  peek(now = Date.now()): QueueEntry[] {
    return this.entries.filter(e => e.nextRetryAt <= now);
  }

  /** Acknowledge successful delivery. Resolves the promise and removes entry. */
  ack(message: SyncMessage): void {
    const idx = this.findIndex(message);
    if (idx === -1) return;
    const [entry] = this.entries.splice(idx, 1);
    entry.resolve();
  }

  /**
   * Mark a delivery attempt as failed.
   * Schedules retry (exponential backoff) or rejects if maxAttempts reached.
   */
  fail(message: SyncMessage, err?: Error): void {
    const idx = this.findIndex(message);
    if (idx === -1) return;

    const entry = this.entries[idx];
    entry.attempts += 1;

    if (entry.attempts >= this.maxAttempts) {
      this.entries.splice(idx, 1);
      entry.reject(
        err ?? new Error(`Sync failed after ${entry.attempts} attempts for ${message.documentId}`),
      );
      return;
    }

    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, entry.attempts - 1),
      this.maxDelayMs,
    );
    entry.nextRetryAt = Date.now() + delay;
  }

  /** How many messages are currently queued. */
  get size(): number {
    return this.entries.length;
  }

  /** Drain all entries without sending — useful for shutdown / tests. */
  clear(): void {
    for (const e of this.entries) {
      e.reject(new Error('Queue cleared'));
    }
    this.entries.length = 0;
  }

  private findIndex(message: SyncMessage): number {
    return this.entries.findIndex(
      e =>
        e.message.documentId === message.documentId &&
        e.message.operation === message.operation &&
        e.message.clock === message.clock,
    );
  }
}
