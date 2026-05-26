// ── Version History ──────────────────────────────────────────
// Immutable document snapshots linked as a parent-child chain.
//
// Loom sees these chains as directed temporal edges: each version's
// parentVersionId points backward in time. This is structurally distinct
// from the spatial edges Loom normally extracts — it models lineage, not
// dependency. Weave can use this to detect when a node's history diverges
// from its declared intent (e.g., a "draft" document that never stabilises).

import type { DocumentSnapshot } from '../core/types.js';

export interface DocumentVersion {
  versionId: string;
  documentId: string;
  snapshot: Readonly<DocumentSnapshot>;
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

  snapshot(document: DocumentSnapshot, author: string): DocumentVersion {
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
    const MAX_VERSIONS = 10;
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

    const fromContent = typeof from.snapshot.content === 'string' ? from.snapshot.content : '';
    const toContent = typeof to.snapshot.content === 'string' ? to.snapshot.content : '';
    const fromLines = new Set(fromContent.split('\n'));
    const toLines = toContent.split('\n');

    const MAX_DIFF_ITEMS = 100;
    const addedFull = toLines.filter(l => !fromLines.has(l) && l.trim() !== '');
    const removedFull = [...fromLines].filter(l => !toLines.includes(l) && l.trim() !== '');
    return {
      added: addedFull.slice(0, MAX_DIFF_ITEMS),
      removed: removedFull.slice(0, MAX_DIFF_ITEMS),
      unchanged: toLines.filter(l => fromLines.has(l)).length,
    };
  }

  // Get the current internal state as a snapshot for inspection/debugging
  getState(): {
    chains: Map<string, DocumentVersion[]>;
    byId: Map<string, DocumentVersion>;
  } {
    return {
      chains: new Map(this.chains),
      byId: new Map(this.byId),
    };
  }
}
