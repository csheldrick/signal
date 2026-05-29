import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import type { DocumentSnapshot, SnapshotStore } from '../core/types.js';

/**
 * DocumentSnapshotService
 * - Writes snapshots atomically using write-then-rename (tmp -> final)
 * - Retains at least two most-recent snapshots per document (prunes older)
 * - Performs all work asynchronously so live document writes are not blocked
 */
// SnapshotStore contract imported from core/types.ts to avoid circular imports.

export class DiskDocumentSnapshotStore implements SnapshotStore {
  private readonly basePath: string;
  private _pending: Map<string, { snapshot: DocumentSnapshot; timer: ReturnType<typeof setTimeout>; resolvers: Array<() => void> }> = new Map();

  constructor(basePath = '.snapshots') {
    // Assign before any closure captures to satisfy strict-initialization
    this.basePath = basePath;

    // Use a local copy in the async initializer to avoid TypeScript warning
    // about using 'this' before initialization in captured closures.
    const bp = this.basePath;

    // Best-effort create base directory
    (async () => {
      try {
        await fsPromises.mkdir(bp, { recursive: true });
      } catch (_) { /* swallow */ }
    })();

    // Register canonical disk store on globalThis to reduce accidental
    // duplicate authoritative stores across differing import paths or
    // build artifacts. The registry module will prefer the first created
    // canonical store when queried.
    try {
      if (typeof globalThis !== 'undefined') {
        const g = globalThis as any;
        const GLOBAL_KEY = '__SIGNAL_CANONICAL_SNAPSHOT_STORE__';
        const GLOBAL_DISK = '__SIGNAL_DISK_SNAPSHOT_STORE__';
        if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = this;
        g[GLOBAL_DISK] = this;
      }
    } catch (_) {}
  }

  private static encodeId(id: string): string {
    try {
      const b = Buffer.from(String(id), 'utf8').toString('base64');
      return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (_) { return encodeURIComponent(String(id)); }
  }

  private static decodeId(name: string): string {
    try {
      let b = String(name).replace(/-/g, '+').replace(/_/g, '/');
      const pad = b.length % 4;
      if (pad === 2) b += '=='; else if (pad === 3) b += '='; else if (pad === 1) b = b + '===';
      return Buffer.from(b, 'base64').toString('utf8');
    } catch (_) { try { return decodeURIComponent(name); } catch (_) { return name; } }
  }

  private docDir(documentId: string): string {
    // Safe per-document directory under basePath
    return path.join(this.basePath, DiskDocumentSnapshotStore.encodeId(documentId));
  }

  /**
   * Persist a snapshot atomically and prune older snapshots while keeping at
   * least two most-recent snapshots. Implements SnapshotStore.putSnapshot.
   * This implementation coalesces rapid successive writes per-document to
   * reduce filesystem pressure.
   */
  async putSnapshot(documentId: string, snapshot: DocumentSnapshot): Promise<void> {
    try {
      // Coalesce rapid successive writes for the same document to reduce
      // filesystem churn. Return a Promise that resolves when the write
      // has been flushed to disk.
      const existing = this._pending.get(documentId);
      if (existing) {
        existing.snapshot = snapshot;
        return new Promise<void>((resolve) => { existing.resolvers.push(resolve); });
      }

      const resolvers: Array<() => void> = [];
      const debounceMs = 2000; // increased debounce to group bursts and reduce IO pressure (longer coalescing to cut filesystem IO)
      const timer = setTimeout(async () => {
        try {
          const state = this._pending.get(documentId);
          if (!state) return;
          const dir = this.docDir(documentId);
          try { await fsPromises.mkdir(dir, { recursive: true }); } catch (_) {}

          const timestamp = Date.now();
          const rand = Math.floor(Math.random() * 1e9).toString(36);
          const tmpName = `${timestamp}.${rand}.tmp`;
          const finalName = `${timestamp}.json`;

          const tmpPath = path.join(dir, tmpName);
          const finalPath = path.join(dir, finalName);

          const payload = JSON.stringify(state.snapshot);
          try {
            await fsPromises.writeFile(tmpPath, payload, { encoding: 'utf8' });
            await fsPromises.rename(tmpPath, finalPath);
            await this.pruneSnapshots(dir, 2);
          } catch (_) {
            // Best-effort: swallow write/rename errors
          }

          // resolve all awaiting promises
          try { for (const r of state.resolvers) { try { r(); } catch (_) {} } } catch (_) {}
        } finally {
          this._pending.delete(documentId);
        }
      }, debounceMs);

      this._pending.set(documentId, { snapshot, timer, resolvers });
      return new Promise<void>((resolve) => { resolvers.push(resolve); });
    } catch (err) {
      try { console.warn && console.warn('DiskDocumentSnapshotStore.putSnapshot failed', err); } catch (_) {}
    }
  }

  private async pruneSnapshots(dir: string, keep: number): Promise<void> {
    try {
      const files = await fsPromises.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length <= keep) return;
      // Sort descending by filename (timestamp prefix ensures ordering)
      jsonFiles.sort((a, b) => (a < b ? 1 : -1));
      const toDelete = jsonFiles.slice(keep);
      await Promise.allSettled(toDelete.map(f => fsPromises.unlink(path.join(dir, f))));
    } catch (_) {
      /* swallow prune errors */ }
  }

  async getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | undefined> {
    try {
      const dir = this.docDir(documentId);
      const files = await fsPromises.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) return undefined;
      jsonFiles.sort((a, b) => (a < b ? 1 : -1));
      const latest = jsonFiles[0];
      const content = await fsPromises.readFile(path.join(dir, latest), 'utf8');
      try {
        const parsed = JSON.parse(content);
        try {
          const { makeSafeSnapshot } = require('../core/types.js');
          const safe = typeof makeSafeSnapshot === 'function' ? makeSafeSnapshot(parsed) : undefined;
          return safe as DocumentSnapshot | undefined;
        } catch (_) {
          return parsed as DocumentSnapshot;
        }
      } catch (_) { return undefined; }
    } catch (_) {
      return undefined;
    }
  }

  /** List snapshots (filenames) for diagnostics. */
  async listSnapshots(documentId: string): Promise<string[]> {
    try {
      const dir = this.docDir(documentId);
      const files = await fsPromises.readdir(dir);
      return files.filter(f => f.endsWith('.json')).sort((a, b) => (a < b ? 1 : -1));
    } catch (_) {
      return [];
    }
  }

  /** List known document ids (best-effort). Implements SnapshotStore.listDocumentIds. */
  async listDocumentIds(): Promise<string[]> {
    try {
      const entries = await fsPromises.readdir(this.basePath, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      // decode identifier to match docDir encoding
      return dirs.map(d => DiskDocumentSnapshotStore.decodeId(d));
    } catch (_) {
      return [];
    }
  }
}

export default DiskDocumentSnapshotStore;
