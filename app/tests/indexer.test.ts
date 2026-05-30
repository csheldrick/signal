import { Indexer } from '../src/index/inverted.js';

describe('Indexer', () => {
  // it('should drain the pending documents successfully', async () => {
  //   const indexer = new Indexer();

  //   // Simulate some pending documents
  //   indexer['pendingDocs'].set('doc1', { id: 'doc1', text: 'sample text 1' });
  //   indexer['pendingDocs'].set('doc2', { id: 'doc2', text: 'sample text 2' });

  //   await expect(indexer.drainNow()).resolves.not.toThrow();
  //   expect(indexer['pendingDocs'].size).toBe(0);
  // });

  // it('should return the correct pending document count', () => {
  //   const indexer = new Indexer();

  //   // Simulate some pending documents
  //   indexer['pendingDocs'].set('doc1', { id: 'doc1', text: 'sample text 1' });
  //   indexer['pendingDocs'].set('doc2', { id: 'doc2', text: 'sample text 2' });

  //   expect(indexer.getPendingCount()).toBe(2);
  // });
});