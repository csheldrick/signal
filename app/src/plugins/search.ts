// ── Search Plugin ───────────────────────────────────────────
// Search plugin sandboxed to PluginContext (uses PluginContext-only contract)
// This plugin uses only the PluginContext sandbox and does not import DocumentStore directly.
// Loom should detect this as a cross-subsystem dependency edge.
// Weave's ContradictionDetectionOperator should surface it as a tension.

import type { Plugin, PluginContext, SearchQuery, SearchResult } from '../core/types.js';
import { normalizeSearchQuery } from '../core/types.js';


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

    // Use central normalization to avoid duplicate sanitization logic and
    // ensure host and plugin behave consistently when query shape changes.
    let normalized;
    try {
      normalized = normalizeSearchQuery(query as any);
    } catch (_) { return []; }

    try {
      return this.context.searchDocuments(normalized as SearchQuery);
    } catch (_) {
      return [];
    }
  }
}

// Sentinel for static analysis: indicates this plugin uses only the PluginContext sandbox.
// sentinel moved to instance property (readonly usesPluginContext = true)
