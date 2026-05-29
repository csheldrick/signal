import type { SnapshotStore } from '../core/types.js';
import DiskStore from './snapshotService.js';
import FileStore from './file-snapshot-store.js';

// Global coordination key to avoid accidental multiple authoritative stores
// across differing import paths or build artifacts. Some consumers may still
// construct stores directly; registering on globalThis ensures a canonical
// instance can be discovered even in those cases.
const GLOBAL_KEY = '__SIGNAL_CANONICAL_SNAPSHOT_STORE__';
const GLOBAL_DISK = '__SIGNAL_DISK_SNAPSHOT_STORE__';
const GLOBAL_FILE = '__SIGNAL_FILE_SNAPSHOT_STORE__';

let canonicalStore: SnapshotStore | undefined = (typeof globalThis !== 'undefined') ? (globalThis as any)[GLOBAL_KEY] : undefined;
let diskStore: SnapshotStore | undefined = (typeof globalThis !== 'undefined') ? (globalThis as any)[GLOBAL_DISK] : undefined;
let fileStore: SnapshotStore | undefined = (typeof globalThis !== 'undefined') ? (globalThis as any)[GLOBAL_FILE] : undefined;

function registerGlobal(kind: 'disk' | 'file', store: any) {
  try {
    if (typeof globalThis === 'undefined') return;
    const g = globalThis as any;
    if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = store;
    if (kind === 'disk') g[GLOBAL_DISK] = store;
    if (kind === 'file') g[GLOBAL_FILE] = store;
  } catch (_) {}
}

export function getOrCreateDiskDocumentSnapshotStore(path?: string): SnapshotStore {
  if (diskStore) return diskStore;
  diskStore = new DiskStore(path);
  if (!canonicalStore) canonicalStore = diskStore;
  registerGlobal('disk', diskStore);
  return diskStore;
}

export function getOrCreateFileSnapshotStore(path?: string): SnapshotStore {
  if (fileStore) return fileStore;
  fileStore = new FileStore(path || '.');
  if (!canonicalStore) canonicalStore = fileStore;
  registerGlobal('file', fileStore);
  return fileStore;
}

export function getCanonicalSnapshotStore(): SnapshotStore | undefined {
  if (!canonicalStore && typeof globalThis !== 'undefined') canonicalStore = (globalThis as any)[GLOBAL_KEY];
  return canonicalStore;
}
