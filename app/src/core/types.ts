// ── Core Types ──────────────────────────────────────────────
// Shared type vocabulary for Signal. Every module imports from here,
// making this a high-centrality node in the dependency graph.

export interface Document {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: DocumentLink[];
  createdAt: number;
  updatedAt: number;
  // Optional version field supports lightweight versioning for sync/merge logic.
  version?: number;
}

// Lightweight vector clock used by the sync subsystem and exposed here so
// multiple modules can agree on the shape without importing the concrete
// sync/protocol implementation.
export interface VectorClock {
  [peerId: string]: number;
}

export type SyncState = 'idle' | 'syncing' | 'conflicted' | 'resolved';

export type ConflictStrategy = 'last-write-wins' | 'first-write-wins' | 'merge-content';

export interface PeerInfo {
  peerId: string;
  /** Last vector clock we received from this peer. */
  clock: VectorClock;
  /** Epoch ms of the last successful exchange. */
  lastSeen: number;
  state: SyncState;
}

export interface SyncAck {
  kind: 'ack';
  peerId: string;
  documentId: string;
  clock: VectorClock;
  timestamp: number;
}

export interface ConflictRecord {
  documentId: string;
  localClock: VectorClock;
  remoteClock: VectorClock;
  localTimestamp: number;
  remoteTimestamp: number;
  resolvedBy: ConflictStrategy;
  resolvedAt: number;
}

export interface SyncMessage {
  operation: 'create' | 'update' | 'delete' | 'link';
  documentId: string;
  payload: unknown;
  clock: VectorClock;
  peerId: string;
  timestamp: number;
  messageId?: string;
}

export interface SyncManagerOptions {
  /** Local peer identifier. */
  peerId: string;
  /** Strategy to use when concurrent writes collide. */
  conflictStrategy?: ConflictStrategy;
  /** How often (ms) the flush loop runs. */
  flushIntervalMs?: number;
  /** Optional externally-provided SyncEngine instance to avoid duplicate engine creation. */
  engine?: any;
  /** Optional external session tracker so PresenceTracker and SyncManager can share authoritative sessions. */
  sessionTracker?: { openSession(peerId: string, initialClock?: VectorClock): void; closeSession(peerId: string): void; updateHeartbeat?(peerId: string): void };
  /** Optional snapshot service to compact vector clocks and expose snapshot hooks. */
  snapshotService?: { compactClock?: (clock: VectorClock) => VectorClock };
  /** Optional durable offline queue to persist outbound messages when enqueue fails */
  offlineQueue?: OfflineSyncQueue;
  /** When true, enforce offline-first replay ordering: drain offlineQueue before attaching live store listeners. */
  offlineFirstMode?: boolean;
}

// Minimal, readonly-friendly snapshot used at subsystem/plugin boundaries.
// This mirrors the main Document shape but is explicit to signal the
// lightweight, readonly contract for external consumers such as plugins.

// Deprecated aliases removed: prefer DocumentChange and normalizeDocumentChange.
// For backward compatibility with older callers that import legacy symbols,
// expose lightweight deprecated aliases that map to the canonical types.
// These aliases are intended to be short-lived and provide a gentler
// migration path while keeping the core types strictly defined.

type DeprecatedDocumentChange = DocumentChange & { isDeprecated: boolean; };

/**
 * DeprecatedDocumentStore: removed.
 *
 * This alias has been intentionally set to `never` to cause a compile-time
 * error at any remaining call-sites. The presence of a permissive type here
 * previously prolonged migration and allowed duplicate legacy stores to
 * coexist with the new storage surface. Forcing a type error makes remaining
 * usages explicit and prevents accidental runtime compatibility shims which
 * increase maintenance burden and the risk of divergent state.
 *
 * Migration guidance:
 * - Replace imports of DeprecatedDocumentStore with concrete types from
 *   the storage/ module (e.g. DocumentStore or getOrCreateDocumentStore).
 * - If you relied on a runtime legacy API, update the caller to use the
 *   storage module helpers instead of a global/deprecated abstraction.
 *
 * @deprecated Removed from the public API. Use concrete storage/ module types.
 */
