// ── Plugin Host ─────────────────────────────────────────────
// Plugin lifecycle manager. Defines the sandbox boundary.
// Plugins receive a PluginContext — NOT the store directly.

import type { DocumentSnapshot, SearchQuery, SearchResult, SearchResultSnapshot } from '../core/types.js';
import type { StorageEvent, StorageEventType } from '../storage/events.js';

export type { SearchQuery } from '../core/types.js';
export type { SearchResultSnapshot as SearchResult } from '../core/types.js';

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
  listDocuments(): ReadonlyArray<Readonly<DocumentSnapshot>>;
  searchDocuments(query: SearchQuery): ReadonlyArray<Readonly<SearchResultSnapshot>>;
  getDocument(id: string): Readonly<DocumentSnapshot> | undefined;
  getClock(): { [peerId: string]: number };

  /**
   * Observe storage events in a readonly, sandboxed way. Returns a dispose
   * function that removes the listener when called.
   */
  onStorageEvent(type: StorageEventType | '*', listener: (event: Readonly<StorageEvent>) => void): () => void;

  /**
   * Request a readonly summarization for a document id. The host decides
   * whether network calls are permitted; undefined is returned when the
   * document is missing or summarization is not available.
   */
  summarizeDocument(documentId: string, allowNetwork?: boolean): Promise<string | undefined>;
}

export const dire: Record<string, unknown> = (() => {
  // Backwards-compat stub for removed 'dire' primitive. Accessing it logs a
  // one-time deprecation warning and returns undefined on property access so
  // older plugins don't crash at import-time.
  let warned = false;
  return new Proxy({}, {
    get() {
      try {
        if (!warned) {
          // eslint-disable-next-line no-console
          console.warn("'dire' is deprecated; use PluginContext and PluginHost APIs instead.");
          warned = true;
        }
      } catch (_) { /* swallow console errors */ }
      return undefined;
    },
    apply() { return undefined as any; },
  });
})();

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
        console.warn('Plugin registration: plugin did not opt into PluginContext sandbox. Registering for backward compatibility. This is deprecated — prefer readonly usesPluginContext = true.');
      } catch (_) {
        /* swallow console errors */
      }
      // For backward compatibility we still register legacy plugins, but we
      // issue a deprecation warning so callers migrate to the sandboxed
      // PluginContext contract. This reduces breaking changes while keeping
      // the migration path explicit.
      this.plugins.set(plugin.id, plugin);
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
        listDocuments: () => {
          // Validate and provide only well-formed document snapshots to plugins.
          return this.context.listDocuments().map(d => {
            try {
              if (!d || typeof d.id !== 'string' || typeof d.title !== 'string' || typeof d.content !== 'string' || !Array.isArray(d.links) || !Array.isArray(d.tags)) return undefined;
              const safeDoc = {
                ...d,
                links: d.links.map(l => ({ ...l })),
                tags: Array.isArray(d.tags) ? [...d.tags] : [],
              };
              return deepFreeze(safeDoc);
            } catch (_) {
              return undefined;
            }
          }).filter((x): x is Readonly<DocumentSnapshot> => !!x);
        },
        searchDocuments: (q: SearchQuery) => {
          try {
            return this.context.searchDocuments(q).map(r => {
              const d = r?.document;
              if (!d || typeof d.id !== 'string' || typeof d.title !== 'string') return undefined;
              const safeDoc = deepFreeze({
                ...d,
                links: Array.isArray(d.links) ? d.links.map((l: any) => deepFreeze({ ...l })) : [],
                tags: Array.isArray(d.tags) ? [...d.tags] : [],
              });
              return deepFreeze({ document: safeDoc, score: r.score ?? 0, highlights: Array.isArray(r.highlights) ? [...r.highlights] : [] });
            }).filter((x): x is Readonly<SearchResult> => !!x);
          } catch (_) { return []; }
        },
        getDocument: (id: string) => {
          try {
            const d = this.context.getDocument(id);
            if (!d || typeof d.id !== 'string' || typeof d.title !== 'string' || typeof d.content !== 'string') return undefined;
            return deepFreeze({
              ...d,
              links: Array.isArray(d.links) ? d.links.map((l: any) => deepFreeze({ ...l })) : [],
              tags: Array.isArray(d.tags) ? [...d.tags] : [],
            });
          } catch (_) { return undefined; }
        },
        getClock: () => {
          try {
            // Prefer the host-provided clock if available; fall back to empty map.
            const maybe = (this.context as any)?.getClock;
            if (typeof maybe === 'function') {
              const res = maybe();
              // Ensure we return a plain object (not frozen by upstream) so callers can read safely.
              return (res && typeof res === 'object') ? { ...res } : {};
            }
          } catch (_) {
            /* swallow errors and provide safe default */
          }
          return {};
        },

        onStorageEvent: (type: StorageEventType | '*', listener: (event: Readonly<StorageEvent>) => void) => {
          try {
            const maybe = (this.context as any)?.onStorageEvent;
            if (typeof maybe === 'function') {
              // Wrap to ensure plugins receive a frozen, readonly snapshot tailored by event.type
              const wrapped = (ev: StorageEvent) => {
                try {
                  switch (ev.type) {
                    case 'created': {
                      const d = (ev as any).document;
                      const safe = Object.freeze({ ...ev, document: Object.freeze({ ...d, links: d.links.map((l: any) => Object.freeze({ ...l })), tags: [...d.tags] }) });
                      listener(safe);
                      return;
                    }
                    case 'updated': {
                      const prev = (ev as any).previous; const cur = (ev as any).current;
                      const safe = Object.freeze({ ...ev,
                        previous: Object.freeze({ ...prev, links: prev.links.map((l: any) => Object.freeze({ ...l })), tags: [...prev.tags] }),
                        current: Object.freeze({ ...cur, links: cur.links.map((l: any) => Object.freeze({ ...l })), tags: [...cur.tags] }),
                      });
                      listener(safe);
                      return;
                    }
                    case 'deleted': {
                      listener(Object.freeze({ ...ev }));
                      return;
                    }
                    case 'linked': {
                      const link = (ev as any).link;
                      listener(Object.freeze({ ...ev, link: Object.freeze({ ...link }) }));
                      return;
                    }
                    default:
                      listener(Object.freeze(ev));
                      return;
                  }
                } catch (_) {
                  try { listener(ev as any); } catch (_) { /* swallow */ }
                }
              };

              const dispose = maybe(type, wrapped);
              if (typeof dispose === 'function') return dispose;
              return () => { try { (this.context as any).off(type, wrapped); } catch (_) {} };
            }
          } catch (_) { /* ignore */ }
          return () => {};
        },

        summarizeDocument: async (documentId: string) => {
          try {
            const maybe = (this.context as any)?.summarizeDocument;
            if (typeof maybe === 'function') {
              return await maybe(documentId);
            }
          } catch (_) { /* swallow */ }
          return undefined;
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
