import { GraphBuilder } from '../graph/builder.js';
import { PluginHost } from '../plugins/host.js';
import { PresenceTracker } from '../collaboration/presence.js';
import type { PluginContext } from '../plugins/host.js';

/**
 * Create a lazy GraphBuilder wrapper. Accepts a store getter callback so
 * the factory doesn't need direct access to SignalApp internals.
 */
export function createLazyGraph(storeGetter: () => any[]): GraphBuilder {
  let real: GraphBuilder | undefined;
  const ensure = () => {
    if (!real) real = new GraphBuilder(() => {
      try {
        const l = storeGetter();
        return Array.isArray(l) ? l.slice(0, 500) : [];
      } catch (_) {
        return [];
      }
    });
    return real!;
  };
  return {
    buildGraph: () => ensure().buildGraph(),
    findClusters: () => ensure().findClusters(),
    findHubs: (minLinks?: number) => ensure().findHubs(minLinks),
  } as unknown as GraphBuilder;
}

/**
 * Create a lazy PluginHost wrapper. This consolidates the lazy-instantiation
 * pattern so the app doesn't inline the logic and so tests/factories can
 * reuse the same behavior.
 */
export function createLazyPluginHost(pluginContext: PluginContext): PluginHost {
  let real: PluginHost | undefined;
  const ensure = () => {
    if (!real) real = new PluginHost(pluginContext);
    return real!;
  };
  return {
    register(plugin: any) { ensure().register(plugin); },
    enable(pluginId: string) { return ensure().enable(pluginId); },
    disable(pluginId: string) { return ensure().disable(pluginId); },
    list() { return ensure().list(); },
  } as unknown as PluginHost;
}

/**
 * Create a lazy PresenceTracker wrapper. Defers construction (and its
 * background timers/validation logic) until the tracker is actually used.
 * Accepts a PluginContext getter so the real tracker can be wired with the
 * same sandbox without introducing startup IO.
 */
export function createLazyPresenceTracker(contextGetter: () => PluginContext | undefined): PresenceTracker {
  let real: PresenceTracker | undefined;
  const ensure = () => {
    if (!real) real = new PresenceTracker(contextGetter?.());
    return real!;
  };
  // Proxy-like wrapper that lazily forwards method calls and property access.
  const proxy = new Proxy({} as any, {
    get(_t, p) {
      const r = ensure();
      const val = (r as any)[p];
      if (typeof val === 'function') return val.bind(r);
      return val;
    },
    set(_t, p, v) {
      const r = ensure();
      try { (r as any)[p] = v; } catch (_) {}
      return true;
    },
    has(_t, p) { const r = ensure(); return p in r; },
    ownKeys(_t) { const r = ensure(); return Reflect.ownKeys(r); },
    getOwnPropertyDescriptor(_t, p) { const r = ensure(); return Object.getOwnPropertyDescriptor(r, p as any) as any; },
  }) as PresenceTracker;
  return proxy;
}

