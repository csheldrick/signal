import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Registry helpers for attaching and retrieving a canonical SyncEngine
 * instance from a store-like object. To reduce split ownership and avoid
 * multiple registration surfaces, we prefer store-provided accessors when
 * available but fall back to a deterministic in-process registry to avoid
 * accidental duplicate SyncEngine instances when hosts do not expose the
 * expected getters/setters (or when the store is non-extensible/proxied).
 *
 * Behavior:
 *  - getSyncEngineFromStore returns the result of store.getSyncEngine() if
 *    present, otherwise consults the store's well-known SYM_SYNC_ENGINE symbol
 *    property when available, otherwise falls back to an in-process registry
 *    keyed by the store object (WeakMap) or by the store reference for
 *    primitives. Returns undefined when no engine is found.
 *  - setSyncEngineOnStore attempts to register via store.setSyncEngine(engine)
 *    when available. If the setter is absent the helper will attempt to set
 *    the well-known SYM_SYNC_ENGINE symbol on the store object when possible
 *    (non-enumerable). If that is not possible, it falls back to the in-
 *    process registry. If an engine is already registered and differs from
 *    the provided one the helper throws to make conflicts explicit.
 */

const __weakRegistry = typeof WeakMap !== 'undefined' ? new WeakMap<any, any>() : undefined;
const __primitiveRegistry = new Map<any, any>();

export function getSyncEngineFromStore(store: any): any | undefined {
  try {
    if (!store) return undefined;

    // Prefer store-provided getter when present so hosts can explicitly
    // manage the canonical engine on their store implementation.
    if (typeof store.getSyncEngine === 'function') {
      return store.getSyncEngine();
    }

    // If the store exposes a well-known symbol property (DocumentStore sets
    // this symbol), prefer returning that value. This helps environments that
    // don't expose accessor methods but do store the canonical engine on the
    // instance via the shared symbol.
    try {
      if (typeof SYM_SYNC_ENGINE !== 'undefined' && (store as any)[SYM_SYNC_ENGINE] !== undefined) {
        return (store as any)[SYM_SYNC_ENGINE];
      }
    } catch (_) { /* ignore symbol access errors */ }

    // Fall back to in-process registry keyed by store object when available.
    if (typeof store === 'object' || typeof store === 'function') {
      if (__weakRegistry) return __weakRegistry.get(store);
      // If WeakMap isn't available, fall back to primitive Map keyed by the object reference.
      return __primitiveRegistry.get(store);
    }

    // For primitive store identifiers (unlikely but supported), consult the primitive registry.
    return __primitiveRegistry.get(store);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export function setSyncEngineOnStore(store: any, engine: any): void {
  try {
    if (!store) return;

    // If an engine is already registered on this store and it differs from
    // the provided one, fail fast so callers can detect configuration errors
    // instead of silently creating duplicate engines.
    try {
      const existing = getSyncEngineFromStore(store as any);
      if (existing !== undefined && existing !== engine) {
        throw new Error('setSyncEngineOnStore: conflicting SyncEngine already registered on store');
      }
    } catch (e) {
      // Propagate registry read errors to the caller — do not swallow them.
      throw e;
    }

    // Prefer explicit setter API when present. Hosts should implement this
    // to participate in canonical registration.
    if (typeof store.setSyncEngine === 'function') {
      store.setSyncEngine(engine);
      return;
    }

    // Attempt to set the well-known symbol property if available and the
    // store is an object. Use a non-enumerable property to avoid leaking on
    // iteration. This mirrors DocumentStore.setSyncEngine behavior when
    // possible and avoids needing an in-process registry in many cases.
    try {
      if (typeof SYM_SYNC_ENGINE !== 'undefined' && (typeof store === 'object' || typeof store === 'function')) {
        try {
          Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, writable: true, configurable: true });
          return;
        } catch (_) {
          // Fall through to registry fallback if defineProperty fails.
        }
      }
    } catch (_) { /* swallow */ }

    // If the host store does not provide accessors and we couldn't set the symbol,
    // use the in-process registry as a deterministic fallback. Use WeakMap for
    // object keys to avoid preventing GC; for primitives or in environments lacking
    // WeakMap, use the primitiveRegistry Map.
    if (typeof store === 'object' || typeof store === 'function') {
      if (__weakRegistry) {
        __weakRegistry.set(store, engine);
        return;
      }
      __primitiveRegistry.set(store, engine);
      return;
    }

    // Primitive store identifier
    __primitiveRegistry.set(store, engine);
    return;
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
