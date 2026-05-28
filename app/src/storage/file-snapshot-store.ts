import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SnapshotStore } from './snapshot-service.js';
import type { DocumentSnapshot } from '../core/types.js';

/**
 * Simple on-disk per-document snapshot store. Each document snapshot is
 * persisted as an individual JSON file under the provided directory. This
 * implementation is best-effort and swallows IO errors to avoid crashing
 * the host process.
 */
export class FileSnapshotStore implements SnapshotStore {
  private dir: string;
  constructor(dir: string) {
    this.dir = dir;
    try { mkdirSync(this.dir, { recursive: true }); } catch (_) {}
  }

  private fileForId(id: string): string {
    // Sanitize id for file names conservatively
    const safe = String(id).replace(/[^a-zA-Z0-9_.-]/g, '_');
    return join(this.dir, `${safe}.json`);
  }

  async listDocumentIds(): Promise<string[]> {
    try {
      if (!existsSync(this.dir)) return [];
      const files = readdirSync(this.dir);
      return files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
    } catch (_) {
      return [];
    }
  }

  async getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | undefined> {
    try {
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
      const p = this.fileForId(documentId);
      writeFileSync(p, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (_) { /* swallow */ }
  }
}

export default FileSnapshotStore;
