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
  // Backwards-compat stub for removed 'dire' primitive. Emit a one-time
  // deprecation message at module evaluation and provide a frozen empty
  // object to avoid proxy-based runtime complexity and unexpected side-effects.
  try {
    // eslint-disable-next-line no-console
    console.warn("'dire' is deprecated; use PluginContext and PluginHost APIs instead.");
  } catch (_) { /* swallow console errors */ }
  return Object.freeze({}) as Record<string, unknown>;
})();

export class PluginHost {
  private static readonly MAX_REGISTERED_PLUGINS = 200;
  private plugins: Map<string, Plugin> = new Map();
  private enabled: Set<string> = new Set();
  // Shared per-event-type managers to avoid registering one upstream
  // listener per plugin. This consolidates upstream listeners and
  // reduces StorageEventBus fan-out under load.
  private pluginEventManagers: Map<StorageEventType | '*', { upstreamDispose?: () => void; listeners: Set<(event: Readonly<StorageEvent>) => void> }> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  register(plugin: Plugin): void {
    // Enforce explicit opt-in for the PluginContext sandbox. Legacy plugins
    // that do not set usesPluginContext === true must be migrated. This
    // prevents accidental sandbox escapes and makes the boundary explicit.
    if (plugin.usesPluginContext !== true) {
      // Enforce explicit opt-in for the PluginContext sandbox. Fail fast to
      // prevent accidental sandbox escapes and to encourage migration of
      // legacy plugins to the sandboxed contract.
      try { console.warn(`Plugin '${plugin.id}' must set usesPluginContext = true to register with PluginHost`); } catch (_) { /* swallow */ }
      return;
    }

    if (this.plugins.size >= PluginHost.MAX_REGISTERED_PLUGINS) {
      throw new Error(`PluginHost: cannot register plugin '${plugin.id}': plugin registration limit reached`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  enable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || this.enabled.has(pluginId)) return false;
    const safeCtx: PluginContext = (() => {
      // Non-generic deepFreeze helper to avoid TS generic parsing issues inside method bodies.
      function deepFreeze(obj: any): any {
        // Non-mutating deep freeze: create frozen copies instead of
        // mutating the provided object. This preserves host state and
        // prevents sandbox wrappers from altering core objects.
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          return Object.freeze(obj.map(item => deepFreeze(item)));
        }
        const out: any = {};
        for (const key of Object.keys(obj)) {
          try {
            out[key] = deepFreeze((obj as any)[key]);
          } catch (_) {
            try { out[key] = (obj as any)[key]; } catch (_) { out[key] = undefined; }
          }
        }
        return Object.freeze(out);
      }

      const searchCache = new Map<string, { ts: number; results: ReadonlyArray<Readonly<SearchResultSnapshot>> }>();

      // Small TTL-backed clock cache to reduce repeated deep-clone work for plugin callers.
      let lastClockTs = 0;
      let lastClock: { [peerId: string]: number } = {};
      const CLOCK_CACHE_TTL = 500; // milliseconds

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
            // Lightweight, short-lived cache to reduce repeated identical
            // search requests from plugins. Keying by JSON.stringify(q) is
            // sufficient for typical plugin queries; fallback to String(q)
            // on serialization errors.
            const key = (() => {
              try { return JSON.stringify(q); } catch (_) { return String(q); }
            })();

            const now = Date.now();
            const cached = searchCache.get(key);
            if (cached && (now - cached.ts) < 250) {
              return cached.results;
            }

            // Call host search once and produce safe, frozen clones for plugins.
            const raw = (() => {
              try {
                return this.context.searchDocuments(q);
              } catch (_) { return []; }
            })();

            const results = raw.map(r => {
              const d = r?.document;
              if (!d || typeof d.id !== 'string' || typeof d.title !== 'string') return undefined;
              // Limit highlights and snippet sizes to reduce plugin payloads and memory churn.
              const rawHighlights = Array.isArray(r.highlights) ? r.highlights : [];
              const highlights = rawHighlights.slice(0, 3).map(h => typeof h === 'string' ? (h.length > 200 ? h.slice(0, 200) : h) : String(h));
              const safeDoc = deepFreeze({
                ...d,
                links: Array.isArray(d.links) ? d.links.map((l: any) => deepFreeze({ ...l })) : [],
                tags: Array.isArray(d.tags) ? [...d.tags] : [],
              });
              return deepFreeze({ document: safeDoc, score: r.score ?? 0, highlights });
            }).filter((x): x is Readonly<SearchResult> => !!x).slice(0, 20);

            searchCache.set(key, { ts: now, results });
            return results;
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
            const now = Date.now();
            if (now - lastClockTs < CLOCK_CACHE_TTL) {
              return { ...lastClock };
            }
            // Prefer the host-provided clock if available; fall back to empty map.
            const maybe = (this.context as any)?.getClock;
            if (typeof maybe === 'function') {
              const res = maybe();
              // Ensure we return a plain object (not frozen by upstream) so callers can read safely.
              const copy = (res && typeof res === 'object') ? { ...res } : {};
              lastClock = copy;
              lastClockTs = now;
              return copy;
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
              // Use a shared upstream listener per event type to avoid registering
              // one listener per plugin on the host context, which reduces listener
              // fan-out and helps prevent StorageEventBus overload.
              const key = type;
              let mgr = this.pluginEventManagers.get(key);
              if (!mgr) {
                mgr = { upstreamDispose: undefined, listeners: new Set() };
                this.pluginEventManagers.set(key, mgr);
              }
                            // Prevent runaway listener growth per plugin: cap listeners to a reasonable bound.
              // Reuse existing PluginHost limit for a simple protective heuristic.
              try {
                if (mgr.listeners.size >= PluginHost.MAX_REGISTERED_PLUGINS) {
                  try { console.warn('PluginHost: per-event listener registration limit reached'); } catch (_) {}
                  // Return a no-op disposer to keep caller expectations consistent.
                  return () => {};
                }
              } catch (_) {}
              mgr.listeners.add(listener);

              // Install upstream listener when first plugin subscribes for this type.
              if (!mgr.upstreamDispose) {
                const upstreamWrapped = (ev: StorageEvent) => {
                  try {
                    // Prepare a frozen snapshot tailored to the event type.
                    let toSend: Readonly<StorageEvent> = Object.freeze(ev as any);
                    try {
                      switch (ev.type) {
                        case 'created': {
                          const d = (ev as any).document;
                          toSend = Object.freeze({ ...ev, document: Object.freeze({ ...d, links: d.links.map((l: any) => Object.freeze({ ...l })), tags: [...d.tags] }) });
                          break;
                        }
                        case 'updated': {
                          const prev = (ev as any).previous; const cur = (ev as any).current;
                          toSend = Object.freeze({ ...ev,
                            previous: Object.freeze({ ...prev, links: prev.links.map((l: any) => Object.freeze({ ...l })), tags: [...prev.tags] }),
                            current: Object.freeze({ ...cur, links: cur.links.map((l: any) => Object.freeze({ ...l })), tags: [...cur.tags] }),
                          });
                          break;
                        }
                        case 'deleted': {
                          toSend = Object.freeze({ ...ev });
                          break;
                        }
                        case 'linked': {
                          const link = (ev as any).link;
                          toSend = Object.freeze({ ...ev, link: Object.freeze({ ...link }) });
                          break;
                        }
                        default:
                          toSend = Object.freeze(ev as any);
                          break;
                      }
                    } catch (_) { toSend = Object.freeze(ev as any); }

                    for (const fn of Array.from(mgr!.listeners)) {
                      try { fn(toSend); } catch (_) { /* swallow */ }
                    }
                  } catch (_) { /* swallow */ }
                };

                const dispose = maybe(type, upstreamWrapped);
                if (typeof dispose === 'function') {
                  mgr.upstreamDispose = dispose;
                } else {
                  mgr.upstreamDispose = () => { try { (this.context as any).off(type, upstreamWrapped); } catch (_) {} };
                }
              }

              // Return a disposer that removes this plugin listener and tears down upstream when empty.
              return () => {
                try {
                  const m = this.pluginEventManagers.get(key);
                  if (m) {
                    m.listeners.delete(listener);
                    if (m.listeners.size === 0) {
                      try { m.upstreamDispose && m.upstreamDispose(); } catch (_) {}
                      this.pluginEventManagers.delete(key);
                    }
                  }
                } catch (_) { /* swallow */ }
              };
            }
          } catch (_) { /* ignore */ }
          return () => {};
        },

        summarizeDocument: async (documentId: string, allowNetwork?: boolean) => {
          try {
            const maybe = (this.context as any)?.summarizeDocument;
            if (typeof maybe === 'function') {
              // Forward the allowNetwork flag so plugins can explicitly opt-in
              // to remote summarization and the host can enforce network policy.
              return await maybe(documentId, allowNetwork);
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
