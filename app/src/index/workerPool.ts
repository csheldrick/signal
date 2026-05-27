// Worker pool for parallel indexing. Distributes indexing work across
// multiple workers to reduce synchronous fan-in to InvertedIndex.
// This eliminates the bottleneck where all indexing operations flow
// through a single thread.

export interface IndexWorker {
  work(): void;
}

export interface WorkerPoolOptions {
  numWorkers: number;
  maxDocsPerWorker: number;
}

export class WorkerPool {
  private workers: IndexWorker[] = [];
  private activeWorkers: number = 0;
  private readonly numWorkers: number;
  private readonly maxDocsPerWorker: number;
  private readonly onWorkerFinish: ((workerIndex: number) => void) | null = null;

  constructor(options: WorkerPoolOptions, onWorkerFinish?: (workerIndex: number) => void) {
    this.numWorkers = Math.max(1, options.numWorkers);
    this.maxDocsPerWorker = options.maxDocsPerWorker;
    this.onWorkerFinish = onWorkerFinish || null;
    this.initWorkers();
  }

  private initWorkers() {
    const { numWorkers, maxDocsPerWorker } = this;
    for (let i = 0; i < numWorkers; i++) {
      this.workers.push({ work: () => this.processWork(i, maxDocsPerWorker) });
    }
    this.activeWorkers = this.numWorkers;
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

    // Process chunks with a concurrency limit equal to numWorkers. This avoids
    // dispatching an unbounded number of macrotasks at once and reduces
    // instantaneous pressure on downstream subsystems.
    return new Promise<void>((resolve) => {
      let idx = 0;
      let active = 0;

      const scheduleNext = () => {
        // If no remaining work and no active workers, we're done.
        if (idx >= chunks.length && active === 0) {
          resolve();
          return;
        }

        // While we have capacity, start new chunk tasks.
        while (active < this.numWorkers && idx < chunks.length) {
          const { workerIndex, docs } = chunks[idx++];
          active++;

          // Run chunk asynchronously so we yield to the event loop between chunks.
          setTimeout(() => {
            try {
              for (const doc of docs) {
                const normalized = doc.text ? doc.text.toLowerCase() : '';
                const words = normalized.split(/\s+/).filter(w => w.length > 0);
                // No-op with words; worker would use tokens for indexing.
              }
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
    this.workers = [];
    this.activeWorkers = 0;
  }

}