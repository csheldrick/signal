// Lightweight in-memory inverted index and an Indexer that binds to StorageEventBus.
// This module provides runtime implementations only; the InvertedIndex interface
// is declared in core/types.ts so multiple implementations can coexist.

import type { DocumentSnapshot, SearchQuery, SearchResult, IndexStats, InvertedIndex, IndexerContract, WorkerPoolOptions } from '../core/types.js';
import { normalizeSearchQuery } from '../core/types.js';
import { WorkerPool } from './workerPool.js';
import { telemetry } from '../sync/telemetry.js';

// Basic tokenizer: split on non-alphanumerics and lowercase
function tokenize(text: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!text || typeof text !== 'string') return out;
  try {
    const toks = text.toLowerCase().split(/[^a-z0-9]+/);
    for (const t of toks) {
      if (!t) continue;
      if (t.length <= 2) continue; // skip tiny tokens
      out.add(t);
    }
  } catch (_) {
    // defensive
  }
  return out;
}

class InvertedIndexImpl implements InvertedIndex {
  private termMap: Map<string, Set<string>> = new Map(); // term -> docIds
  private docStore: Map<string, DocumentSnapshot> = new Map();
  private docTerms: Map<string, Set<string>> = new Map();
  private termCounts: Map<string, number> = new Map();

  // Evict oldest documents when maxDocs is provided to bound memory usage and
  // avoid unbounded growth under heavy write loads.
  private readonly DEFAULT_MAX_DOCS = 2000; // cap documents in the index to bound memory (reduced to limit memory under heavy load)
  private evictToMax(maxDocs: number | undefined) {
    try {
      if (!maxDocs || maxDocs <= 0) return;
      while (this.docStore.size > maxDocs) {
        const it = this.docStore.keys();
        const oldest = it.next();
        if (oldest.done) break;
        const id = oldest.value;
        this.removeDocument(id);
      }
    } catch (_) { /* swallow */ }
  }

  indexDocument(doc: DocumentSnapshot, maxDocs?: number): void {
    if (!doc || typeof doc.id !== 'string') return;
    if (this.docStore.has(doc.id)) {
      this.updateDocument(doc, maxDocs);
      return;
    }
    this.docStore.set(doc.id, doc);
    const terms = this.extractTerms(doc);
    this.docTerms.set(doc.id, terms);
    for (const t of terms) {
      let s = this.termMap.get(t);
      if (!s) { s = new Set(); this.termMap.set(t, s); }
      if (!s.has(doc.id)) {
        s.add(doc.id);
        this.termCounts.set(t, (this.termCounts.get(t) || 0) + 1);
      }
    }

    // Enforce optional document cap after insertion. Use a conservative default when none provided.
    this.evictToMax(maxDocs ?? this.DEFAULT_MAX_DOCS);
  }

  updateDocument(doc: DocumentSnapshot, maxDocs?: number): void {
    if (!doc || typeof doc.id !== 'string') return;
    const prev = this.docTerms.get(doc.id);
    if (prev) {
      for (const t of prev) {
        const s = this.termMap.get(t);
        if (s) {
          s.delete(doc.id);
          if (s.size === 0) this.termMap.delete(t);
        }
        const c = this.termCounts.get(t) ?? 0;
        if (c <= 1) this.termCounts.delete(t); else this.termCounts.set(t, c - 1);
      }
    }
    this.docStore.set(doc.id, doc);
    const terms = this.extractTerms(doc);
    this.docTerms.set(doc.id, terms);
    for (const t of terms) {
      let s = this.termMap.get(t);
      if (!s) { s = new Set(); this.termMap.set(t, s); }
      if (!s.has(doc.id)) {
        s.add(doc.id);
        this.termCounts.set(t, (this.termCounts.get(t) || 0) + 1);
      }
    }

    // Enforce optional document cap after update. Use a conservative default when none provided.
    this.evictToMax(maxDocs ?? this.DEFAULT_MAX_DOCS);
  }

