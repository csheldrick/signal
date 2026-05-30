import { WorkerPool, __TEST__ } from '../src/index/workerPool';

describe('WorkerPool', () => {
  it('should drain the worker pool successfully', async () => {
    const options = { numWorkers: 2, maxDocsPerWorker: 5 };
    const pool = new WorkerPool(options);

    await expect(__TEST__.waitForIdle(pool, 1000)).resolves.not.toThrow();
  });

  it('should reject when drain times out', async () => {
    const options = { numWorkers: 2, maxDocsPerWorker: 5 };
    const pool = new WorkerPool(options);

    jest.useFakeTimers();
    const drain = __TEST__.waitForIdle(pool, 10);

    jest.advanceTimersByTime(11);
    await expect(drain).rejects.toThrow('timeout waiting for WorkerPool to drain');
    jest.useRealTimers();
  });

  it('should consider a stopped pool as drained', async () => {
    const options = { numWorkers: 2, maxDocsPerWorker: 5 };
    const pool = new WorkerPool(options);
    pool['stopped'] = true; // simulate stopped state

    await expect(__TEST__.waitForIdle(pool, 1000)).resolves.not.toThrow();
  });
});