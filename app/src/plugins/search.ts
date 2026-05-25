// ── Search Plugin ───────────────────────────────────────────
// ⚠️ DELIBERATE BOUNDARY VIOLATION
// This plugin imports DocumentStore directly instead of using PluginContext.
// Loom should detect this as a cross-subsystem dependency edge.
// Weave's ContradictionDetectionOperator should surface it as a tension.

import type { Plugin, PluginContext } from './host.js';
import type { DocumentStore } from '../storage/store.js';  // ← VIOLATION
import type { SearchQuery, SearchResult } from '../core/types.js';

export class SearchPlugin implements Plugin {
  readonly id = 'search';
  readonly name = 'Advanced Search';
  private store: DocumentStore | undefined;

  constructor(store: DocumentStore) {
    this.store = store;
  }

  activate(_context: PluginContext): void {
    // Ignores the sandboxed context — uses store directly
  }

  deactivate(): void {
    this.store = undefined;
  }

  search(query: SearchQuery): SearchResult[] {
    if (!this.store) return [];
    return this.store.search(query);
  }
}