  removeDocument(documentId: string): void {
    if (!documentId) return;
    const prev = this.docTerms.get(documentId);
    if (prev) {
      for (const t of prev) {
        const s = this.termMap.get(t);
        if (s) {
          s.delete(documentId);
          if (s.size === 0) this.termMap.delete(t);
        }
        const c = this.termCounts.get(t) ?? 0;
        if (c <= 1) this.termCounts.delete(t); else this.termCounts.set(t, c - 1);
      }
      this.docTerms.delete(documentId);
    }
    this.docStore.delete(documentId);
  }

  search(query: SearchQuery, maxDocs?: number): SearchResult[] {
    try {
      const q = normalizeSearchQuery(query);
      const text = (q && q.text) ? String(q.text).trim().toLowerCase() : '';
      const qterms = text ? Array.from(tokenize(text)) : [];

      const results: Array<{ doc: DocumentSnapshot; score: number; highlights: string[] }> = [];

      for (const [id, doc] of this.docStore) {
        if (q.dateRange) {
          if (doc.updatedAt < q.dateRange.from || doc.updatedAt > q.dateRange.to) continue;
        }
        if (q.tags && q.tags.length > 0) {
          let has = false;
          for (const t of q.tags) if (doc.tags.includes(t)) { has = true; break; }
          if (!has) continue;
        }

        let score = 0;
        const highlights: string[] = [];

        if (qterms.length > 0) {
          const combined = new Set<string>();
          for (const term of qterms) combined.add(term);
          for (const term of combined) {
            if ((doc.title || '').toLowerCase().includes(term)) { score += 3; highlights.push(doc.title); }
            if ((doc.content || '').toLowerCase().includes(term)) { score += 1; highlights.push(doc.content.substring(0, 150)); }
            if (Array.isArray(doc.tags) && doc.tags.some(t => (t || '').toLowerCase() === term)) { score += 2; highlights.push(doc.tags.join(', ')); }
          }
        }

        if (score > 0 || (qterms.length === 0 && (!q.tags || q.tags.length === 0) && !q.dateRange)) {
          results.push({ doc, score, highlights });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, 50).map(r => ({ document: r.doc, score: r.score, highlights: r.highlights }));
    } catch (_) {
      return [];
    }
  }

  stats(maxDocs?: number): IndexStats {
    const termCount = this.termMap.size;
    const docCount = this.docStore.size;
    const top: Array<{ term: string; count: number }> = [];
    try {
      const arr = Array.from(this.termCounts.entries());
      arr.sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < Math.min(10, arr.length); i++) top.push({ term: arr[i][0], count: arr[i][1] });
    } catch (_) { }
    return { docCount, termCount, topTerms: Object.freeze(top) };
  }

  private extractTerms(doc: DocumentSnapshot): Set<string> {
    const out = new Set<string>();
    try {
      for (const t of tokenize(doc.title)) out.add(t);
      for (const t of tokenize(doc.content)) out.add(t);
      if (Array.isArray(doc.tags)) for (const tg of doc.tags) {
        const t = (tg || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (t && t.length > 2) out.add(t);
      }
    } catch (_) {}
    return out;
  }
}

export function createInvertedIndex(): InvertedIndex {
  return new InvertedIndexImpl();
}


export class Indexer implements IndexerContract {
  private disposers: Array<() => void> = [];
  private readonly workerPool: WorkerPool;
  private pendingDocs: Array<{ doc: any; id: string; text: string }> = [];
  private processing: boolean = false;

