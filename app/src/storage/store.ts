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
import { createDocumentSnapshot, validateDocumentChange, VALID_LINK_KINDS, normalizeSearchQuery, normalizeDocumentChange } from '../core/types.js';
import { StorageEventBus } from './events.js';
export type { StorageEvent } from './events.js';
import type { StorageEvent } from '../core/types.js';

// Helper clones to prevent leaking internal mutable store objects to callers
function cloneLink(l: import('../core/types.js').DocumentLink): import('../core/types.js').DocumentLink {
  return { ...l };
}

function cloneDocument(d: import('../core/types.js').Document | import('../core/types.js').DocumentSnapshot): import('../core/types.js').Document {
  // Explicitly construct a mutable Document from either a Document or a
  // readonly DocumentSnapshot to avoid carrying readonly array types (e.g.
  // tags: readonly string[]) into the mutable Document shape which would
  // break assignments to Map<string, Document> and other mutable consumers.
  const anyD: any = d;
  return {
    id: String(anyD.id),
    title: String(anyD.title),
    content: String(anyD.content),
    tags: Array.isArray(anyD.tags) ? Array.from(anyD.tags) as string[] : [],
    links: Array.isArray(anyD.links) ? anyD.links.map(cloneLink) : [],
    createdAt: Number(anyD.createdAt) || Date.now(),
    updatedAt: Number(anyD.updatedAt) || Date.now(),
    version: typeof anyD.version === 'number' ? anyD.version : undefined,
  };
}


export const SYM_SYNC_ENGINE = Symbol('signal:sync-engine');
export const SYM_PERSISTED_CLOCKS = Symbol('signal:persisted-clocks');


// Singleton helper to reduce accidental multiple DocumentStore instances
// which can lead to divergent state and make tests/observability brittle.
let __singletonDocumentStore: DocumentStore | undefined;

/**
 * Obtain a shared DocumentStore instance. Prefer this in application code
 * to avoid creating multiple independent stores which complicate testing
 * and instrumentation. Calling code may still construct a private store
 * using `new DocumentStore(...)` for advanced scenarios.
 */
export function getOrCreateDocumentStore(events?: StorageEventBus): DocumentStore {
  if (__singletonDocumentStore) return __singletonDocumentStore;
  __singletonDocumentStore = new DocumentStore(events);
  return __singletonDocumentStore;
}

export class DocumentStore {
  // Event batching queue to smooth spikes of StorageEventBus emissions.
  // Many parts of the system (indexer, graph builder, plugins) attach
  // listeners to the StorageEventBus; emitting thousands of events in a
  // tight loop can overload those subsystems. We buffer events locally and
  // flush them in bounded-size batches using the macrotask queue.
  private _eventQueue: any[] = [];
  private _eventFlushScheduled: boolean = false;
  private static readonly _EVENT_MAX_FLUSH = 3; // max events per flush (smaller batch to reduce per-tick work)
  private static readonly _EVENT_MAX_QUEUE = 10; // max queued events (drop oldest beyond this to bound memory) 

  private emitAsyncEvent(ev: any): void {
    try {
      if (!Array.isArray(this._eventQueue)) this._eventQueue = [];
      // Bound the queue to avoid unbounded memory growth during sustained
      // bursts; drop oldest entries if necessary to keep memory bounded.
      try {
        if (this._eventQueue.length >= DocumentStore._EVENT_MAX_QUEUE) {
          // drop oldest to make room
          this._eventQueue.shift();
        }
      } catch (_) { /* swallow */ }

      this._eventQueue.push(ev);

      if (this._eventFlushScheduled) return;
      this._eventFlushScheduled = true;

      const flush = () => {
        try {
          this._eventFlushScheduled = false;
          const toSend = this._eventQueue.splice(0, DocumentStore._EVENT_MAX_FLUSH);
          for (const e of toSend) {
            try {
              if (this.events && typeof (this.events as any).emitAsync === 'function') {
                try { (this.events as any).emitAsync(e); } catch (_) { try { (this.events as any).emit(e); } catch (_) { /* swallow */ } }
              } else if (this.events && typeof (this.events as any).emit === 'function') {
                try { (this.events as any).emit(e); } catch (_) { /* swallow */ }
              }
            } catch (_) { /* swallow per-event errors */ }
          }
        } catch (_) { /* swallow flush errors */ }

        // If queue still has items, schedule another flush to avoid monopolizing
        // a single macrotask while still smoothing bursts across multiple ticks.
        try {
          if (this._eventQueue.length > 0) {
            try { setImmediate(flush); } catch (_) { setTimeout(flush, 0); }
          }
        } catch (_) { /* swallow scheduling errors */ }
      };

      try { setImmediate(flush); } catch (_) { setTimeout(flush, 0); }
    } catch (_) { /* swallow overall errors to avoid breaking callers */ }
  }
  private static _instances = 0;

