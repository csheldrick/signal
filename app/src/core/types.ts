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
