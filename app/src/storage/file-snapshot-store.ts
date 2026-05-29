import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SnapshotStore } from '../core/types.js';
import type { DocumentSnapshot } from '../core/types.js';

/**
 * Simple on-disk per-document snapshot store. Each document snapshot is
 * persisted as an individual JSON file under the provided directory. This
 * implementation is best-effort and swallows IO errors to avoid crashing
 * the host process.
 */
export class FileSnapshotStore implements SnapshotStore {
  private dir: string;
  // pending writes are coalesced per-document to reduce IO pressure
  private _pending: Map<string, { snapshot: DocumentSnapshot; timer: ReturnType<typeof setTimeout>; resolvers: Array<() => void> }> = new Map();

  constructor(dir: string) {
    this.dir = dir;
    try { mkdirSync(this.dir, { recursive: true }); } catch (_) {}

    // Register canonical store on globalThis to help avoid accidental
    // duplicate authoritative stores across differing import paths or
    // build artifacts. This mirrors the registry behaviour in
    // snapshot-registry.ts to maintain a single source of truth.
    try {
      if (typeof globalThis !== 'undefined') {
        const g = globalThis as any;
        const GLOBAL_KEY = '__SIGNAL_CANONICAL_SNAPSHOT_STORE__';
        const GLOBAL_FILE = '__SIGNAL_FILE_SNAPSHOT_STORE__';
        if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = this;
        g[GLOBAL_FILE] = this;
      }
    } catch (_) {}
  }

  private static encodeId(id: string): string {
    // Use a URL-safe base64 variant to encode ids into filesystem-safe names.
    // encodeURIComponent can be lossy or produce characters that are awkward on
    // some filesystems; base64url is reversible and compact.
    try {
      const b = Buffer.from(String(id), 'utf8').toString('base64');
      // base64url: replace +/ with -_ and strip padding =
      return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (_) {
      return encodeURIComponent(String(id));
    }
  }

  private static decodeId(name: string): string {
    try {
      // Restore padding for base64 decode
      let b = String(name).replace(/-/g, '+').replace(/_/g, '/');
      const pad = b.length % 4;
      if (pad === 2) b += '=='; else if (pad === 3) b += '='; else if (pad === 1) b = b + '===';
      return Buffer.from(b, 'base64').toString('utf8');
    } catch (_) {
      try { return decodeURIComponent(name); } catch (_) { return name; }
    }
  }

  private fileForId(id: string): string {
    const safe = FileSnapshotStore.encodeId(id);
    return join(this.dir, `${safe}.json`);
  }

  async listDocumentIds(): Promise<string[]> {
    try {
      if (!existsSync(this.dir)) return [];
      const files = readdirSync(this.dir);
      // Remove the .json suffix and decodeURIComponent to restore original ids.
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''))
        .map(name => {
          try { return FileSnapshotStore.decodeId(name); } catch (_) { return name; }
        });
    } catch (_) {
      return [];
    }
  }

  async getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | undefined> {
    try {
      // If a pending write exists for this id, prefer the pending snapshot
      const pState = this._pending.get(documentId);
      if (pState && pState.snapshot) return pState.snapshot;

      const p = this.fileForId(documentId);
      if (!existsSync(p)) return undefined;
      const raw = readFileSync(p, 'utf-8');
      if (!raw) return undefined;
      const parsed = JSON.parse(raw) as DocumentSnapshot;
      return parsed;
    } catch (_) {
      return undefined;
    }
  }

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
      const timer = setTimeout(() => {
        try {
          const state = this._pending.get(documentId);
          if (!state) return;
          const p = this.fileForId(documentId);
          try {
            writeFileSync(p, JSON.stringify(state.snapshot, null, 2), 'utf-8');
          } catch (_) { /* swallow write errors */ }
          // resolve all awaiting promises
          try { for (const r of state.resolvers) { try { r(); } catch (_) {} } } catch (_) {}
        } finally {
          this._pending.delete(documentId);
        }
      }, debounceMs);

      this._pending.set(documentId, { snapshot, timer, resolvers });
      return new Promise<void>((resolve) => { resolvers.push(resolve); });
    } catch (_) { /* swallow */ }
  }
}

export default FileSnapshotStore;