  // Optional synchronous auth validator. If set, operations such as create/update/delete/recordBufferedMutation
  // will consult this validator and reject unauthorized mutations. The validator must be synchronous and
  // return a truthy value to allow the operation. Asynchronous validators are not supported on the realtime path.
  private authValidator?: (op: string, payload: any) => boolean;

  setAuthValidator(fn?: (op: string, payload: any) => boolean): void {
    try {
      this.authValidator = typeof fn === 'function' ? fn : undefined;
    } catch (_) {
      this.authValidator = undefined;
    }
  }

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
  private static readonly MAX_SEARCH_RESULTS = 10; // reduced to limit search result payloads
  private static readonly DEFAULT_LIST_PREVIEW = 10; // reduced default preview size to limit event payloads

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

  getSyncEngine(): any | undefined {
    try {
      return (this as any)[SYM_SYNC_ENGINE];
    } catch (_) {
      return undefined;
    }
  }

  setSyncEngine(engine: any): void {
    try {
      // Use a non-enumerable symbol-backed property to avoid leaking on iteration
      Object.defineProperty(this, SYM_SYNC_ENGINE, { value: engine, writable: true, configurable: true });
    } catch (_) {
      // Best-effort fallback for constrained environments
      try { (this as any)[String(SYM_SYNC_ENGINE)] = engine; } catch (_) { /* swallow */ }
    }
  }

  /** Persisted vector-clock helpers. These allow the store to carry a
   * durable snapshot of known vector-clock entries so sync engines can
   * restore causally-relevant state across restarts. Stored as a
   * non-enumerable symbol-backed property to avoid leaking on iteration. */
  getPersistedClocks(): { [peerId: string]: number } | undefined {
    try {
      return (this as any)[SYM_PERSISTED_CLOCKS];
    } catch (_) {
      return undefined;
    }
  }

  setPersistedClocks(clocks?: { [peerId: string]: number }): void {
    try {
      if (clocks === undefined) {
        try { delete (this as any)[SYM_PERSISTED_CLOCKS]; } catch (_) { (this as any)[SYM_PERSISTED_CLOCKS] = undefined; }
        return;
      }
      Object.defineProperty(this, SYM_PERSISTED_CLOCKS, { value: clocks, writable: true, configurable: true });
    } catch (_) {
      try { (this as any)[String(SYM_PERSISTED_CLOCKS)] = clocks; } catch (_) { /* swallow */ }
    }
  }

  /**
   * Return a snapshot of operation counters for observability and tests.
   */
  getOpCounts(): { create: number; update: number; delete: number; link: number } {
    try { return { ...this.opCounts }; } catch (_) { return { create: 0, update: 0, delete: 0, link: 0 }; }
  }

  /** Reset operation counters to zero. Useful for deterministic tests. */
  resetOpCounts(): void {
    try { this.opCounts = { create: 0, update: 0, delete: 0, link: 0 }; } catch (_) { /* swallow */ }
  }

  /** Return the number of DocumentStore instances created in this process. Useful for diagnostics. */
  static getInstanceCount(): number {
    try { return DocumentStore._instances; } catch (_) { return 0; }
  }

