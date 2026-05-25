// ── Document Store ──────────────────────────────────────────
// In-memory document CRUD with JSON persistence.
// Hub node in the dependency graph — multiple modules depend on this.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type {
  Document,
  DocumentLink,
  SearchQuery,
  SearchResult,
  DocumentChange,
} from '../core/types.js';
import { StorageEventBus } from './events.js';
export type { StorageEvent } from './events.js';
import type { StorageEvent } from './events.js';

export class DocumentStore {
  private static _instances = 0;

  private documents: Map<string, Document> = new Map();
  readonly events: StorageEventBus;

  // Operation counters for basic observability
  private opCounts: { create: number; update: number; delete: number; link: number } = {
    create: 0,
    update: 0,
    delete: 0,
    link: 0,
  };

  // Soft limits to avoid unbounded work for naive callers
  private static readonly MAX_SEARCH_RESULTS = 100;
  private static readonly DEFAULT_LIST_PREVIEW = 100;

  constructor(events?: StorageEventBus) {
    DocumentStore._instances += 1;
    if (DocumentStore._instances > 1) {
      console.warn('Multiple DocumentStore instances detected; this may lead to divergent state. Prefer a single shared instance.');
    }

    this.events = events ?? new StorageEventBus();
  }

  create(id: string, title: string, content: string, tags: string[] = []): Document {
    const now = Date.now();
    const doc: Document = {
      id,
      title,
      content,
      tags,
      links: [],
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, doc);
    this.events.emit({ type: 'created', document: doc, timestamp: now });
    return doc;
  }

  read(id: string): Document | undefined {
    return this.documents.get(id);
  }

  update(id: string, changes: DocumentChange): Document | undefined {
    const existing = this.documents.get(id);
    if (!existing) return undefined;

    const now = Date.now();
    const updated: Document = {
      ...existing,
      ...changes,
      links: existing.links,
      updatedAt: now,
    };
    this.documents.set(id, updated);
    this.events.emit({
      type: 'updated',
      documentId: id,
      previous: existing,
      current: updated,
      timestamp: now,
    });
    return updated;
  }

  delete(id: string): boolean {
    const existed = this.documents.delete(id);
    if (existed) {
      // Remove links referencing deleted document
      for (const doc of this.documents.values()) {
        doc.links = doc.links.filter(
          l => l.sourceId !== id && l.targetId !== id,
        );
      }
      this.events.emit({ type: 'deleted', documentId: id, timestamp: Date.now() });
    }
    return existed;
  }

  link(sourceId: string, targetId: string, kind: DocumentLink['kind']): DocumentLink | undefined {
    const source = this.documents.get(sourceId);
    const target = this.documents.get(targetId);
    if (!source || !target) return undefined;

    const link: DocumentLink = { sourceId, targetId, kind };
    source.links.push(link);
    this.events.emit({ type: 'linked', link, timestamp: Date.now() });
    return link;
  }

  getLinks(documentId: string): DocumentLink[] {
    const doc = this.documents.get(documentId);
    return doc ? [...doc.links] : [];
  }

  list(): Document[] {
    return Array.from(this.documents.values());
  }

  search(query: SearchQuery): SearchResult[] {
    // If no search criteria provided, return a small preview to avoid full scans.
    if (!query || (!query.text && (!query.tags || query.tags.length === 0) && !query.dateRange)) {
      return Array.from(this.documents.values()).slice(0, DocumentStore.DEFAULT_LIST_PREVIEW).map(d => ({ document: d, score: 0, highlights: [] }));
    }

    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      let score = 0;
      const highlights: string[] = [];

      if (query.text) {
        const lower = query.text.toLowerCase();
        if (doc.title.toLowerCase().includes(lower)) {
          score += 2;
          highlights.push(doc.title);
        }
        if (doc.content.toLowerCase().includes(lower)) {
          score += 1;
          highlights.push(doc.content.substring(0, 100));
        }
      }

      if (query.tags && query.tags.length > 0) {
        const matched = query.tags.filter(t => doc.tags.includes(t));
        score += matched.length;
      }

      if (query.dateRange) {
        if (doc.updatedAt < query.dateRange.from || doc.updatedAt > query.dateRange.to) {
          continue;
        }
      }

      if (score > 0) {
        results.push({ document: doc, score, highlights });
      }

      if (results.length >= DocumentStore.MAX_SEARCH_RESULTS) break;
    }

    return results.sort((a, b) => b.score - a.score).slice(0, DocumentStore.MAX_SEARCH_RESULTS);
  }

  save(filePath: string): void {
    const data = Array.from(this.documents.values());
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  load(filePath: string): void {
    if (!existsSync(filePath)) return;
    const raw = readFileSync(filePath, 'utf-8');
    const docs = JSON.parse(raw) as Document[];
    this.documents.clear();
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }
  }
}
