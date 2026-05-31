// Thin facade that re-exports the canonical inverted index implementation.
// Avoids maintaining a parallel legacy implementation and keeps a single
// authoritative index shape (app/src/index/inverted.ts).

// Use a defensive runtime require to avoid ESM import resolution quirks under node16/nodenext.
// This keeps the startup fan-out low while exposing the same named exports.
const _inv = require('../index/inverted.js');
export const createInvertedIndex = _inv.createInvertedIndex;
export const Indexer = _inv.Indexer;
export type { InvertedIndex } from '../core/types.js';
export type { IndexStats, SearchHit } from '../core/types.js';
