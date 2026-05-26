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
import { createDocumentSnapshot } from '../core/types.js';
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

  // Monotonic sequence counter used to assign ordering to persisted buffered
  // mutations. This counter is persisted with the store so that monotonicity
  // is preserved across restarts.
  private seqCounter: number = 0;

  // Durable mutation log for buffered (offline) mutations. Each entry has a
  // monotonic sequence number ensuring deterministic drain order when replayed.
  // The log is persisted alongside documents by save()/load().
  private mutationLog: Array<{ seq: number; id: string; op: string; payload: any }> = [];

  // Track ids of already-applied mutations (at replay-time) to make replay
  // idempotent. This is stored in-memory and persisted as an array on save().
  private appliedMutationIds: Set<string> = new Set();

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

        // Validate the provided events bus to avoid silent disconnection of
    // downstream event-driven subsystems (indexes, graph builders, etc.).
    const isValidBus = (e: any): e is StorageEventBus =>
      e && typeof e.emit === 'function' && typeof e.emitAsync === 'function' && typeof e.on === 'function' && typeof e.off === 'function';

    if (events && !isValidBus(events)) {
      try { console.warn('DocumentStore: provided events object is invalid; creating a new StorageEventBus to avoid index staleness.'); } catch (_) {}
      this.events = new StorageEventBus();
    } else {
      this.events = events ?? new StorageEventBus();
    }
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
    this.events.emitAsync({ type: 'created', document: createDocumentSnapshot(stored), timestamp: now });
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
    this.events.emitAsync({
      type: 'updated',
      documentId: id,
      previous: createDocumentSnapshot(previousSnapshot),
      current: createDocumentSnapshot(updated),
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
          previous: createDocumentSnapshot(c.previous),
          current: createDocumentSnapshot(c.current),
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
    this.events.emitAsync({ type: 'linked', link: { ...link }, timestamp: Date.now() });
    this.opCounts.update++;
    this.events.emitAsync({
      type: 'updated',
      documentId: sourceId,
      previous: createDocumentSnapshot(previous),
      current: createDocumentSnapshot(current),
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
    // Persist documents along with the mutation log and sequence metadata so
    // OfflineSyncQueue / other consumers can durably store buffered mutations
    // in the same backend and resume with deterministic ordering on restart.
    const payload = {
      documents: Array.from(this.documents.values()),
      mutationLog: this.mutationLog,
      seqCounter: this.seqCounter,
      appliedMutationIds: Array.from(this.appliedMutationIds),
    };
    try {
      // Schedule the potentially-heavy filesystem write off the immediate
      // caller path to avoid blocking the event loop in hot paths. Provide
      // a synchronous fallback to preserve durability if scheduling is
      // unavailable.
      try {
        setImmediate(() => {
          try {
            writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
          } catch (_) { /* swallow secondary write errors */ }
        });
      } catch (_) {
        // setImmediate might not be available in some environments; fall
        // back to synchronous write.
        try {
          writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (_) { /* swallow */ }
      }
    } catch (_) {
      // As a last resort, attempt a synchronous write and swallow failures to
      // avoid crashing the host process from save() calls.
      try { writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8'); } catch (_) { /* swallow */ }
    }
  }

  load(filePath: string): void {
    if (!existsSync(filePath)) return;
    const raw = readFileSync(filePath, 'utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      // Corrupt file or unreadable contents; treat as empty store.
      return;
    }

    // Support legacy format (array of documents) and new format (object with
    // documents + mutationLog + seq metadata).
    let docs: Document[] = [];
    if (Array.isArray(parsed)) {
      docs = parsed as Document[];
    } else if (parsed && Array.isArray(parsed.documents)) {
      docs = parsed.documents as Document[];
      // Load mutation log and metadata if present.
      try {
        this.mutationLog = Array.isArray(parsed.mutationLog)
          ? parsed.mutationLog.map((m: any) => ({ seq: Number(m.seq) || 0, id: String(m.id), op: String(m.op), payload: m.payload }))
          : [];
      } catch (_) {
        this.mutationLog = [];
      }

      this.seqCounter = typeof parsed.seqCounter === 'number' ? parsed.seqCounter : (this.mutationLog.length ? Math.max(...this.mutationLog.map(m => m.seq)) : 0);
      try {
        this.appliedMutationIds = new Set<string>(Array.isArray(parsed.appliedMutationIds) ? parsed.appliedMutationIds.map(String) : []);
      } catch (_) {
        this.appliedMutationIds = new Set();
      }
    } else {
      // Unknown format — bail out without mutating in-memory store.
      return;
    }

    this.documents.clear();
    for (const doc of docs) {
      // Insert the document into the in-memory store and emit a 'created' event
      // so existing event-driven validators and consumers can discover loaded
      // documents without directly importing the store.
      const stored = cloneDocument(doc);
      this.documents.set(doc.id, stored);
      this.opCounts.create++;
      // Emit asynchronously to avoid synchronous initialization storms.
      this.events.emitAsync({ type: 'created', document: createDocumentSnapshot(stored), timestamp: Date.now(), seq: undefined });
    }
  }

  /**
   * Record a buffered mutation to the durable mutation log with a monotonic
   * sequence number. Returns the assigned sequence number. This method does
   * not apply the mutation to documents; it merely persists the buffered
   * mutation so OfflineSyncQueue can drain deterministically.
   */
  recordBufferedMutation(mutationId: string, op: 'create' | 'update' | 'delete' | 'link', payload: any): number {
    // Respect idempotency at the logging layer: if a mutation with the same
    // id already appears in the log, return its existing seq.
    const existing = this.mutationLog.find(m => m.id === mutationId);
    if (existing) return existing.seq;

    this.seqCounter += 1;
    const entry = { seq: this.seqCounter, id: mutationId, op, payload };
    this.mutationLog.push(entry);
    return entry.seq;
  }

  /**
   * Replay buffered mutations in monotonically increasing sequence order. The
   * provided applyFn is invoked for each mutation that has not yet been
   * recorded in appliedMutationIds. If applyFn succeeds, the mutation id is
   * marked applied so future replays will be a no-op for duplicates.
   * applyFn may be synchronous or asynchronous; errors from applyFn are
   * caught and swallowed to avoid halting overall replay — callers may wish
   * to inspect returned results or provide a tolerant apply function.
   */
  async replayBufferedMutations(applyFn: (m: { seq: number; id: string; op: string; payload: any }) => Promise<void> | void): Promise<void> {
    // Iterate in seq order to ensure deterministic application.
    const ordered = this.mutationLog.slice().sort((a, b) => a.seq - b.seq);
    for (const m of ordered) {
      if (this.appliedMutationIds.has(m.id)) continue; // idempotent no-op
      try {
        await Promise.resolve(applyFn(m));
        this.appliedMutationIds.add(m.id);
      } catch (_) {
        // Swallow to continue processing subsequent mutations; callers can
        // re-run replay to attempt failed entries later.
      }
    }
  }
}
