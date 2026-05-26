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

export type InvertedIndexSearchHit = SearchHit;

export class InvertedIndex {
  private posting: Map<string, Set<string>> = new Map();
  private docTerms: Map<string, Set<string>> = new Map();

  private totalTerms: number = 0;
  // Per-term cap to avoid unbounded posting list growth under heavy ingestion.
  private static readonly MAX_DOCS_PER_TERM: number = 10000;
  // Cached stats to avoid frequent recomputation under high read pressure.
  private cachedStats: IndexStats | null = null;
  private lastStatsTs: number = 0;
  private static readonly STATS_TTL_MS = 500;
  private searchCache: Map<string, { ts: number; results: SearchHit[] }> = new Map();
  private statsDirty: boolean = true;

  index(documentId: string, text: string): void {
    // If doc already indexed, remove previous terms so totals remain accurate
    if (this.docTerms.has(documentId)) {
      this.remove(documentId);
    }

    // Defensive: ensure text is a string and bound per-document unique terms
    const terms = this.tokenize(String(text ?? ''));
    const MAX_TERMS_PER_DOC = 10000;

    // Deterministic first-N unique tokens to avoid set iteration non-determinism
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const t of terms) {
      if (!seen.has(t)) {
        seen.add(t);
        ordered.push(t);
        if (seen.size >= MAX_TERMS_PER_DOC) break;
      }
    }

    const termSet = new Set(ordered);
    this.docTerms.set(documentId, termSet);
    this.totalTerms += termSet.size;
    this.statsDirty = true;

    for (const term of termSet) {
      let list = this.posting.get(term);
      if (!list) {
        list = new Set<string>();
        this.posting.set(term, list);
      }
      // Respect a safety cap on per-term posting list size to avoid
      // pathological memory growth caused by extremely common terms.
      if (list.size < InvertedIndex.MAX_DOCS_PER_TERM) {
        list.add(documentId);
      } else {
        // Skip adding to extremely large term posting lists. This keeps
        // indexing bounded; very common terms will still be searchable but
        // won't grow without bound. Do not throw — indexing should remain
        // tolerant under load.
      }
    }
  }

  remove(documentId: string): void {
    const terms = this.docTerms.get(documentId);
    if (!terms) return;

    for (const term of terms) {
      const list = this.posting.get(term);
      if (list) {
        list.delete(documentId);
        if (list.size === 0) this.posting.delete(term);
      }
    }

    this.docTerms.delete(documentId);
    this.totalTerms = Math.max(0, this.totalTerms - terms.size);
    // Mark cached stats dirty due to mutation.
    this.statsDirty = true;
  }

  search(queryText: string): SearchHit[] {
    // Small short-lived cache to avoid redoing identical hot searches repeatedly.
    let key = String(queryText || '');
    try {
      const now = Date.now();
      const c = this.searchCache.get(key);
      if (c && (now - c.ts) < 500) {
        return c.results.slice();
      }
    } catch (_) { /* swallow cache errors */ }

    const queryTerms = this.tokenize(queryText);
    if (queryTerms.length === 0) return [];

    const scores = new Map<string, number>();

    for (const term of queryTerms) {
      const docs = this.posting.get(term);
      if (!docs) continue;

      // IDF: rare terms score higher
      const idf = Math.log(1 + this.docTerms.size / docs.size);
      for (const docId of docs) {
        scores.set(docId, (scores.get(docId) ?? 0) + idf);
      }

      // Defensive: if scores grows very large, bail early to avoid OOM/CPU spikes
      if (scores.size > 10000) break;
    }

    const results = [...scores.entries()]
      .map(([documentId, score]) => ({ documentId, score }))
      .sort((a, b) => b.score - a.score);

    // Cap results to keep downstream consumers focused and to reduce pressure
    const MAX_RESULTS = 50;
    const out = results.slice(0, MAX_RESULTS);
    try { this.searchCache.set(key, { ts: Date.now(), results: out }); } catch (_) {}
    return out;
  }

  terms(): string[] {
    return [...this.posting.keys()];
  }

  stats(): IndexStats {
    // Serve cached stats when available to avoid recomputation on hot paths.
    const now = Date.now();
    if (!this.statsDirty && this.cachedStats && (now - this.lastStatsTs) < InvertedIndex.STATS_TTL_MS) return this.cachedStats;

    const docCount = this.docTerms.size;
    const computed: IndexStats = {
      termCount: this.posting.size,
      documentCount: docCount,
      avgTermsPerDoc: docCount === 0 ? 0 : this.totalTerms / docCount,
    };

    this.cachedStats = computed;
    this.lastStatsTs = Date.now();
    this.statsDirty = false;
    return computed;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }
}
