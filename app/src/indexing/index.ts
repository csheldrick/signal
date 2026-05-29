// Adapter facade to maintain backwards-compatible API for legacy callers
// Delegates to the canonical implementation in ../index/inverted.ts

import { createInvertedIndex } from '../index/inverted.js';
import type { IndexStats, SearchHit } from '../core/types.js';

// The legacy InvertedIndex class provided a simple token->doc posting API.
// To avoid fragmenting the codebase we adapt the canonical InvertedIndex
// (which operates on DocumentSnapshot objects) to the older surface.

export class InvertedIndex {
  private impl: any;
  private knownDocs: Set<string> = new Set();

  constructor() {
    // Defer creating the concrete inverted index until actually needed.
    // Instantiating the index lazily reduces startup work and avoids
    // constructing heavy subsystems for callers that only need a few
    // legacy operations, helping relieve subsystem pressure under load.
    this.impl = undefined;
  }

  private ensureImpl() {
    if (this.impl) return;
    try {
      this.impl = createInvertedIndex();
    } catch (_) {
      this.impl = undefined;
    }
  }

  index(documentId: string, text: string): void {
    try {
      this.ensureImpl();
      if (!this.impl) return;
      const now = Date.now();
      const snap = {
        id: String(documentId),
        title: '',
        content: String(text ?? ''),
        tags: [],
        links: [],
        createdAt: now,
        updatedAt: now,
      } as any;
      // Use updateDocument which is idempotent for new/existing docs.
      if (typeof this.impl.updateDocument === 'function') {
        this.impl.updateDocument(snap);
      } else if (typeof this.impl.indexDocument === 'function') {
        this.impl.indexDocument(snap);
      }
      this.knownDocs.add(documentId);
    } catch (_) { /* swallow to keep legacy tolerant */ }
  }

  remove(documentId: string): void {
    try {
      this.ensureImpl();
      if (!this.impl) return;
      if (typeof this.impl.removeDocument === 'function') {
        this.impl.removeDocument(documentId);
      }
      this.knownDocs.delete(documentId);
    } catch (_) { /* swallow */ }
  }

  search(queryText: string): SearchHit[] {
    try {
      this.ensureImpl();
      if (!this.impl) return [];
      const q = { text: String(queryText ?? '') } as any;
      if (typeof this.impl.search === 'function') {
        const res = this.impl.search(q);
        if (Array.isArray(res)) {
          return res.map((r: any) => ({ documentId: r.document?.id ?? (r as any).documentId, field: 'content', snippet: undefined, score: r.score ?? 0 }));
        }
      }
    } catch (_) {}
    return [];
  }

  terms(): string[] {
    try {
      if (!this.impl) return [];
      // Best-effort: return topTerms from stats to avoid exposing full posting map
      if (typeof this.impl.stats === 'function') {
        const s: IndexStats = this.impl.stats();
        return Array.isArray(s.topTerms) ? s.topTerms.map(t => t.term) : [];
      }
    } catch (_) {}
    return [];
  }

  stats(maxDocs?: number): IndexStats | null {
    try {
      if (!this.impl) return null;
      if (typeof this.impl.stats === 'function') return this.impl.stats(maxDocs);
    } catch (_) {}
    return null;
  }
}
