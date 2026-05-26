// ── Version History ──────────────────────────────────────────
// Immutable document snapshots linked as a parent-child chain.
//
// Loom sees these chains as directed temporal edges: each version's
// parentVersionId points backward in time. This is structurally distinct
// from the spatial edges Loom normally extracts — it models lineage, not
// dependency. Weave can use this to detect when a node's history diverges
// from its declared intent (e.g., a "draft" document that never stabilises).

import type { Document } from '../core/types.js';

export interface DocumentVersion {
  versionId: string;
  documentId: string;
  snapshot: Readonly<Document>;
  parentVersionId: string | undefined;
  createdAt: number;
  author: string;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  unchanged: number;
}

export class VersionHistory {
  private chains: Map<string, DocumentVersion[]> = new Map();
  private byId: Map<string, DocumentVersion> = new Map();

  snapshot(document: Document, author: string): DocumentVersion {
    if (!author || author.trim() === '') {
      throw new Error('VersionHistory.snapshot requires a non-empty author (authentication required).');
    }

    const history = this.chains.get(document.id) ?? [];
    const parent = history.at(-1);

    const version: DocumentVersion = {
      versionId: `${document.id}@v${history.length + 1}`,
      documentId: document.id,
      snapshot: Object.freeze({ ...document, links: Array.isArray(document.links) ? document.links.map(l => ({ ...l })) : [] }),
      parentVersionId: parent?.versionId,
      createdAt: Date.now(),
      author,
    };

    history.push(version);

    // Cap history per-document to avoid unbounded memory growth.
    const MAX_VERSIONS = 50;
    if (history.length > MAX_VERSIONS) {
      const removed = history.splice(0, history.length - MAX_VERSIONS);
      for (const old of removed) {
        this.byId.delete(old.versionId);
      }
    }

    this.chains.set(document.id, history);
    this.byId.set(version.versionId, version);
    return version;
  }

  getHistory(documentId: string): DocumentVersion[] {
    return [...(this.chains.get(documentId) ?? [])];
  }

  getVersion(versionId: string): DocumentVersion | undefined {
    return this.byId.get(versionId);
  }

  getLatest(documentId: string): DocumentVersion | undefined {
    return this.chains.get(documentId)?.at(-1);
  }

  // Ancestry walk from a version back to the root
  getLineage(versionId: string): DocumentVersion[] {
    const lineage: DocumentVersion[] = [];
    let current: DocumentVersion | undefined = this.byId.get(versionId);
    while (current) {
      lineage.unshift(current);
      current = current.parentVersionId
        ? this.byId.get(current.parentVersionId)
        : undefined;
    }
    return lineage;
  }

  diff(fromVersionId: string, toVersionId: string): VersionDiff | undefined {
    const from = this.byId.get(fromVersionId);
    const to = this.byId.get(toVersionId);
    if (!from || !to) return undefined;

    const fromLines = new Set(from.snapshot.content.split('\n'));
    const toLines = to.snapshot.content.split('\n');

    return {
      added: toLines.filter(l => !fromLines.has(l) && l.trim() !== ''),
      removed: [...fromLines].filter(
        l => !toLines.includes(l) && l.trim() !== '',
      ),
      unchanged: toLines.filter(l => fromLines.has(l)).length,
    };
  }
}
