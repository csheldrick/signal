/**
 * Registry helpers for attaching and retrieving a canonical SyncEngine
 * instance from a store-like object. To reduce split ownership and avoid
 * multiple registration surfaces, we require hosts to provide explicit
 * getSyncEngine / setSyncEngine accessors on their store implementation.
 *
 * Behavior:
 *  - getSyncEngineFromStore returns the result of store.getSyncEngine() if
 *    present, otherwise undefined. It will propagate errors thrown by the
 *    host getter to make misconfiguration visible.
 *  - setSyncEngineOnStore attempts to register via store.setSyncEngine(engine)
 *    when available. If the store does not expose a setter this helper will
 *    throw to make the lack of a canonical registry explicit to callers so
 *    they can migrate their store implementation to include the accessor.
 */

export function getSyncEngineFromStore(store: any): any | undefined {
  try {
    if (!store) return undefined;

    if (typeof store.getSyncEngine === 'function') {
      return store.getSyncEngine();
    }

    // No explicit getter provided by the store — return undefined so callers
    // can decide how to proceed (e.g. create a new engine or fail fast).
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
    // to participate in canonical registration. If absent throw so callers
    // are forced to opt-in by implementing the accessor rather than relying
    // on a hidden global fallback which can lead to duplicate engines.
    if (typeof store.setSyncEngine === 'function') {
      store.setSyncEngine(engine);
      return;
    }

    throw new Error('setSyncEngineOnStore: store does not expose setSyncEngine — implement setSyncEngine on your store to allow canonical engine registration');
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}
