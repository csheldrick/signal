import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import type { DocumentSnapshot } from '../core/types.js';

/**
 * DocumentSnapshotService
 * - Writes snapshots atomically using write-then-rename (tmp -> final)
 * - Retains at least two most-recent snapshots per document (prunes older)
 * - Performs all work asynchronously so live document writes are not blocked
 */
export class DocumentSnapshotService {
  private readonly basePath: string;

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
  }

  private docDir(documentId: string): string {
    // Safe per-document directory under basePath
    return path.join(this.basePath, encodeURIComponent(documentId));
  }

  /**
   * Save a snapshot atomically and prune older snapshots while keeping at
   * least two most-recent snapshots.
   */
  async saveSnapshot(doc: DocumentSnapshot): Promise<void> {
    try {
      const dir = this.docDir(doc.id);
      await fsPromises.mkdir(dir, { recursive: true });

      const timestamp = Date.now();
      const rand = Math.floor(Math.random() * 1e9).toString(36);
      const tmpName = `${timestamp}.${rand}.tmp`;
      const finalName = `${timestamp}.json`;

      const tmpPath = path.join(dir, tmpName);
      const finalPath = path.join(dir, finalName);

      // Serialize snapshot deterministically
      const payload = JSON.stringify(doc);

      // Write tmp file
      await fsPromises.writeFile(tmpPath, payload, { encoding: 'utf8' });

      // Atomic rename into final path. On most platforms this is atomic
      // as a file system rename/replace operation.
      await fsPromises.rename(tmpPath, finalPath);

      // Prune older snapshots but keep at least two most recent.
      await this.pruneSnapshots(dir, 2);
    } catch (err) {
      // Swallow errors to avoid interfering with live writes; callers may
      // inspect logs if needed.
      try { console.warn && console.warn('DocumentSnapshotService: failed to save snapshot', err); } catch (_) {}
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

  /** Read the latest snapshot for a document if present. */
  async readLatest(documentId: string): Promise<DocumentSnapshot | undefined> {
    try {
      const dir = this.docDir(documentId);
      const files = await fsPromises.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      if (jsonFiles.length === 0) return undefined;
      jsonFiles.sort((a, b) => (a < b ? 1 : -1));
      const latest = jsonFiles[0];
      const content = await fsPromises.readFile(path.join(dir, latest), 'utf8');
      try { return JSON.parse(content) as DocumentSnapshot; } catch (_) { return undefined; }
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
}
