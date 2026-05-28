// ── Plugin Host ─────────────────────────────────────────────
// Plugin lifecycle manager. Defines the sandbox boundary.
// Plugins receive a PluginContext — NOT the store directly.

import type { DocumentSnapshot, SearchQuery, SearchResultSnapshot } from '../core/types.js';
import { telemetry } from '../sync/telemetry.js';
import { normalizeSearchQuery } from '../core/types.js';
import type { StorageEventType } from '../storage/events.js';
export type { StorageEventType } from '../storage/events.js'; // do not re-export StorageEvent to reduce plugin surface area; plugins receive frozen event snapshots via PluginContext

export type { SearchQuery } from '../core/types.js';
export type { SearchResultSnapshot as SearchResult } from '../core/types.js';

export interface Plugin {
  id: string;
  name: string;
  /**
   * Optional audit identifier (e.g. a signed vendor audit or review id).
   * When the host is configured to enforce audits this field must be present
   * to allow enabling the plugin. This lightweight field avoids introducing
   * a full audit system while making audits explicit at registration time.
   */
  readonly auditId?: string;
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
   * function that removes the listener when called. The event shape is
   * intentionally typed as 'any' here so plugins cannot rely on internal
   * concrete StorageEvent types and instead treat events as opaque snapshots.
   */
  onStorageEvent(type: StorageEventType | '*', listener: (event: Readonly<any>) => void): () => void;

  /**
   * Request a readonly summarization for a document id. The host decides
   * whether network calls are permitted; undefined is returned when the
   * document is missing or summarization is not available.
   */
  summarizeDocument(documentId: string, allowNetwork?: boolean): Promise<string | undefined>;
}

// Deprecated: 'dire' was previously a shared primitive that encouraged
// cross-subsystem coupling. The refactor routes document access through
// PluginContext and removes any meaningful behaviour from 'dire'. We keep an
// inert frozen proxy for compatibility so legacy imports do not crash, but
// accessing it will be inert and will emit a one-time deprecation warning.
export const dire: any = ((): any => {
  // Back-compat shim: provide a forgiving, callable proxy that will not
  // throw if legacy plugins attempt chained property access or invocation.
  // Emit a single deprecation warning on first use.
  try {
    let warned = false;
    const warnOnce = () => {
      if (!warned) {
        try { console.warn('PluginHost.dire is deprecated and no longer supported; use PluginContext sandbox APIs instead.'); } catch (_) {}
        warned = true;
      }
    };

    // Create a function-like proxy that is callable and also returns itself
    // for any property access. This prevents TypeError for patterns like
    // dire.foo().bar or dire().foo and graceful no-op behaviour when called.
    const base = function() { warnOnce(); return undefined; };

    const handler: ProxyHandler<any> = {
      apply(_target, _thisArg, _args) {
        warnOnce();
        return undefined;
      },
      get(_target, _prop) {
        // Return the same proxy for any accessed property so chained access
        // remains safe. Warn on first access.
        warnOnce();
        return proxy;
      },
      ownKeys() { return []; },
      getOwnPropertyDescriptor() { return undefined as any; },
      has() { return false; },
      set() { return true; },
      defineProperty() { return true; },
    };

    const proxy = new Proxy(base as any, handler);
    return Object.freeze(proxy);
  } catch (_) {
    try { console.warn('PluginHost.dire is deprecated and no longer supported; use PluginContext sandbox APIs instead.'); } catch (_) {}
    return Object.freeze(() => undefined);
  }
})();

export class PluginHost {
  private static readonly MAX_REGISTERED_PLUGINS = 1; // tightened to reduce plugin subsystem fan-out and resource pressure
  private plugins: Map<string, Plugin> = new Map();
  private static readonly MAX_ENABLED_PLUGINS = 1;
  private enabled: Set<string> = new Set();
  // Shared per-event-type managers to avoid registering one upstream
  // listener per plugin. This consolidates upstream listeners and
  // reduces StorageEventBus fan-out under load.
  private pluginEventManagers: Map<StorageEventType | '*', { upstreamDispose?: () => void; listeners: Set<(event: Readonly<any>) => void> }> = new Map();
  private context: PluginContext;
  // Security policy: by default plugins are not allowed to trigger
  // network-backed summarization. Hosts may opt-in globally or per-plugin
  // using the options parameter to the constructor.
  private allowNetworkSummaries: boolean = false;
  private allowedNetworkPluginIds?: Set<string> | undefined;
  // Lightweight audit log for plugin lifecycle events to assist operators in
  // reviewing plugin activity without requiring external tooling. Kept small
  // to avoid memory growth; hosts may choose to export or persist entries.
  private auditLog: Array<{ event: string; pluginId?: string; detail?: any; timestamp: number }> = [];

