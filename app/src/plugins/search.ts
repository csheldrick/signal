// ── Search Plugin ───────────────────────────────────────────
// Search plugin sandboxed to PluginContext (uses PluginContext-only contract)
// This plugin uses only the PluginContext sandbox and does not import DocumentStore directly.
// Loom should detect this as a cross-subsystem dependency edge.
// Weave's ContradictionDetectionOperator should surface it as a tension.

import type { Plugin, PluginContext } from './host.js';

import type { SearchQuery, SearchResult } from './host.js';


export class SearchPlugin implements Plugin {
  readonly id = 'search';
  readonly name = 'Advanced Search';
  readonly usesPluginContext = true;
  private context: PluginContext | undefined;
  

  constructor() {}


  activate(context: PluginContext): void {
    this.context = context;
  }

  deactivate(): void {
    this.context = undefined;
  }

  search(query: SearchQuery): ReadonlyArray<SearchResult> {
    if (!this.context) return [];
    return this.context.searchDocuments(query);
  }
}

// Sentinel for static analysis: indicates this plugin uses only the PluginContext sandbox.
// sentinel moved to instance property (readonly usesPluginContext = true)