export type DeprecatedDocumentStore = never;

export interface DocumentSnapshot {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly tags: readonly string[];
  readonly links: readonly DocumentLink[];
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Optional version to support lightweight snapshot versioning for sync/merge logic. */
  readonly version?: number;
}

// SnapshotStore contract: lightweight interface used by snapshot services.
// Centralizing this contract in core/types reduces cross-module coupling and
// avoids cyclical imports between storage implementations.
export interface SnapshotStore {
  listDocumentIds(): Promise<string[]>;
  getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | undefined>;
  putSnapshot(documentId: string, snapshot: DocumentSnapshot): Promise<void>;
}

export interface DocumentLink {
  sourceId: string;
  targetId: string;
  kind: LinkKind;
}

export type LinkKind = 'reference' | 'related' | 'derived_from' | 'blocks';

export const VALID_LINK_KINDS: LinkKind[] = ['reference', 'related', 'derived_from', 'blocks'];

export interface SearchQuery {
  text?: string;
  tags?: string[];
  dateRange?: { from: number; to: number };
}

export interface SearchResult {
  document: DocumentSnapshot;
  score: number;
  highlights: string[];
}

// Snapshot variant of search results where the document is a DocumentSnapshot.
export interface SearchResultSnapshot {
  document: DocumentSnapshot;
  score: number;
  highlights: string[];
}

export interface DocumentChange {
  title?: string;
  content?: string;
  tags?: string[];
}

// Offline queue entry shape and options centralized so both the concrete
// OfflineSyncQueue implementation and consumers such as SyncManager can
// depend on a single authoritative definition.
export interface OfflineEntry {
  id: string; // stable id for the queued mutation
  peerId: string;
  documentId: string;
  payload: any;
  timestamp: number;
  seq: number;
}

export interface OfflineSyncQueueOptions {
  /** Directory where offline files are persisted. Defaults to process.cwd() */
  dataDir?: string;
  /** File prefix for per-peer persistent queues */
  filePrefix?: string;
}

// DeprecatedDocumentChange removed: use DocumentChange and normalizeDocumentChange; do NOT import this deprecated alias.

// Utility: create a lightweight, readonly-friendly DocumentSnapshot from a Document.
// Encourages passing snapshots across subsystem boundaries to avoid accidental
// mutation and to reduce memory pressure.
export function isValidDocumentSnapshot(obj: any): obj is DocumentSnapshot {
  if (!obj || typeof obj !== 'object') return false;
  try {
    if (typeof obj.id !== 'string') return false;
    if (typeof obj.title !== 'string') return false;
    if (typeof obj.content !== 'string') return false;

    if (!Array.isArray(obj.tags)) return false;
    if (obj.tags.some((t: any) => typeof t !== 'string')) return false;

    if (!Array.isArray(obj.links)) return false;
    for (const l of obj.links) {
      if (!l || typeof l !== 'object') return false;
      if (typeof l.sourceId !== 'string' || typeof l.targetId !== 'string') return false;
      if (typeof l.kind !== 'string') return false;
      const kinds = VALID_LINK_KINDS;
      if (!kinds.includes(l.kind as LinkKind)) return false;
    }

    if (!Number.isFinite(obj.createdAt) || !Number.isFinite(obj.updatedAt)) return false;
    if (obj.version !== undefined && !Number.isFinite(obj.version)) return false;

    return true;
  } catch (_) {
    return false;
  }
}

export function validateDocumentChange(ch?: DocumentChange): boolean {
  if (ch === undefined || ch === null) return true;

  if (typeof ch !== 'object') return false; // empty change allowed

  // Title: must be string if present and within reasonable length
  if (ch.title !== undefined) {
    if (typeof ch.title !== 'string') return false;
    if (ch.title.length > 5000) return false; // reject pathological titles
  }

  // Content: must be string if present and not excessively large
  if (ch.content !== undefined) {
    if (typeof ch.content !== 'string') return false;
    if (ch.content.length > 200_000) return false; // protect downstream subsystems
  }

  // Tags: must be array of short strings with a sensible cap
  if (ch.tags !== undefined) {
    if (!Array.isArray(ch.tags)) return false;
    if (ch.tags.length > 100) return false;
    if (ch.tags.some(t => typeof t !== 'string' || t.length > 100)) return false;
  }

  return true;
}

