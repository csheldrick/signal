// Thin facade that re-exports the canonical inverted index implementation.
// Avoids maintaining a parallel legacy implementation and keeps a single
// authoritative index shape (app/src/index/inverted.ts).

export { createInvertedIndex, Indexer } from '../index/inverted.js';
export type { InvertedIndex } from '../core/types.js';
export type { IndexStats, SearchHit } from '../core/types.js';