  constructor(events: any, private readonly index: InvertedIndex) {
    // Determine worker count from env or CPU, allowing more headroom (up to 8)
    const envWorkers = (typeof process !== 'undefined' && process.env && process.env.INDEX_WORKERS) ? Number(process.env.INDEX_WORKERS) : undefined;
    const cpus = (() => { try { const os = require('node:os'); return Math.max(1, (os.cpus() || []).length); } catch (_) { return 2; } })();
    const desired = typeof envWorkers === 'number' && !Number.isNaN(envWorkers) ? Math.max(1, Math.floor(envWorkers)) : Math.max(1, Math.floor(Math.max(1, cpus - 1)));
    // Conservative defaults to avoid overloading local CPU and downstream subsystems
    const poolWorkers = Math.min(2, desired);
    // Reduce per-worker chunk sizes to avoid large synchronous batches that can overload the index.
    this.workerPool = new WorkerPool({ numWorkers: poolWorkers, maxDocsPerWorker: 2 });
    if (!events || !this.index) return;
    try {
      const created = (ev: any) => { try { if (ev && ev.document) { this.pendingDocs.push({ doc: ev.document, id: ev.document.id, text: ev.document.content }); try { if (this.pendingDocs.length > 200) { this.pendingDocs.shift(); try { telemetry.emit('indexer_pending_overflow', { pending: this.pendingDocs.length, timestamp: Date.now() }); } catch (_) {} } this.scheduleProcessPending(); } catch (_) {} } } catch (_) {} };
      const updated = (ev: any) => { try { if (ev && ev.current) { this.pendingDocs.push({ doc: ev.current, id: ev.current.id, text: ev.current.content }); try { this.scheduleProcessPending(); } catch (_) {} } } catch (_) {} };
      const deleted = (ev: any) => { try { if (ev && ev.documentId) this.index.removeDocument(ev.documentId); } catch (_) {} };

      if (typeof events.onAsync === 'function') {
        events.onAsync('created', created);
        events.onAsync('updated', updated);
        events.onAsync('deleted', deleted);
        // When registering with onAsync we must remove with offAsync to avoid
        // leaving entries in the asyncListeners map and causing listener leaks
        // / unbounded fan-out on the StorageEventBus.
        this.disposers.push(() => { try { events.offAsync('created', created); } catch (_) {} });
        this.disposers.push(() => { try { events.offAsync('updated', updated); } catch (_) {} });
        this.disposers.push(() => { try { events.offAsync('deleted', deleted); } catch (_) {} });
      } else {
        events.on('created', created);
        events.on('updated', updated);
        events.on('deleted', deleted);
        this.disposers.push(() => { try { events.off('created', created); } catch (_) {} });
        this.disposers.push(() => { try { events.off('updated', updated); } catch (_) {} });
        this.disposers.push(() => { try { events.off('deleted', deleted); } catch (_) {} });
      }
    } catch (_) { /* swallow */ }
  }

  private async processPending(): Promise<void> {
    if (this.pendingDocs.length === 0 || this.processing) return;
      this.processing = true;
    try {
      try { telemetry.emit('indexer_process_start', { pending: this.pendingDocs.length, timestamp: Date.now() }); } catch (_) {}
      // Keep a local copy of pending documents so we can apply the
      // indexing results back into the in-memory index after the worker
      // pool finishes. The worker pool performs CPU-bound tokenization work
      // and yields to the event loop; once that is complete we must update
      // the authoritative InvertedIndex with the latest snapshots.
      const docsToApply = this.pendingDocs.slice();
      await this.workerPool.process(this.pendingDocs.map(d => ({ id: d.id, text: d.text })));

      // Apply processed documents to the index. Use updateDocument which
      // behaves idempotently for new or existing documents (it replaces any
      // prior term mappings and inserts the new snapshot). This ensures the
      // index state reflects the latest document snapshots observed on the bus.
      try {
        for (const p of docsToApply) {
          try { this.index.updateDocument(p.doc); } catch (_) { try { this.index.indexDocument(p.doc); } catch (_) { /* swallow */ } }
        }
      } catch (_) { /* swallow overall apply errors */ }

      this.pendingDocs = [];
      try { telemetry.emit('indexer_process_complete', { timestamp: Date.now() }); } catch (_) {}
    } catch (err) {
      try { telemetry.emit('indexer_process_error', { error: String(err), timestamp: Date.now() }); } catch (_) {}
      // Worker error - retry later
    } finally {
      this.processing = false;
    }
  }

  private scheduleProcessPending(): void {
    try {
      if (this.processing) return;
      if (typeof (globalThis as any).setImmediate === 'function') {
        (globalThis as any).setImmediate(() => void this.processPending());
      } else {
        setTimeout(() => { void this.processPending(); }, 0);
      }
    } catch (_) { /* swallow */ }
  }

  dispose(): void {
    this.workerPool.shutdown();
    for (const d of this.disposers) {
      try { d(); } catch (_) {}
    }
    this.disposers = [];
  }
}