/**
 * Normalize a DocumentChange into a safe, bounded shape suitable for passing
 * into heavier subsystems. Returns undefined when the input is invalid.
 * This helps avoid pathological updates (huge strings/arrays) that can overload
 * downstream subsystems (indexing, sync, graph builders).
 */
export function normalizeDocumentChange(ch?: DocumentChange): DocumentChange | undefined {
  if (ch === undefined || ch === null) return undefined;
  if (!validateDocumentChange(ch)) return undefined;

  const out: DocumentChange = {};
  if (typeof ch.title === 'string') {
    out.title = ch.title.length > 5000 ? ch.title.slice(0, 5000) : ch.title;
  }
  if (typeof ch.content === 'string') {
    out.content = ch.content.length > 200_000 ? ch.content.slice(0, 200_000) : ch.content;
  }
  if (Array.isArray(ch.tags)) {
    out.tags = ch.tags.slice(0, 100).map(t => (typeof t === 'string' ? (t.length > 100 ? t.slice(0, 100) : t) : String(t)));
  }

  return out;
}

export function createDocumentSnapshot(doc: Document): DocumentSnapshot {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    tags: Array.isArray(doc.tags) ? [...doc.tags] : [],
    links: Array.isArray(doc.links) ? doc.links.map(l => ({ ...l })) : [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: typeof doc.version === 'number' ? doc.version : undefined,
  };
}

// Normalize SearchQuery inputs to clamp pathological extremes. This protects
// downstream index/search subsystems from extremely large queries.
export function normalizeSearchQuery(q?: SearchQuery): SearchQuery {
  if (!q) return {};
  const out: SearchQuery = {};
  if (typeof q.text === 'string') {
    const t = q.text.trim();
    out.text = t.length > 500 ? t.slice(0, 500) : t;
  }

  if (Array.isArray(q.tags) && q.tags.length > 0) {
    out.tags = q.tags.slice(0, 50);
  }

  if (q.dateRange && typeof q.dateRange === 'object') {
    const from = Number.isFinite(q.dateRange.from) ? q.dateRange.from : 0;
    const to = Number.isFinite(q.dateRange.to) ? q.dateRange.to : Date.now();
    out.dateRange = { from: Math.min(from, to), to: Math.max(from, to) };
  }

  return out;
}

// Lightweight search/indexing contracts to enable an extensible search subsystem
export interface SearchHit {
  documentId: string;
  field: 'title' | 'content' | 'tags';
  snippet?: string;
  score: number;
}

export interface InvertedIndexSearchHit extends SearchHit {
  term: string;
}

export interface IndexStats {
  docCount: number;
  termCount: number;
  // Provide a readonly/top-level view so callers don't hold mutable references to
  // the internal index structures. Returning readonly arrays reduces accidental
  // mutation and encourages consumers to copy when necessary.
  topTerms: ReadonlyArray<{ term: string; count: number }>;
}

// Summarizer contract lives in core types to reduce direct coupling between
// high-level app code and concrete implementations. Implementations may live
// in ai/summarizer.ts but should conform to this lightweight interface.
export interface Summarizer {
  readonly isRemote: boolean;
  /** Whether the implementation is permitted to perform network IO when
   * requested. Implementations that are strictly local should set this to
   * false. */
  readonly allowsNetwork: boolean;
  /** Whether the summarizer is pure/deterministic (no side-effects). */
  readonly isPure: boolean;
  /** Whether it is safe for background jobs (timers, schedulers) to invoke
   * this summarizer. Remote summarizers MUST set this to false to ensure
   * offline-first background processing remains deterministic and network-free. */
  readonly allowBackgroundNetwork?: boolean;
  // Accept either a live Document or a readonly DocumentSnapshot so callers
  // can pass snapshots across subsystem boundaries without forcing a copy.
  summarize(document: Document | DocumentSnapshot): Promise<string>;
  /** Optional: indicate whether the summarizer is currently overloaded and
   * callers should avoid invoking heavy requests. Implementations may provide
   * a cheap synchronous check to allow callers to prefer lightweight paths. */
  isAvailable?(): boolean;

