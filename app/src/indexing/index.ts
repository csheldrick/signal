// Thin facade that re-exports the canonical inverted index implementation.
// Avoids maintaining a parallel legacy implementation and keeps a single
// authoritative index shape (app/src/index/inverted.ts).

// Use a defensive runtime require to avoid ESM import resolution quirks under node16/nodenext.
// This keeps the startup fan-out low while exposing the same named exports.
let _inv: any = undefined;
try {
  _inv = require('../index/inverted.js');
} catch (e1) {
  try {
    // Try without .js extension or the .ts source file as a best-effort
    _inv = require('../index/inverted');
  } catch (e2) {
    try { _inv = require('../index/inverted.ts'); } catch (e3) { _inv = undefined; }
  }
}
export const createInvertedIndex = (_inv && typeof _inv.createInvertedIndex === 'function') ? _inv.createInvertedIndex : (() => undefined as any);
export const Indexer = (_inv && _inv.Indexer) ? _inv.Indexer : undefined;
export type { InvertedIndex } from '../core/types.js';
export type { IndexStats, SearchHit } from '../core/types.js';
