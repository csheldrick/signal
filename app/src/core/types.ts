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

// Minimal, readonly-friendly snapshot used at subsystem/plugin boundaries.
// This mirrors the main Document shape but is explicit to signal the
// lightweight, readonly contract for external consumers such as plugins.
export interface DocumentSnapshot {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: DocumentLink[];
  createdAt: number;
  updatedAt: number;
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

export type DeprecatedDocumentChange = DocumentChange;

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
