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
        return Array.isArray(l) ? l.slice(0, 300) : [];
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
    if (!real) real = new PluginHost(pluginContext); // TODO: consider passing policy options from app configuration to PluginHost
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

  // Hold pending config so callers can opt-in to wiring behaviour without
  // forcing the real PresenceTracker to be created. This avoids starting
  // timers/listeners during app startup when only configuration is being set.
  const pending: {
    pluginContextSet?: boolean;
    pluginContext?: PluginContext | undefined;
    sessionTrackerSet?: boolean;
    sessionTracker?: any;
    validatorSet?: boolean;
    validator?: any;
    asyncValidatorSet?: boolean;
    asyncValidator?: any;
  } = {};

  const ensure = () => {
    if (!real) {
      real = new PresenceTracker(contextGetter?.());
      // Apply any pending configuration in a best-effort manner.
      try { if (pending.pluginContextSet) real.setPluginContext(pending.pluginContext); } catch (_) {}
      try { if (pending.sessionTrackerSet) real.setSessionTracker(pending.sessionTracker); } catch (_) {}
      try { if (pending.validatorSet) real.setValidator(pending.validator); } catch (_) {}
      try { if (pending.asyncValidatorSet) real.setAsyncValidator(pending.asyncValidator); } catch (_) {}
    }
    return real!;
  };

  // Proxy-like wrapper that lazily forwards method calls and property access.
  // Intercept common configuration setters so they do not force instantiation.
  const proxy = new Proxy({} as any, {
    get(_t, p) {
      // Handle common configuration methods without creating the real tracker.
      if (p === 'setPluginContext') {
        return (ctx?: PluginContext) => {
          pending.pluginContextSet = true;
          pending.pluginContext = ctx;
          if (real) {
            try { real.setPluginContext(ctx); } catch (_) {}
          }
        };
      }

      if (p === 'setSessionTracker') {
        return (tracker?: any) => {
          pending.sessionTrackerSet = true;
          pending.sessionTracker = tracker;
          if (real) {
            try { real.setSessionTracker(tracker); } catch (_) {}
          }
        };
      }

      if (p === 'setValidator') {
        return (v?: any) => {
          pending.validatorSet = true;
          pending.validator = v;
          if (real) {
            try { real.setValidator(v); } catch (_) {}
          }
        };
      }

      if (p === 'setAsyncValidator') {
        return (v?: any) => {
          pending.asyncValidatorSet = true;
          pending.asyncValidator = v;
          if (real) {
            try { real.setAsyncValidator(v); } catch (_) {}
          }
        };
      }

      if (p === 'stopCleanupTimer') {
        // stopCleanupTimer is safe to be a no-op before instantiation.
        return () => {
          if (real) {
            try { real.stopCleanupTimer(); } catch (_) {}
          }
        };
      }

      // For any other access, instantiate the real tracker and forward.
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

