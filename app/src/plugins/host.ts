// ── Plugin Host ─────────────────────────────────────────────
// Plugin lifecycle manager. Defines the sandbox boundary.
// Plugins receive a PluginContext — NOT the store directly.

import type { Document, SearchQuery, SearchResult } from '../core/types.js';

export { SearchQuery, SearchResult };

export interface Plugin {
  id: string;
  name: string;
  /**
   * Explicit opt-in flag indicating the plugin uses only the PluginContext
   * sandbox. Plugins that access other subsystems MUST NOT set this flag.
   */
  readonly usesPluginContext?: boolean;
  activate(context: PluginContext): void;
  deactivate(): void;
}

export interface PluginContext {
  /**
   * Plugins receive readonly snapshots to prevent accidental mutation of
   * core application state and to make the sandbox contract explicit.
   */
  listDocuments(): ReadonlyArray<Readonly<Document>>;
  searchDocuments(query: SearchQuery): ReadonlyArray<Readonly<SearchResult>>;
  getDocument(id: string): Readonly<Document> | undefined;
}

export class PluginHost {
  private plugins: Map<string, Plugin> = new Map();
  private enabled: Set<string> = new Set();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  register(plugin: Plugin): void {
    if (plugin.usesPluginContext !== true) {
      try {
        // eslint-disable-next-line no-console
        console.error('Plugin registration rejected: plugin must opt into PluginContext sandbox by declaring readonly usesPluginContext = true.');
      } catch (_) {
        /* swallow console errors */
      }
      // Do not register plugins that do not explicitly opt into the PluginContext-only contract.
      return;
    }
    this.plugins.set(plugin.id, plugin);
  }

  enable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || this.enabled.has(pluginId)) return false;
    const safeCtx: PluginContext = (() => {
      // Non-generic deepFreeze helper to avoid TS generic parsing issues inside method bodies.
      function deepFreeze(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            obj[i] = deepFreeze(obj[i]);
          }
          return Object.freeze(obj);
        }
        for (const key of Object.keys(obj)) {
          try {
            obj[key] = deepFreeze(obj[key]);
          } catch (_) {
            /* ignore read-only props */
          }
        }
        return Object.freeze(obj);
      }

      const ctx: PluginContext = {
        listDocuments: () => this.context.listDocuments().map(d => deepFreeze({
          ...d,
          links: d.links.map(l => deepFreeze({ ...l })),
          tags: [...d.tags],
        })),
        searchDocuments: (q: SearchQuery) => this.context.searchDocuments(q).map(r => deepFreeze({
          document: deepFreeze({
            ...r.document,
            links: r.document.links.map(l => deepFreeze({ ...l })),
            tags: [...r.document.tags],
          }),
          score: r.score,
          highlights: [...r.highlights],
        })),
        getDocument: (id: string) => {
          const d = this.context.getDocument(id);
          if (!d) return undefined;
          return deepFreeze({
            ...d,
            links: d.links.map(l => deepFreeze({ ...l })),
            tags: [...d.tags],
          });
        },
      };

      return Object.freeze(ctx);
    })();
    plugin.activate(safeCtx);
    this.enabled.add(pluginId);
    return true;
  }

  disable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !this.enabled.has(pluginId)) return false;
    plugin.deactivate();
    this.enabled.delete(pluginId);
    return true;
  }

  list(): Array<{ id: string; name: string; enabled: boolean }> {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      name: p.name,
      enabled: this.enabled.has(p.id),
    }));
  }
}