  private requireAudit: boolean = false;
  constructor(context: PluginContext, options?: { allowNetworkSummaries?: boolean; allowedNetworkPlugins?: string[]; requireAudit?: boolean }) {
    this.context = context;
    if (options) {
      this.allowNetworkSummaries = !!options.allowNetworkSummaries;
      if (Array.isArray(options.allowedNetworkPlugins) && options.allowedNetworkPlugins.length > 0) {
        this.allowedNetworkPluginIds = new Set(options.allowedNetworkPlugins);
      }
      this.requireAudit = !!options.requireAudit;
    }
  }

  register(plugin: Plugin): void {
    try { telemetry.emit('plugin_registered', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
    // Enforce explicit opt-in for the PluginContext sandbox. Legacy plugins
    // that do not set usesPluginContext === true must be migrated. This
    // prevents accidental sandbox escapes and makes the boundary explicit.
    if (plugin.usesPluginContext !== true) {
      // Enforce explicit opt-in for the PluginContext sandbox. Fail fast to
      // prevent accidental sandbox escapes and to encourage migration of
      // legacy plugins to the sandboxed contract. Throw so callers notice
      // misconfiguration immediately instead of silently continuing.
      throw new Error(`PluginHost: plugin '${plugin.id}' must set usesPluginContext = true to register`);
    }

    // Enforce audit requirement when configured: plugin must provide an auditId
    // to be eligible for enablement when the host is configured to require audits.
    if (this.requireAudit && !plugin.auditId) {
      try { telemetry.emit('plugin_register_failed_audit_missing', { id: plugin.id, timestamp: Date.now() }); } catch (_) {}
      throw new Error(`PluginHost: plugin '${plugin.id}' registration denied: auditId required by host policy`);
    }

    if (this.plugins.size >= PluginHost.MAX_REGISTERED_PLUGINS) {
      try { telemetry.emit('plugin_register_failed_limit', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
      throw new Error(`PluginHost: cannot register plugin '${plugin.id}': plugin registration limit reached`);
    }
    if (this.plugins.has(plugin.id)) {
      try { telemetry.emit('plugin_register_failed_duplicate', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
      throw new Error(`PluginHost: plugin '${plugin.id}' is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
    try { this.auditLog.push({ event: 'registered', pluginId: plugin.id, detail: { name: plugin.name }, timestamp: Date.now() }); } catch (_) {}
    try { telemetry.emit('plugin_registered_success', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
  }

  enable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || this.enabled.has(pluginId)) return false;

    // Prevent enabling too many plugins concurrently to avoid fan-out pressure.
    if (this.enabled.size >= PluginHost.MAX_ENABLED_PLUGINS) {
      try { console.warn('PluginHost: enabled plugin limit reached; refusing enable'); } catch (_) {}
      return false;
    }

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
      const CLOCK_CACHE_TTL = 250; // milliseconds (reduced to limit repeated deep clones under load)

      const ctx: PluginContext = {
        listDocuments: () => {
          // Validate and provide only well-formed document snapshots to plugins.
          return (this.context.listDocuments().slice(0, 100)).map(d => {
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
              try {
                  const nq = normalizeSearchQuery(q as any);
                  return JSON.stringify(nq);
                } catch (_) {
                  try { return JSON.stringify(q); } catch (_) { return String(q); }
                }
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
              const d = (r && typeof r === 'object') ? ((r as any).document && typeof (r as any).document === 'object' ? (r as any).document : r) : undefined;
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
            }).filter((x): x is Readonly<SearchResultSnapshot> => !!x).slice(0, 5);

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

        onStorageEvent: (type: StorageEventType | '*', listener: (event: Readonly<any>) => void) => {
          try {
            const maybe = (this.context as any)?.onStorageEvent;
            if (typeof maybe === 'function') {
              // Use a shared upstream listener per event type to avoid registering
              // one listener per plugin on the host context, which reduces listener
              // fan-out and helps prevent StorageEventBus overload.
              const key = type;
              let mgr = this.pluginEventManagers.get(key);
              if (!mgr) {
                // Limit the number of distinct event types we actively manage to
                // avoid unbounded growth of pluginEventManagers (each distinct
                // type can hold many listeners). If the cap is reached, avoid
                // adding another manager and fall back to a no-op behaviour.
                const MAX_EVENT_TYPES = 4; // reduced to limit distinct event-type managers and control fan-out
                if (this.pluginEventManagers.size >= MAX_EVENT_TYPES) {
                  try { console.warn('PluginHost: event manager type limit reached; registering noop listener'); } catch (_) {}
                  mgr = { upstreamDispose: undefined, listeners: new Set() };
                  // Do NOT insert into the map to avoid growth; the listener will
                  // still be tracked in the local mgr and removed by the returned disposer.
                } else {
                  mgr = { upstreamDispose: undefined, listeners: new Set() };
                  this.pluginEventManagers.set(key, mgr);
                }
              }
                            // Prevent runaway listener growth per plugin: cap listeners to a reasonable bound.
              // Reuse existing PluginHost limit for a simple protective heuristic.
              try {
                if (mgr.listeners.size >= Math.max(2, Math.floor(PluginHost.MAX_REGISTERED_PLUGINS / 2))) {
                  try { console.warn('PluginHost: per-event listener registration limit reached'); } catch (_) {}
                  // Return a no-op disposer to keep caller expectations consistent.
                  return () => {};
                }
              } catch (_) {}
              mgr.listeners.add(listener);

              // Install upstream listener when first plugin subscribes for this type.
              if (!mgr.upstreamDispose) {
                const upstreamWrapped = (ev: any) => {
                  try {
                    // Prepare a frozen snapshot tailored to the event type.
                    let toSend: Readonly<any> = Object.freeze(ev as any);
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
                  // Prefer the manager from the shared map; fall back to the
                  // local overflow manager (captured in the closure) when the
                  // map did not grow to include this key. This avoids leaking
                  // listeners created when the manager-cap was reached.
                  const m = this.pluginEventManagers.get(key) || mgr;
                  if (m) {
                    m.listeners.delete(listener);
                    if (m.listeners.size === 0) {
                      try { m.upstreamDispose && m.upstreamDispose(); } catch (_) {}
                      // Only remove from the shared map if it is present there.
                      if (this.pluginEventManagers.get(key)) {
                        this.pluginEventManagers.delete(key);
                      }
                    }
                  }
                } catch (_) { /* swallow */ }
              };
            }
          } catch (_) { /* ignore */ }
          return () => {};
        },

        summarizeDocument: async (documentId: string, allowNetwork: boolean = false) => {
          try {
            const maybe = (this.context as any)?.summarizeDocument;
            if (typeof maybe === 'function') {
              // Enforce host-level network policy. Plugins must both request
              // allowNetwork=true and be permitted by the host policy. This
              // prevents unvetted plugins from performing network calls.
              const pluginAllowed = (() => {
                try {
                  // If host has no per-plugin allowlist and allowNetworkSummaries
                  // is true, permit all plugins; otherwise require plugin id in the allowlist.
                  if (!this.allowNetworkSummaries) return false;
                  if (!this.allowedNetworkPluginIds) return true;
                  return this.allowedNetworkPluginIds.has(plugin.id);
                } catch (_) { return false; }
              })();

              try { telemetry.emit('plugin_summarize_request', { pluginId: plugin.id, documentId, allowNetwork, pluginAllowed, timestamp: Date.now() }); } catch (_) {}
              const res = await maybe(documentId, allowNetwork && pluginAllowed);
              if (res === undefined) {
                try { telemetry.emit('plugin_summarize_denied', { pluginId: plugin.id, documentId, allowNetwork, pluginAllowed, timestamp: Date.now() }); } catch (_) {}
              } else {
                try { telemetry.emit('plugin_summarize_allowed', { pluginId: plugin.id, documentId, allowNetwork, timestamp: Date.now() }); } catch (_) {}
              }
              return res;
            }
          } catch (_) { /* swallow */ }
          return undefined;
        },

      };

      return Object.freeze(ctx);
    })();

    // Activate plugin inside try/catch to avoid leaving an inconsistent enabled state
    try { telemetry.emit('plugin_enable_attempt', { id: pluginId, timestamp: Date.now() }); } catch (_) {}
    try {
      plugin.activate(safeCtx);
    } catch (err) {
      try { console.error(`PluginHost: activation failed for plugin '${pluginId}'`, err); } catch (_) {}
      try { telemetry.emit('plugin_enable_failed', { id: pluginId, error: String(err), timestamp: Date.now() }); } catch (_) {}
      return false;
    }

    this.enabled.add(pluginId);
    try { this.auditLog.push({ event: 'enabled', pluginId, timestamp: Date.now() }); } catch (_) {}
    try { telemetry.emit('plugin_enabled', { id: pluginId, timestamp: Date.now() }); } catch (_) {}
    return true;
  }

    disable(pluginId: string): boolean {
    try { telemetry.emit('plugin_disable_attempt', { id: pluginId, timestamp: Date.now() }); } catch (_) {}
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !this.enabled.has(pluginId)) return false;
    try { plugin.deactivate(); } catch (_) {}
    this.enabled.delete(pluginId);
    try { this.auditLog.push({ event: 'disabled', pluginId, timestamp: Date.now() }); } catch (_) {}
    try { telemetry.emit('plugin_disabled', { id: pluginId, timestamp: Date.now() }); } catch (_) {}
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
