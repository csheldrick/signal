// ── Inverted Index ───────────────────────────────────────────
// Full-text search index with IDF scoring.
// This is intentionally a high-centrality hub: every document that wants
// fast search flows through here, making it a natural fan-in node for Loom.

export interface IndexStats {
  termCount: number;
  documentCount: number;
  avgTermsPerDoc: number;
}

export interface SearchHit {
  documentId: string;
  score: number;
}

export class InvertedIndex {
  private posting: Map<string, Set<string>> = new Map();
  private docTerms: Map<string, Set<string>> = new Map();

  index(documentId: string, text: string): void {
    this.remove(documentId);
    const terms = this.tokenize(text);
    const termSet = new Set(terms);
    this.docTerms.set(documentId, termSet);

    for (const term of termSet) {
      let list = this.posting.get(term);
      if (!list) {
        list = new Set();
        this.posting.set(term, list);
      }
      list.add(documentId);
    }
  }

  remove(documentId: string): void {
    const terms = this.docTerms.get(documentId);
    if (!terms) return;

    for (const term of terms) {
      const list = this.posting.get(term);
      list?.delete(documentId);
      if (list?.size === 0) this.posting.delete(term);
    }
    this.docTerms.delete(documentId);
  }

  search(queryText: string): SearchHit[] {
    const queryTerms = this.tokenize(queryText);
    const scores = new Map<string, number>();

    for (const term of queryTerms) {
      const docs = this.posting.get(term);
      if (!docs) continue;

      // IDF: rare terms score higher
      const idf = Math.log(1 + this.docTerms.size / docs.size);
      for (const docId of docs) {
        scores.set(docId, (scores.get(docId) ?? 0) + idf);
      }
    }

    return [...scores.entries()]
      .map(([documentId, score]) => ({ documentId, score }))
      .sort((a, b) => b.score - a.score);
  }

  terms(): string[] {
    return [...this.posting.keys()];
  }

  stats(): IndexStats {
    const totalTerms = [...this.docTerms.values()].reduce((n, t) => n + t.size, 0);
    const docCount = this.docTerms.size;
    return {
      termCount: this.posting.size,
      documentCount: docCount,
      avgTermsPerDoc: docCount === 0 ? 0 : totalTerms / docCount,
    };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}
