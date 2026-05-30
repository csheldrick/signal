import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'vitest';
import { SyncManager } from '../src/sync/manager.js';
import { DocumentStore } from '../src/storage/store.js';

// Tests for SyncManager functionality and robustness

describe('SyncManager', () => {
  let store: DocumentStore;
  let manager: SyncManager;

  beforeEach(() => {
    store = new DocumentStore();
    manager = new SyncManager(store, { peerId: 'local' });
  });

  it('should add and remove peers correctly', () => {
    manager.addPeer('peer-1');
    assert.ok(manager.getPeer('peer-1'));
    manager.removePeer('peer-1');
    assert.equal(manager.getPeer('peer-1'), undefined);
  });

  it('should resolve conflicts using last-write-wins', () => {
    store.create('doc-1', 'Title', 'Local Content');
    manager.receive({
      operation: 'update',
      documentId: 'doc-1',
      payload: { content: 'Remote Content' },
      clock: { remote: 2 },
      peerId: 'remote',
      timestamp: Date.now(),
    });

    const doc = store.read('doc-1');
    assert.equal(doc?.content, 'Remote Content');
  });

  // it('should enqueue and flush messages correctly', async () => {
  //   const sentMessages = [];
  //   manager.setTransport(async (peerId, message) => {
  //     sentMessages.push({ peerId, message });
  //   });

  //   manager.addPeer('peer-2');
  //   store.create('doc-2', 'Title', 'Content');
  //   await new Promise((res) => setTimeout(res, 10)); // Async enqueue
  //   await manager.flush();

  //   assert.equal(sentMessages.length, 1);
  //   assert.equal(sentMessages[0].peerId, 'peer-2');
  // });

  it('should log and handle conflicts during syncing', () => {
    store.create('conflict-doc', 'Title', 'Version A');
    manager.receive({
      operation: 'update',
      documentId: 'conflict-doc',
      payload: { content: 'Version B' },
      clock: { other: 5 },
      peerId: 'peer-x',
      timestamp: Date.now(),
    });

    const log = manager.getConflictLog();
    assert.ok(log.length > 0);
  });
});