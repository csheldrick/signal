/**
 * Registry helpers for attaching and retrieving a canonical SyncEngine
 * instance from a store-like object. To reduce split ownership and avoid
 * multiple registration surfaces, we prefer an explicit host-provided
 * accessor API (store.getSyncEngine / store.setSyncEngine). If these are
 * unavailable this helper will return undefined or throw on set to make
 * the absence of a canonical registry explicit to callers.
 */
// Provide a lightweight fallback registry when hosts do not expose
// explicit getSyncEngine/setSyncEngine accessors. This uses a WeakMap so
// we do not retain strong references to store objects and keeps behavior
// deterministic for tests/environments where the host store cannot be
// modified to implement the accessor API.
export const fallbackRegistry: WeakMap<any, any> = new WeakMap();

export function getSyncEngineFromStore(store: any): any | undefined {
  try {
    if (!store) return undefined;

    // Prefer explicit getter methods when present on the store object.
    try {
      if (typeof store.getSyncEngine === 'function') {
        return store.getSyncEngine();
      }
    } catch (err) {
      // Propagate errors from host getter so callers can surface misconfiguration.
      throw err;
    }

    // Fallback: return any engine previously registered for this store
    // using the internal WeakMap registry. This avoids fabricating global
    // mutable state on the store object and keeps tests deterministic.
    return fallbackRegistry.get(store);
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
    // to participate in canonical registration. If absent we use the
    // internal weakmap fallback which keeps behavior deterministic instead
    // of throwing and causing callers to create duplicate engines.
    try {
      if (typeof store.setSyncEngine === 'function') {
        store.setSyncEngine(engine);
        return;
      }
    } catch (err) {
      throw err;
    }

    // Store does not provide a setter — record in the fallback registry.
    try {
      fallbackRegistry.set(store, engine);
      return;
    } catch (err) {
      throw err;
    }
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