  create(id: string, title: string, content: string, tags: string[] = []): Document {
    // Defensive validation to protect downstream subsystems from malformed inputs.
    if (typeof title !== 'string' || typeof content !== 'string') {
      throw new Error('DocumentStore.create: invalid title or content');
    }
    if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string')) {
      throw new Error('DocumentStore.create: invalid tags');
    }

    // Authorization hook: if present, enforce synchronous authorization predicate.
    // NOTE: create is part of the realtime API surface and callers/types assume
    // it returns a Document synchronously. To preserve that contract we throw
    // synchronously on authorization failure rather than returning undefined.
    try {
      if (typeof (this as any).authValidator === 'function') {
        try {
          const allowed = (this as any).authValidator('create', { id, title, content, tags });
          if (!allowed) {
            try { console.warn('DocumentStore.create: unauthorized'); } catch (_) {}
            throw new Error('DocumentStore.create: unauthorized');
          }
        } catch (e) {
          // If the validator itself throws, fail closed to avoid applying
          // potentially unauthorized mutations.
          throw new Error('DocumentStore.create: unauthorized');
        }
      }
    } catch (e) {
      // Propagate the authorization failure as an exception to keep the
      // API deterministic and type-stable for callers.
      throw e instanceof Error ? e : new Error('DocumentStore.create: unauthorized');
    }

    // Clamp inputs to reasonable bounds to avoid passing pathological
    // payloads into downstream subsystems (indexers, sync, graph builders).
    const safeTitle = title.length > 5000 ? title.slice(0, 5000) : title;
    const safeContent = content.length > 200_000 ? content.slice(0, 200_000) : content;
    const safeTags = Array.isArray(tags) ? tags.slice(0, 100).map(t => (typeof t === 'string' ? (t.length > 100 ? t.slice(0, 100) : t) : String(t))) : [];

