// ── Search Plugin ───────────────────────────────────────────
// ⚠️ DELIBERATE BOUNDARY VIOLATION
// This plugin imports DocumentStore directly instead of using PluginContext.
// Loom should detect this as a cross-subsystem dependency edge.
// Weave's ContradictionDetectionOperator should surface it as a tension.

import type { Plugin, PluginContext } from './host.js';
  // ← VIOLATION
import type { SearchQuery, SearchResult } from '../core/types.js';


export class SearchPlugin implements Plugin {
  readonly id = 'search';
  readonly name = 'Advanced Search';
  private context: PluginContext | undefined;
  

  constructor() {}


  activate(context: PluginContext): void {
    this.context = context;
  }

  deactivate(): void {
    this.context = undefined;
  }

  search(query: SearchQuery): SearchResult[] {
    
    if (!this.context) return [];
    return this.context.searchDocuments(query);
  }
}
