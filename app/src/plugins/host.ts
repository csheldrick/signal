// ── Plugin Host ─────────────────────────────────────────────
// Plugin lifecycle manager. Defines the sandbox boundary.
// Plugins receive a PluginContext — NOT the store directly.

import { telemetry } from '../sync/telemetry.js';

// Plugin-facing minimal types: declare lightweight, readonly-friendly snapshots
// locally so plugins do not depend on the full core types module. This reduces
// centrality of core/types and limits architectural fan-out.
export type StorageEventType = 'created' | 'updated' | 'deleted' | 'linked';

// Reuse canonical plugin contracts from core/types to centralize the
// lightweight interfaces and reduce duplication. Keep local aliases so
// existing imports from './host.js' continue to work while ensuring the
// host implements the core-defined contract.
import type { Plugin as CorePlugin, PluginContext as CorePluginContext, SearchQuery as CoreSearchQuery, SearchResult as CoreSearchResult, DocumentSnapshot as CoreDocumentSnapshot } from '../core/types.js';

export type DocumentSnapshot = CoreDocumentSnapshot;
export type SearchResultSnapshot = CoreSearchResult;
export type SearchQuery = CoreSearchQuery;
export type SearchResult = CoreSearchResult;
export type Plugin = CorePlugin;
export type PluginContext = CorePluginContext;

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
  // Allow a modest number of plugins to support a modular ecosystem while
  // still bounding fan-out and resource pressure. Increasing these caps
  // resolves the monolithic 'single plugin' restriction while retaining
  // conservative safety limits for low-resource environments.
  private static readonly MAX_REGISTERED_PLUGINS = 8; // previously 1
  private plugins: Map<string, Plugin> = new Map();
  private static readonly MAX_ENABLED_PLUGINS = 4; // previously 1
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

  // Per-plugin summarize request rate tracking to avoid abusive or buggy
  // plugins flooding the network summarizer.
  private summarizeRate: Map<string, { windowStart: number; count: number }> = new Map();

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
    // Wrap the plugin with a thin error-boundary so misbehaving plugins cannot
    // throw uncaught exceptions into the host process. We handle errors from
    // activate/deactivate and emit telemetry while preserving original plugin
    // behaviour. This strengthens the PluginHost isolation boundary.
    const wrapPluginWithBoundary = (p: Plugin): Plugin => {
      return {
        id: p.id,
        name: p.name,
        auditId: p.auditId,
        usesPluginContext: p.usesPluginContext,
        activate: (ctx: PluginContext) => {
          try {
            p.activate(ctx);
          } catch (err) {
            try { console.error(`PluginHost: plugin.activate threw for '${p.id}'`, err); } catch (_) {}
            try { telemetry.emit('plugin_activate_error', { id: p.id, error: String(err), timestamp: Date.now() }); } catch (_) {}
          }
        },
        deactivate: () => {
          try {
            p.deactivate();
          } catch (err) {
            try { console.error(`PluginHost: plugin.deactivate threw for '${p.id}'`, err); } catch (_) {}
            try { telemetry.emit('plugin_deactivate_error', { id: p.id, error: String(err), timestamp: Date.now() }); } catch (_) {}
          }
        }
      };
    };

    try { telemetry.emit('plugin_registered', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
    // Enforce explicit opt-in for the PluginContext sandbox when enabling.
    // To improve migration ergonomics we allow legacy plugins to register
    // (reduces immediate breaking changes and monolithic registration failures)
    // but they will not be permitted to *enable* until migrated to the
    // sandboxed PluginContext contract (usesPluginContext = true). This lets
    // tooling discover legacy plugins while preserving a safe runtime enable
    // policy that prevents sandbox escapes.
    if (plugin.usesPluginContext !== true) {
      try { telemetry.emit('plugin_register_legacy', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
      // Continue registration but mark as legacy via audit log for operator visibility.
      try { this.auditLog.push({ event: 'registered_legacy', pluginId: plugin.id, detail: { name: plugin.name }, timestamp: Date.now() }); } catch (_) {}
      // Note: do NOT throw here to allow migration paths; enable() enforces sandbox
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
    // Store a wrapped plugin to ensure any host-invoked lifecycle methods are
    // protected by an error boundary. The audit/logging still refers to the
    // plugin id/name supplied by the original plugin object.
    this.plugins.set(plugin.id, wrapPluginWithBoundary(plugin));
    try { this.auditLog.push({ event: 'registered', pluginId: plugin.id, detail: { name: plugin.name }, timestamp: Date.now() }); } catch (_) {}
    try { telemetry.emit('plugin_registered_success', { id: plugin.id, name: plugin.name, timestamp: Date.now() }); } catch (_) {}
  }

  enable(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || this.enabled.has(pluginId)) return false;

    // Enforce sandbox opt-in at enable-time: legacy plugins may register
    // but are not permitted to activate until migrated to the sandboxed
    // PluginContext contract. This prevents accidental sandbox escapes.
    if ((plugin as any).usesPluginContext !== true) {
      try { telemetry.emit('plugin_enable_denied_legacy', { id: pluginId, timestamp: Date.now() }); } catch (_) {}
      try { console.warn && console.warn(`PluginHost: enabling legacy plugin '${pluginId}' denied; migrate to usesPluginContext = true`); } catch (_) {}
      return false;
    }

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
            // search requests from plugins. Keying by a conservative JSON
            // serialization is sufficient for typical plugin queries; avoid
            // calling into core normalization here to keep the plugin host
            // decoupled and reduce centrality.
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
              // Rate-limit plugin summarize requests: simple sliding window per-plugin.
              try {
                const RATE_WINDOW_MS = 60_000; // 1 minute
                const MAX_PER_WINDOW = 6; // allow up to 6 requests per minute per plugin
                const now = Date.now();
                const record = this.summarizeRate.get(plugin.id) || { windowStart: now, count: 0 };
                if (now - record.windowStart > RATE_WINDOW_MS) {
                  record.windowStart = now;
                  record.count = 0;
                }
                if (record.count >= MAX_PER_WINDOW) {
                  try { telemetry.emit('plugin_summarize_rate_limited', { pluginId: plugin.id, documentId, timestamp: Date.now() }); } catch (_) {}
                  return undefined;
                }
                record.count++;
                this.summarizeRate.set(plugin.id, record);
              } catch (_) {}

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