  /** Optional runtime helpers to expose summarizer-level concurrency
   * accounting and acquisition APIs. These instance methods allow callers to
   * coordinate with implementations (without performing reflective access to
   * constructor statics) and reduce subsystem coupling/overload. */
  getGlobalActiveRequests?(): number;
  tryRecordRequest?(): boolean;
  recordRequest?(): void;
  releaseRequest?(): void;
  /** A defensive release which guarantees the global counter is decremented
   * (bounded at zero) even if a normal release call throws for some reason. */
  safeRelease?(): void;
}

// Conflict resolution contract is surfaced here in the core types so higher-level
// modules can depend on the lightweight shape without importing the sync
// subsystem. The concrete ConflictRecord used by the sync layer is intentionally
// not referenced here to avoid coupling; callers that need audit details can
// treat `record` as an opaque value.
export interface ConflictResolution {
  winner: Document;
  record: any;
}

export interface InvertedIndex {
  // Index a document snapshot (idempotent for new ids)
  indexDocument(doc: DocumentSnapshot, maxDocs?: number): void;
  // Update an existing document snapshot
  updateDocument(doc: DocumentSnapshot, maxDocs?: number): void;
  // Remove a document from the index
  removeDocument(documentId: string): void;
  // Search using normalized SearchQuery
  search(query: SearchQuery, maxDocs?: number): SearchResult[];
  // Basic stats for observability
  stats(maxDocs?: number): IndexStats;
}

export interface IndexerContract { dispose(): void; }

// Indexing worker & pool options - centralized contract so other modules
// can depend on a stable type without importing concrete worker pool impls.
export interface IndexWorker { work(): void; }

export interface WorkerPoolOptions {
  numWorkers?: number;
  maxDocsPerWorker?: number;
}

// Presence types centralized so lightweight modules can import the minimal
// contracts without pulling in the full PresenceTracker implementation.
export type PresenceStatus = 'active' | 'idle' | 'offline';

export interface PeerPresence {
  peerId: string;
  documentId: string | undefined;
  status: PresenceStatus;
  lastSeen: number;
  seq: number;
}

export interface PresenceTracker {
  setPluginContext(context?: PluginContext): void;
  setSessionTracker(tracker?: any): void;
  setValidator(validate?: (id: string) => boolean | Promise<boolean>): void;
  setAsyncValidator(validate?: (id: string) => Promise<boolean>): void;
  join(peerId: string, documentId?: string): PeerPresence;
  leave(peerId: string, awaitCleanup?: boolean): Promise<void>;
  getActive(): PeerPresence[];
  getViewers(documentId: string): PeerPresence[];
  focusDocument(peerId: string, documentId: string): Promise<boolean>;
  summary(): { active: number; idle: number; offline: number };
  stopCleanupTimer?(): void;
}

// Document validator types used by PresenceTracker and the StorageEventBus
export type DocumentValidatorAsync = ((id: string) => Promise<boolean>) & { dispose?: () => void };
export type DocumentValidatorSync = ((id: string) => boolean) & { dispose?: () => void };

// Offline sync queue contract used by SyncManager to persist outbound
// messages when transports are unavailable. Keeping a minimal interface
// here avoids importing the concrete class in many places.
export interface OfflineSyncQueue {
	  enqueue(peerId: string, documentId: string, payload: any): Promise<void>;
	  size(peerId: string): number;
	  list(peerId: string): any[];
	  drain(peerId: string, handler: (entry: any) => Promise<void>): Promise<void>;
	  clear(peerId: string): void;
	  dispose(): void;
	}

// Cross-cutting observability contract. Declaring a lightweight Observability
// interface in core types makes the telemetry/metrics/tracing facility visible
// to architectural analysis and allows subsystems to depend on the stable
// contract rather than the concrete implementation.
export interface Observability {
  emit(type: string, payload: any): void;
  on(listener: (event: { type: string; payload: any }) => void): () => void;
  clear(): void;
  /**
   * Optional: return the current number of registered listeners. This helps
   * tests and diagnostic tools assert telemetry subscription state without
   * reaching into concrete implementations.
   */
  listenerCount?(): number;
}

