/**
 * Registry helpers for attaching and retrieving a canonical SyncEngine
 * instance from a store-like object. To reduce split ownership and avoid
 * multiple registration surfaces, we prefer an explicit host-provided
 * accessor API (store.getSyncEngine / store.setSyncEngine). If these are
 * unavailable this helper will return undefined or throw on set to make
 * the absence of a canonical registry explicit to callers.
 */
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

    // If the host does not expose an accessor, do not fabricate a parallel
    // registry here. Returning undefined makes the absence of a canonical
    // engine explicit and avoids accidental duplicate surfaces.
    return undefined;
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
    // to participate in canonical registration. If absent we throw rather
    // than creating an alternative registry surface which otherwise leads
    // to duplicate engines and ambiguous ownership.
    try {
      if (typeof store.setSyncEngine === 'function') {
        store.setSyncEngine(engine);
        return;
      }
    } catch (err) {
      throw err;
    }

    // Host does not support setSyncEngine — surface as an error to encourage
    // callers to either provide their own engine via options or ensure the
    // host store implements the required accessor methods.
    throw new Error('setSyncEngineOnStore: store does not expose setSyncEngine; cannot register SyncEngine');
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
