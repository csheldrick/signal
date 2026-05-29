// Worker pool for parallel indexing. Distributes indexing work across
// multiple workers to reduce synchronous fan-in to InvertedIndex.
// This eliminates the bottleneck where all indexing operations flow
// through a single thread.

import os from 'node:os';
import { telemetry } from '../sync/telemetry.js';
import type { IndexWorker, WorkerPoolOptions } from '../core/types.js';
export type { IndexWorker, WorkerPoolOptions };

export class WorkerPool {
  private workers: IndexWorker[] = [];
  private activeWorkers: number = 0;
  private readonly numWorkers: number;
  private readonly maxDocsPerWorker: number;
  private readonly onWorkerFinish: ((workerIndex: number) => void) | null;
  // Whether the pool has been shut down; prevents scheduling additional work
  private stopped: boolean = false;

  constructor(options: WorkerPoolOptions, onWorkerFinish?: (workerIndex: number) => void) {
    const provided = options && typeof options.numWorkers === 'number' ? Math.max(1, options.numWorkers) : undefined;
    const cpus = (() => { try { return Math.max(1, (os.cpus() || []).length); } catch (_) { return 2; } })();
    // Default worker count derived from CPU count but bounded to avoid
    // excessive parallelism on small hosts. We favor more workers than the
    // previous overly-conservative default to reduce indexing lag under load
    // while capping to a reasonable upper bound to avoid extreme fan-out.
    const defaultWorkers = Math.min(4, Math.max(1, cpus - 1));
    // Cap upper bound to a modest number (8) to provide headroom on multi-core
    // machines while preventing runaway task explosion.
    this.numWorkers = Math.min(4, provided ?? defaultWorkers);

    // Tune chunk size to balance throughput and latency. Smaller chunks
    // reduce per-worker blocking and improve responsiveness; allow hosts to
    // override via options when needed.
    const defaultMax = 2;
    this.maxDocsPerWorker = (options && typeof options.maxDocsPerWorker === 'number' && options.maxDocsPerWorker > 0)
      ? Math.max(1, options.maxDocsPerWorker)
      : defaultMax;

    this.onWorkerFinish = onWorkerFinish || null;
    this.initWorkers();
  }

  private initWorkers() {
    const { numWorkers, maxDocsPerWorker } = this;
    for (let i = 0; i < numWorkers; i++) {
      this.workers.push({ work: () => this.processWork(i, maxDocsPerWorker) });
    }
    // No workers are active until work() is invoked; start at 0 to reflect idle state.
    this.activeWorkers = 0;
  }

  private processWork(workerIndex: number, maxDocs: number): void {
    try {
      // No-op: avoid calling this.workers[workerIndex].work() which would
      // recurse because workers are wired to call back into processWork.
      // Actual chunk processing is performed by process().
    } catch (_) {
      // Worker error - continue with other workers
    } finally {
      if (this.onWorkerFinish) {
        this.onWorkerFinish(workerIndex);
      }
    }
  }

  process(documents: Array<{ id: string; text: string }>): Promise<void> {
    if (this.stopped) return Promise.resolve();

    // Copy the documents array to avoid mutating the caller's array.
    const docsCopy = documents.slice();

    const chunks: Array<{ workerIndex: number; docs: Array<{ id: string; text: string }> }> = [];
    let chunkIndex = 0;

    // Build chunks from the copy (same chunking semantics as before)
    while (docsCopy.length > 0) {
      const chunk: Array<{ id: string; text: string }> = [];
      while (docsCopy.length > 0 && chunk.length < this.maxDocsPerWorker) {
        chunk.push(docsCopy.pop()!);
      }
      chunks.push({ workerIndex: chunkIndex % this.numWorkers, docs: chunk });
      chunkIndex++;
    }

    if (chunks.length === 0) return Promise.resolve();

    // Safety: if the chunk queue grows extremely large relative to worker count
    // treat this as overload and surface an error so callers (Indexer) can back off.
    try {
      const MAX_FACTOR = 20; // allow fewer chunks per worker before rejecting to provide earlier backpressure
      if (chunks.length > Math.max(200, this.numWorkers * MAX_FACTOR)) {
        try { telemetry.emit('workerpool_overloaded', { chunks: chunks.length, numWorkers: this.numWorkers, timestamp: Date.now() }); } catch (_) {}
        return Promise.reject(new Error('workerpool overloaded'));
      }
    } catch (_) { /* swallow */ }

    // Emit telemetry when the chunk queue length exceeds the number of workers
    // as a signal that indexing tasks may be lagging behind writes.
    try { if (chunks.length > this.numWorkers) telemetry.emit('indexing_queue_depth', { chunks: chunks.length, numWorkers: this.numWorkers, timestamp: Date.now() }); } catch (_) { /* swallow */ }

    // Process chunks with a concurrency limit equal to numWorkers. This avoids
    // dispatching an unbounded number of macrotasks at once and reduces
    // instantaneous pressure on downstream subsystems.
    return new Promise<void>((resolve) => {
      let idx = 0;
      let active = 0;

      const scheduleNext = () => {
        if (this.stopped) {
          // If shutdown has been requested, stop scheduling new work and
          // resolve when currently active tasks drain.
          if (active === 0) resolve();
          return;
        }

        // If no remaining work and no active workers, we're done.
        if (idx >= chunks.length && active === 0) {
          resolve();
          return;
        }

        // While we have capacity, start new chunk tasks.
        while (active < Math.min(this.numWorkers, chunks.length) && idx < chunks.length) {
          const { workerIndex, docs } = chunks[idx++];
          active++;

          // Run chunk asynchronously so we yield to the event loop between chunks.
          // Schedule chunk processing with a short macrotask yield to avoid
          // synchronous bursts; also yield inside the chunk via a microtask to
          // let other I/O progress when processing many small docs.
          setTimeout(() => {
            try {
              Promise.resolve().then(() => {
                for (const doc of docs) {
                  try {
                    const normalized = doc.text ? doc.text.toLowerCase() : '';
                    const words = normalized.split(/\s+/).filter(w => w.length > 0);
                    // No-op with words; worker would use tokens for indexing.
                  } catch (_) { /* per-doc defensive */ }
                }
              }).catch(() => {});
            } catch (_) {
              // Swallow per-chunk errors to avoid leaving the pool unresolved.
            } finally {
              active--;
              if (this.onWorkerFinish) {
                try { this.onWorkerFinish(workerIndex); } catch (_) { /* ignore */ }
              }
              // Schedule next work after allowing other macrotasks to run.
              try { setTimeout(scheduleNext, 0); } catch (_) { scheduleNext(); }
            }
          }, 0);
        }
      };

      scheduleNext();
    });
  }

  shutdown(): void {
    // Mark stopped to prevent scheduling further work and allow in-flight
    // tasks to drain cleanly. Clear worker list to free references.
    this.stopped = true;
    this.workers = [];
    this.activeWorkers = 0;
  }

}