// Storage event types and bus contract centralized here to reduce module
// fan-out and provide a single authoritative contract for other subsystems.
export type StorageEventType = 'created' | 'updated' | 'deleted' | 'linked';

export interface StorageEventCreated {
  readonly type: 'created';
  readonly document: Readonly<DocumentSnapshot>;
  readonly timestamp: number;
  readonly seq?: number;
}

export interface StorageEventUpdated {
  readonly type: 'updated';
  readonly documentId: string;
  readonly previous: Readonly<DocumentSnapshot>;
  readonly current: Readonly<DocumentSnapshot>;
  readonly timestamp: number;
  readonly seq?: number;
}

export interface StorageEventDeleted {
  readonly type: 'deleted';
  readonly documentId: string;
  readonly timestamp: number;
  readonly seq?: number;
}

export interface StorageEventLinked {
  readonly type: 'linked';
  readonly link: Readonly<DocumentLink>;
  readonly timestamp: number;
  readonly seq?: number;
}

export type StorageEvent =
  | StorageEventCreated
  | StorageEventUpdated
  | StorageEventDeleted
  | StorageEventLinked;

// Listener type used by the StorageEventBus
export type StorageEventListener = (event: Readonly<StorageEvent>) => void;

export interface StorageEventBusContract {
  on(type: StorageEventType | '*', listener: StorageEventListener): void;
  onAsync(type: StorageEventType | '*', listener: StorageEventListener): void;
  off(type: StorageEventType | '*', listener: StorageEventListener): void;
  offAsync(type: StorageEventType | '*', listener: StorageEventListener): void;
  emit(event: StorageEvent): void;
  emitAsync(event: StorageEvent): void;
  attachDocumentValidatorFromEvents(initial?: Iterable<string>): DocumentValidatorAsync;
  attachDocumentValidatorSnapshot(initial?: Iterable<string>): DocumentValidatorSync;
  getTrace(): ReadonlyArray<StorageEvent>;
  getListenerCounts(): { total: number; perType: Record<string, number>; asyncTotal: number };
  clearTrace(): void;
  removeAllListeners(): void;
}

// DocumentSnapshotService options surfaced here to reduce coupling with
// storage implementation modules; other subsystems may depend on the
// compaction options without importing the concrete service.
export interface DocumentSnapshotServiceOptions {
  compactionIntervalMs?: number;
  maxClockEntries?: number;
}

// Conflict candidate shaped into core types so higher-level modules can
// reason about potential conflicts without importing the sync subsystem.
export interface ConflictCandidate {
  documentId: string;
  local: DocumentSnapshot;
  localClock: any;
  remote: DocumentSnapshot;
  remoteClock: any;
}

export type ConflictCandidateRecord = ConflictCandidate;

// Plugin contracts: surface lightweight plugin host and sandbox types in
// core/types so other subsystems can depend on stable, centralized
// interfaces rather than importing concrete host implementations. This
// encourages better modularization and makes the intended sandbox
// boundary visible to architectural analysis.
export interface PluginContext {
  listDocuments(): ReadonlyArray<Readonly<DocumentSnapshot>>;
  searchDocuments(query: SearchQuery): ReadonlyArray<Readonly<SearchResultSnapshot>>;
  getDocument(id: string): Readonly<DocumentSnapshot> | undefined;
  getClock(): { [peerId: string]: number };
  onStorageEvent(type: StorageEventType | '*', listener: StorageEventListener): () => void;
  summarizeDocument(documentId: string, allowNetwork?: boolean): Promise<string | undefined>;
}

export interface Plugin {
  id: string;
  name: string;
  readonly auditId?: string;
  readonly usesPluginContext?: boolean;
  activate(context: PluginContext): void;
  deactivate(): void;
}

export interface PluginHost {
  register(plugin: Plugin): void;
  enable(pluginId: string): boolean;
  disable(pluginId: string): boolean;
  list(): Array<{ id: string; name: string; enabled: boolean }>;
}
