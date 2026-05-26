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

// Helper clones to prevent leaking internal mutable store objects to callers
function cloneLink(l: import('../core/types.js').DocumentLink): import('../core/types.js').DocumentLink {
  return { ...l };
}

function cloneDocument(d: import('../core/types.js').Document): import('../core/types.js').Document {
  return {
    ...d,
    tags: Array.isArray(d.tags) ? [...d.tags] : [],
    links: Array.isArray(d.links) ? d.links.map(cloneLink) : [],
  };
}


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
    const stored = cloneDocument(doc);
    this.documents.set(id, stored);
    this.opCounts.create++;
    this.events.emit({ type: 'created', document: cloneDocument(stored), timestamp: now });
    return cloneDocument(stored);
  }

  read(id: string): Document | undefined {
    const d = this.documents.get(id);
    return d ? cloneDocument(d) : undefined;
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
      version: (existing.version ?? 0) + 1,
    };

    // Preserve previous snapshot for the event, store the new document, then emit clones
    const previousSnapshot = cloneDocument(existing);
    this.documents.set(id, updated);
    this.opCounts.update++;
    this.events.emit({
      type: 'updated',
      documentId: id,
      previous: previousSnapshot,
      current: cloneDocument(updated),
      timestamp: now,
    });
    return cloneDocument(updated);
  }

  delete(id: string): boolean {
    const existed = this.documents.delete(id);
    if (existed) {
      // When a document is deleted, remove links referencing it and emit
      // update events for any documents whose links changed so downstream
      // consumers (indexer, sync) can maintain a consistent view.
      const changed: Array<{ previous: Document; current: Document }> = [];
      for (const doc of this.documents.values()) {
        const prevLinks = doc.links.slice();
        const filtered = doc.links.filter(l => l.sourceId !== id && l.targetId !== id);
        if (filtered.length !== doc.links.length) {
          const previous = { ...doc, links: prevLinks.map(cloneLink) } as Document;
          doc.links = filtered;
          const current = cloneDocument(doc);
          changed.push({ previous, current });
        }
      }

      for (const c of changed) {
        this.opCounts.update++;
        // Use async emit for the cascade of per-document updates caused by a
        // delete to avoid syncing large numbers of listeners synchronously and
        // creating huge realtime bursts (e.g. graph/index rebuilds).
        this.events.emitAsync({
          type: 'updated',
          documentId: c.current.id,
          previous: c.previous,
          current: c.current,
          timestamp: Date.now(),
        });
      }

      this.opCounts.delete++;
      // Emit deletion asynchronously to avoid immediate heavy downstream processing
      // that can cause subsystem overload when many listeners are registered.
      this.events.emitAsync({ type: 'deleted', documentId: id, timestamp: Date.now() });
    }
    return existed;
  }

  link(sourceId: string, targetId: string, kind: DocumentLink['kind']): DocumentLink | undefined {
    const source = this.documents.get(sourceId);
    const target = this.documents.get(targetId);
    if (!source || !target) return undefined;

    const link: DocumentLink = { sourceId, targetId, kind };
    const previous = cloneDocument(source);
    source.links.push(link);
    const current = cloneDocument(source);

    // Emit both a linked event and a corresponding updated event for consumers
    // that observe document mutations via 'updated' events.
    this.opCounts.link++;
    this.events.emit({ type: 'linked', link: { ...link }, timestamp: Date.now() });
    this.opCounts.update++;
    this.events.emit({
      type: 'updated',
      documentId: sourceId,
      previous,
      current,
      timestamp: Date.now(),
    });

    return { ...link };
  }

  getLinks(documentId: string): DocumentLink[] {
    const doc = this.documents.get(documentId);
    return doc ? doc.links.map(l => ({ ...l })) : [];
  }

  list(): Document[] {
    return Array.from(this.documents.values()).map(d => cloneDocument(d));
  }

  search(query: SearchQuery): SearchResult[] {
    // If no search criteria provided, return a small preview to avoid full scans.
    if (!query || (!query.text && (!query.tags || query.tags.length === 0) && !query.dateRange)) {
      return Array.from(this.documents.values()).slice(0, DocumentStore.DEFAULT_LIST_PREVIEW).map(d => ({ document: cloneDocument(d), score: 0, highlights: [] }));
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
        results.push({ document: cloneDocument(doc), score, highlights });
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
      // Insert the document into the in-memory store and emit a 'created' event
      // so existing event-driven validators and consumers can discover loaded
      // documents without directly importing the store.
      this.documents.set(doc.id, cloneDocument(doc));
      this.opCounts.create++;
      // Use async emit during load to avoid firing many synchronous created events
      // while the system is still initializing. Consumers that need to observe
      // created events synchronously should use the store API directly.
      this.events.emitAsync({ type: 'created', document: cloneDocument(doc), timestamp: Date.now() });
    }
  }
}
