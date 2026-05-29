// ── Search Plugin ───────────────────────────────────────────
// Search plugin sandboxed to PluginContext (uses PluginContext-only contract)
// This plugin uses only the PluginContext sandbox and does not import DocumentStore directly.
// Loom should detect this as a cross-subsystem dependency edge.
// Weave's ContradictionDetectionOperator should surface it as a tension.

import type { Plugin, PluginContext, SearchQuery, SearchResult } from '../core/types.js';


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

  private lastSearchTs = 0;
  private static readonly MIN_INTERVAL_MS = 100;
  private static readonly MAX_TEXT_LENGTH = 300;
  private static readonly MAX_TAGS = 10;

  search(query: SearchQuery): ReadonlyArray<SearchResult> {
    if (!this.context) return [];

    // Per-plugin short cooldown to avoid high-frequency probes hitting the
    // inverted index or backend search implementation. Fail-safe: return an
    // empty result rather than blocking or throwing.
    const now = Date.now();
    if (now - this.lastSearchTs < SearchPlugin.MIN_INTERVAL_MS) return [];
    this.lastSearchTs = now;

    if (!query || (!query.text && (!query.tags || query.tags.length === 0) && !query.dateRange)) {
      // Short-circuit obviously-empty queries to avoid unnecessary work in
      // potentially expensive search implementations.
      return [];
    }

    // Sanitize inputs to protect the search/subsystem from pathological
    // queries (very long text or excessively many tags). This reduces
    // accidental overload while preserving useful behaviour.
    const safeQuery: any = { ...query } as any;
    try {
      if (typeof safeQuery.text === 'string' && safeQuery.text.length > SearchPlugin.MAX_TEXT_LENGTH) {
        safeQuery.text = safeQuery.text.slice(0, SearchPlugin.MAX_TEXT_LENGTH);
      }
      if (Array.isArray(safeQuery.tags) && safeQuery.tags.length > SearchPlugin.MAX_TAGS) {
        safeQuery.tags = safeQuery.tags.slice(0, SearchPlugin.MAX_TAGS);
      }
    } catch (_) {
      // If sanitization fails for any reason, avoid escalating the error to
      // the host; return a safe empty result.
      return [];
    }

    try {
      // Pass the sanitized, bounded query directly to the host search API.
      return this.context.searchDocuments(safeQuery as SearchQuery);
    } catch (_) {
      // Protect callers from upstream errors in search implementations.
      return [];
    }
  }
}

// Sentinel for static analysis: indicates this plugin uses only the PluginContext sandbox.
// sentinel moved to instance property (readonly usesPluginContext = true)
