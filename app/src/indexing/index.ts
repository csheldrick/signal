// ── Inverted Index ───────────────────────────────────────────
// Full-text search index with IDF scoring.
// This is intentionally a high-centrality hub: every document that wants
// fast search flows through here, making it a natural fan-in node for Loom.

import type { IndexStats, SearchHit } from '../core/types.js';

export class InvertedIndex {
  private posting: Map<string, Set<string>> = new Map();
  private docTerms: Map<string, Set<string>> = new Map();

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
    this.statsDirty = true;

    // To avoid long synchronous CPU bursts when indexing extremely large
    // term sets, process an initial slice synchronously and schedule the
    // remainder asynchronously. This bounds per-document synchronous work
    // and reduces event-loop stalls under heavy ingestion.
    const SYNC_TERM_THRESHOLD = 500;
    let syncProcessed = 0;
    const remaining: string[] = [];

    for (const term of termSet) {
      if (syncProcessed < SYNC_TERM_THRESHOLD) {
        let list = this.posting.get(term);
        if (!list) {
          list = new Set<string>();
          this.posting.set(term, list);
        }
        if (list.size < InvertedIndex.MAX_DOCS_PER_TERM) {
          list.add(documentId);
        }
        syncProcessed++;
      } else {
        remaining.push(term);
      }
    }

    if (remaining.length > 0) {
      const doRemaining = () => {
        try {
          for (const term of remaining) {
            let list = this.posting.get(term);
            if (!list) {
              list = new Set<string>();
              this.posting.set(term, list);
            }
            if (list.size < InvertedIndex.MAX_DOCS_PER_TERM) {
              list.add(documentId);
            }
          }
          // Mark cached stats dirty because we mutated posting lists asynchronously
          this.statsDirty = true;
        } catch (_) { /* swallow to keep indexing tolerant */ }
      };

      try {
        // Prefer setImmediate where available to avoid starving microtasks.
        if (typeof (globalThis as any).setImmediate === 'function') {
          (globalThis as any).setImmediate(doRemaining);
        } else if (typeof queueMicrotask === 'function') {
          // When setImmediate is not available, queue a microtask followed by a macrotask
          // to ensure we yield properly without blocking too long in tight loops.
          queueMicrotask(() => setTimeout(doRemaining, 0));
        } else {
          setTimeout(doRemaining, 0);
        }
      } catch (_) {
        try { setTimeout(doRemaining, 0); } catch (_) { /* swallow */ }
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
      .map(([documentId, score]) => ({ documentId, field: 'content' as const, snippet: undefined as string | undefined, score }))
      .sort((a, b) => b.score - a.score);

    // Cap results to keep downstream consumers focused and to reduce pressure
    const MAX_RESULTS = 50;
    const out = results.slice(0, MAX_RESULTS);
    try { this.searchCache.set(key, { ts: Date.now(), results: out }); } catch (_) {}
    return out;
  }

  terms(): string[] {
    // Return a capped list of terms to avoid exposing the full posting map
    // which can become extremely large under heavy ingestion. This prevents
    // naive callers from iterating massive lists and keeps memory/time bounded.
    const ALL = [...this.posting.keys()];
    const MAX = 1000;
    if (ALL.length > MAX) {
      try { console.warn('InvertedIndex.terms: returning capped term list'); } catch (_) { /* swallow */ }
      return ALL.slice(0, MAX);
    }
    return ALL;
  }

  stats(maxDocs?: number): IndexStats {
    // Serve cached stats when available to avoid recomputation on hot paths.
    const now = Date.now();
    if (!this.statsDirty && this.cachedStats && (now - this.lastStatsTs) < InvertedIndex.STATS_TTL_MS) return { ...this.cachedStats };

    const docCount = this.docTerms.size;
    const termCount = this.posting.size;

    // Heuristic: sample up to maxScan posting entries rather than scanning the
    // entire posting map. This keeps the cost of stats bounded even when the
    // index grows large. Callers may pass maxDocs to request cheaper stats.
    const TOP_N = 10;
    const maxScan = typeof maxDocs === 'number' && maxDocs > 0 ? Math.max(1000, maxDocs * 20) : 10000;

    const entries: Array<{ term: string; count: number }> = [];
    let scanned = 0;
    try {
      for (const [term, set] of this.posting.entries()) {
        if (scanned >= maxScan) break;
        entries.push({ term, count: set.size });
        scanned++;
      }
    } catch (_) {
      // If iteration fails for any reason, fall back to empty list to preserve
      // resiliency of the stats endpoint.
    }

    entries.sort((a, b) => b.count - a.count);
    const topTerms = entries.slice(0, TOP_N);

    const computed: IndexStats = {
      docCount: docCount,
      termCount: termCount,
      topTerms,
    };

    this.cachedStats = computed;
    this.lastStatsTs = Date.now();
    this.statsDirty = false;
    return { ...computed };
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\\s]/g, ' ')
      .split(/\\s+/)
      .filter(t => t.length > 2);
  }
}
