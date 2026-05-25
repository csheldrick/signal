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
  document: Document;
  score: number;
  highlights: string[];
}

export interface DocumentChange {
  title?: string;
  content?: string;
  tags?: string[];
}