    const now = Date.now();
    const doc: Document = {
      id,
      title: safeTitle,
      content: safeContent,
      tags: safeTags,
      links: [],
      createdAt: now,
      updatedAt: now,
    };
    const stored = cloneDocument(doc);
    this.documents.set(id, stored);
    this.opCounts.create++;
    this.emitAsyncEvent({ type: 'created', document: createDocumentSnapshot(stored), timestamp: now });
    return cloneDocument(stored);
  }

  read(id: string): Document | undefined {
    const d = this.documents.get(id);
    return d ? cloneDocument(d) : undefined;
  }

  update(id: string, changes: DocumentChange): Document | undefined {
    // Normalize and validate the change object to enforce the core input boundary
    // and to clamp pathological updates which can overload downstream subsystems.
    const normalized = normalizeDocumentChange(changes);
    if (normalized === undefined) {
      try { console.warn('DocumentStore.update: rejected invalid or oversized changes'); } catch (_) {}
      return undefined;
    }

    const existing = this.documents.get(id);
    // Authorization hook: enforce synchronous validator if present.
    try {
      if (typeof (this as any).authValidator === 'function') {
        try {
          const allowed = (this as any).authValidator('update', { id, changes: normalized });
          if (!allowed) {
            try { console.warn('DocumentStore.update: unauthorized'); } catch (_) {}
            return undefined;
          }
        } catch (_) {
          return undefined;
        }
      }
    } catch (_) {}

    if (!existing) return undefined;

    const now = Date.now();
    const updated: Document = {
      ...existing,
      ...normalized,
      links: existing.links,
      updatedAt: now,
      version: (existing.version ?? 0) + 1,
    };

    // Preserve previous snapshot for the event, store the new document, then emit clones
    const previousSnapshot = cloneDocument(existing);
    this.documents.set(id, updated);
    this.opCounts.update++;
    this.emitAsyncEvent({
      type: 'updated',
      documentId: id,
      previous: createDocumentSnapshot(previousSnapshot),
      current: createDocumentSnapshot(updated),
      timestamp: now,
    });
    return cloneDocument(updated);
  }

  delete(id: string): boolean {
    // Authorization hook: enforce synchronous validator if present.
    try {
      if (typeof (this as any).authValidator === 'function') {
        try {
          const allowed = (this as any).authValidator('delete', { id });
          if (!allowed) {
            try { console.warn('DocumentStore.delete: unauthorized'); } catch (_) {}
            return false;
          }
        } catch (_) {
          return false;
        }
      }
    } catch (_) {}
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
        this.emitAsyncEvent({
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
      this.emitAsyncEvent({ type: 'deleted', documentId: id, timestamp: Date.now() });
    }
    return existed;
  }

  link(sourceId: string, targetId: string, kind: DocumentLink['kind']): DocumentLink | undefined {
    const source = this.documents.get(sourceId);
    const target = this.documents.get(targetId);
    if (!source || !target) return undefined;

    // Authorization hook: enforce synchronous validator if present.
    try {
      if (typeof (this as any).authValidator === 'function') {
        try {
          const allowed = (this as any).authValidator('link', { sourceId, targetId, kind });
          if (!allowed) {
            try { console.warn('DocumentStore.link: unauthorized'); } catch (_) {}
            return undefined;
          }
        } catch (_) {
          return undefined;
        }
      }
    } catch (_) {}

    // Validate the provided link kind against the canonical list to avoid
    // propagating unknown/typo'd kinds across subsystems.
    if (!VALID_LINK_KINDS.includes(kind as any)) {
      try { console.warn(`DocumentStore.link: invalid link kind '${String(kind)}'`); } catch (_) {}
      return undefined;
    }

    const link: DocumentLink = { sourceId, targetId, kind };
    const previous = cloneDocument(source);
    source.links.push(link);
    const current = cloneDocument(source);

    // Emit both a linked event and a corresponding updated event for consumers
    // that observe document mutations via 'updated' events.
    this.opCounts.link++;
    this.emitAsyncEvent({ type: 'linked', link: { ...link }, timestamp: Date.now() });
    this.opCounts.update++;
    this.emitAsyncEvent({
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
    // Normalize the query to clamp pathological inputs and protect downstream
    // subsystems (indexers/searchers). Use readonly DocumentSnapshot for
    // results to avoid leaking mutable internal Document objects.
    const q = normalizeSearchQuery(query);

    // If normalized query is empty, return a small preview of snapshots to
    // avoid a full scan and to bound result size.
    if (!q || (!q.text && (!q.tags || q.tags.length === 0) && !q.dateRange)) {
      return Array.from(this.documents.values())
        .slice(0, DocumentStore.DEFAULT_LIST_PREVIEW)
        .map(d => ({ document: createDocumentSnapshot(d), score: 0, highlights: [] }));
    }

    const results: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      let score = 0;
      const highlights: string[] = [];

      if (q.text) {
        const lower = q.text.toLowerCase();
        if (doc.title.toLowerCase().includes(lower)) {
          score += 2;
          highlights.push(doc.title);
        }
        if (doc.content.toLowerCase().includes(lower)) {
          score += 1;
          highlights.push(doc.content.substring(0, 100));
        }
      }

      if (q.tags && q.tags.length > 0) {
        const matched = q.tags.filter(t => doc.tags.includes(t));
        score += matched.length;
      }

      if (q.dateRange) {
        if (doc.updatedAt < q.dateRange.from || doc.updatedAt > q.dateRange.to) {
          continue;
        }
      }

      if (score > 0) {
        results.push({ document: createDocumentSnapshot(doc), score, highlights });
      }

      if (results.length >= DocumentStore.MAX_SEARCH_RESULTS) break;
    }

    // Sort by score and cap results before returning to callers.
    return results.sort((a, b) => b.score - a.score).slice(0, DocumentStore.MAX_SEARCH_RESULTS);
  }

  save(filePath: string): void {
    // Persist documents along with the mutation log and sequence metadata so
    // OfflineSyncQueue / other consumers can durably store buffered mutations
    // in the same backend and resume with deterministic ordering on restart.
    // Implement atomic write-then-rename with rotation to retain at least two
    // recent snapshots. The write work is scheduled off the immediate caller
    // path to avoid blocking live write paths.
    const payload = {
      documents: Array.from(this.documents.values()),
      mutationLog: this.mutationLog,
      seqCounter: this.seqCounter,
      appliedMutationIds: Array.from(this.appliedMutationIds),
      persistedClocks: this.getPersistedClocks ? this.getPersistedClocks() : undefined,
    };

    const data = JSON.stringify(payload, null, 2);

    const writeWork = () => {
      try {
        // Use require here so we don't need to change module-level imports.
        const fs = require('node:fs');
        const path = require('node:path');

        const tmpPath = `${filePath}.tmp`;
        const prev1 = `${filePath}.prev`;
        const prev2 = `${filePath}.prev2`;

        try {
          // Rotate previous snapshots: prev1 -> prev2, current -> prev1
          if (fs.existsSync(prev1)) {
            try { fs.renameSync(prev1, prev2); } catch (_) { /* best-effort */ }
          }
          if (fs.existsSync(filePath)) {
            try { fs.renameSync(filePath, prev1); } catch (_) { /* best-effort */ }
          }
        } catch (_) {
          // Rotation best-effort — do not fail the write if rotation fails.
        }

        try {
          // Write to a temporary file first then atomically rename into place.
          fs.writeFileSync(tmpPath, data, 'utf-8');
        } catch (e) {
          // If writing the temp file fails, attempt a direct write as last resort.
          try { fs.writeFileSync(filePath, data, 'utf-8'); } catch (_) { /* swallow to avoid crashing host */ }
          return;
        }

        try {
          fs.renameSync(tmpPath, filePath);
        } catch (e) {
          // If rename fails, attempt to copy and then unlink tmp to leave a
          // best-effort durable state.
          try {
            try { fs.copyFileSync(tmpPath, filePath); } catch (_) { /* swallow */ }
            try { fs.unlinkSync(tmpPath); } catch (_) { /* swallow */ }
          } catch (_) { /* swallow all */ }
        }
      } catch (_) {
        // Swallow filesystem-related errors to avoid crashing the host process.
      }
    };

    // Schedule the write off the immediate caller path, falling back to
    // synchronous execution if scheduling primitives are unavailable.
    try {
      setImmediate(writeWork);
    } catch (_) {
      try { writeWork(); } catch (_) { /* swallow */ }
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

      // Load persisted clocks if present so sync engines can restore vector-clock state
      try {
        if (parsed && parsed.persistedClocks && typeof parsed.persistedClocks === 'object' && this.setPersistedClocks) {
          try { this.setPersistedClocks(parsed.persistedClocks); } catch (_) { /* swallow */ }
        }
      } catch (_) { /* swallow */ }
    } else {
      // Unknown format — bail out without mutating in-memory store.
      return;
    }

    this.documents.clear();
    const createdEvents: any[] = [];
    for (const doc of docs) {
      // Insert the document into the in-memory store and queue a 'created' event
      // so existing event-driven validators and consumers can discover loaded
      // documents without directly importing the store.
      const stored = cloneDocument(doc);
      this.documents.set(doc.id, stored);
      this.opCounts.create++;
      // Defer emission into a single macrotask to reduce StorageEventBus fan-out
      // during load initialization. Limit the number of emitted events during
      // initial load to avoid overwhelming subscribers on large datasets.
      createdEvents.push({ type: 'created', document: createDocumentSnapshot(stored), timestamp: Date.now(), seq: undefined });
    }

    if (createdEvents.length > 0) {
      try {
        // Limit the number of events we actually emit during load to a conservative cap.
        const MAX_LOAD_EMIT = 50;
        const toEmit = createdEvents.slice(0, MAX_LOAD_EMIT);
        setTimeout(() => {
          for (const ev of toEmit) {
            try { this.emitAsyncEvent(ev); } catch (_) { /* swallow individual emit errors */ }
          }
        }, 0);
      } catch (_) {
        // Timers may be unavailable in some environments; fall back to emitting
        // using the existing emitAsync to preserve behavior while avoiding a
        // synchronous flood inside the load loop.
        const MAX_LOAD_EMIT = 50;
        const toEmit = createdEvents.slice(0, MAX_LOAD_EMIT);
        for (const ev of toEmit) {
          try { this.emitAsyncEvent(ev); } catch (_) { /* swallow */ }
        }
      }
    }
  }

  /**
   * Record a buffered mutation to the durable mutation log with a monotonic
   * sequence number. Returns the assigned sequence number. This method does
   * not apply the mutation to documents; it merely persists the buffered
   * mutation so OfflineSyncQueue can drain deterministically.
   */
  recordBufferedMutation(mutationId: string, op: 'create' | 'update' | 'delete' | 'link', payload: any): number {
    // Guard against accidental use of a document id as the mutation id.
    // If callers accidentally pass a document id as the mutation id (common
    // shapes include payload.documentId or payload.change.id), generate a
    // distinct mutation id to avoid idempotency collisions and nondeterministic
    // replay behavior.
    try {
      const maybeDocId = payload && typeof payload === 'object'
        ? (payload.documentId ?? (payload.payload && payload.payload.documentId) ?? (payload.change && payload.change.id) ?? (payload.payload && payload.payload.change && payload.payload.change.id))
        : undefined;
      if (maybeDocId !== undefined && String(maybeDocId) === String(mutationId)) {
        try { console.warn('DocumentStore.recordBufferedMutation: mutationId appears to equal a document id; generating distinct mutation id to avoid collisions'); } catch (_) {}
        mutationId = mutationId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
      }
    } catch (_) { /* swallow */ }

    // Respect idempotency at the logging layer: if a mutation with the same
    // id already appears in the log, return its existing seq.
    const existing = this.mutationLog.find(m => m.id === mutationId);
    if (existing) return existing.seq;

    // Sanitize payload when it appears to contain DocumentChange shapes so
    // we do not persist unbounded content into the durable mutation log.
    try {
      if (payload && typeof payload === 'object') {
        // Common shapes: { change: DocumentChange } or { payload: { change: DocumentChange } }
        let candidate: any = undefined;
        if (payload.change !== undefined) candidate = payload.change;
        else if (payload.payload && payload.payload.change !== undefined) candidate = payload.payload.change;

        if (candidate !== undefined) {
          const normalized = normalizeDocumentChange(candidate);
          if (normalized !== undefined) {
            if (payload.change !== undefined) payload.change = normalized;
            else if (payload.payload && payload.payload.change !== undefined) payload.payload.change = normalized;
          } else {
            // Replace with a lightweight empty change to avoid persisting huge blobs
            if (payload.change !== undefined) payload.change = {};
            else if (payload.payload && payload.payload.change !== undefined) payload.payload.change = {};
          }
        }
      }
    } catch (_) { /* swallow normalization errors */ }

    // Authorization hook: enforce synchronous validator if present.
    try {
      if (typeof (this as any).authValidator === 'function') {
        try {
          const allowed = (this as any).authValidator(op, { mutationId, payload });
          if (!allowed) {
            try { console.warn('DocumentStore.recordBufferedMutation: unauthorized'); } catch (_) {}
            return 0;
          }
        } catch (_) {
          return 0;
        }
      }
    } catch (_) {}
    this.seqCounter += 1;
    const entry = { seq: this.seqCounter, id: mutationId, op, payload };
    this.mutationLog.push(entry);

    // Best-effort: if a host configures a persistent store filepath via the
    // global __SIGNAL_STORE_FILEPATH we attempt to flush the store to disk
    // immediately so buffered mutations are durable across process restarts.
    // This keeps the API backwards-compatible while improving offline durability
    // in deployments that opt-in to a file-backed store.
    try {
      const configured = (globalThis as any).__SIGNAL_STORE_FILEPATH;
      if (typeof configured === 'string' && configured.length > 0) {
        try { this.save(configured); } catch (_) { /* swallow persistence errors */ }
      }
    } catch (_) { /* swallow */ }

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
        // Best-effort persist of applied markers to make replay idempotency durable
        // across process restarts. If a host configures __SIGNAL_STORE_FILEPATH
        // we attempt to save so already-applied entries are less likely to be
        // replayed after a crash.
        try {
          const configured = (globalThis as any).__SIGNAL_STORE_FILEPATH;
          if (typeof configured === 'string' && configured.length > 0) {
            try { this.save(configured); } catch (_) { /* swallow */ }
          }
        } catch (_) { /* swallow */ }
      } catch (_) {
        // Swallow to continue processing subsequent mutations; callers can
        // re-run replay to attempt failed entries later.
      }
    }
  }

  // Public, explicit helpers for mutation-log manipulation and inspection.
  // These replace the previous fragile runtime prototype augmentation with
  // first-class APIs on the store. They provide deterministic, testable
  // operations and a stable surface for instrumentation and tooling.

  getMutationLog(): ReadonlyArray<{ seq: number; id: string; op: string; payload: any }> {
    try {
      const copy = Array.isArray(this.mutationLog) ? this.mutationLog.slice() : [];
      copy.sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));
      return copy.map((e: any) => ({ seq: e.seq, id: e.id, op: e.op, payload: e.payload }));
    } catch (_) {
      return [];
    }
  }

  markMutationApplied(id: string): void {
    try {
      this.appliedMutationIds.add(String(id));
    } catch (_) { /* swallow */ }
  }

  trimAppliedMutations(): void {
    try {
      if (!Array.isArray(this.mutationLog) || this.mutationLog.length === 0) return;
      const applied = this.appliedMutationIds || new Set<string>();
      // Keep entries that are not recorded applied yet.
      this.mutationLog = this.mutationLog.filter((e: any) => !applied.has(String(e.id)));
    } catch (_) { /* swallow */ }
  }

  /**
   * Compatibility wrapper that assigns a monotonic seq for a buffered mutation.
   * Prefer recordBufferedMutation(mutationId, op, payload) for explicit id
   * semantics. This method provides a backward-compatible name used by some
   * callers and forwards to the authoritative recordBufferedMutation.
   */
  enqueueOfflineMutation(op: 'create' | 'update' | 'delete' | 'link', mutationIdOrPayload: any, payload?: any): number {
    try {
      let mutationId = mutationIdOrPayload;
      let finalPayload = payload;

      // Backwards-compat: callers may call enqueueOfflineMutation(op, payload)
      // (omitting an explicit mutation id). Detect that shape and generate a
      // stable-looking unique mutation id.
      if (finalPayload === undefined && mutationIdOrPayload && typeof mutationIdOrPayload === 'object') {
        finalPayload = mutationIdOrPayload;
        mutationId = 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
      }

      // If a caller supplied a mutation id that appears to equal a document id
      // contained in the payload, expand it to avoid identity collisions.
      try {
        const maybeDocId = finalPayload && typeof finalPayload === 'object'
          ? (finalPayload.documentId ?? (finalPayload.payload && finalPayload.payload.documentId) ?? (finalPayload.change && finalPayload.change.id) ?? (finalPayload.payload && finalPayload.payload.change && finalPayload.payload.change.id))
          : undefined;
        if (maybeDocId !== undefined && mutationId !== undefined && String(maybeDocId) === String(mutationId)) {
          try { console.warn('DocumentStore.enqueueOfflineMutation: provided mutation id appears to be a document id; generating a distinct mutation id to avoid idempotency collisions'); } catch (_) {}
          mutationId = String(mutationId) + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
        }
      } catch (_) { /* swallow detection errors */ }

      return this.recordBufferedMutation(String(mutationId), op, finalPayload);
    } catch (_) {
      // Best-effort fallback
      try { return 0; } catch (_) { return 0; }
    }
  }

  /** Alias for replayBufferedMutations kept for compatibility */
  async replayMutationLog(replayer: (entry: { seq: number; id: string; op: string; payload: any }) => Promise<void> | void): Promise<void> {
    return this.replayBufferedMutations(replayer);
  }
}
