import type { SnapshotStore } from '../core/types.js';
import DiskStore from './snapshotService.js';
import FileStore from './file-snapshot-store.js';

let canonicalStore: SnapshotStore | undefined;
let diskStore: DiskStore | undefined;
let fileStore: FileStore | undefined;

export function getOrCreateDiskDocumentSnapshotStore(path?: string): SnapshotStore {
  if (diskStore) return diskStore;
  diskStore = new DiskStore(path);
  if (!canonicalStore) canonicalStore = diskStore;
  return diskStore;
}

export function getOrCreateFileSnapshotStore(path?: string): SnapshotStore {
  if (fileStore) return fileStore;
  fileStore = new FileStore(path || '.');
  if (!canonicalStore) canonicalStore = fileStore;
  return fileStore;
}

export function getCanonicalSnapshotStore(): SnapshotStore | undefined {
  return canonicalStore;
}
