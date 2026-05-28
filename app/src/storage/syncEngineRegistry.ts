/**
 * Registry helpers for attaching and retrieving the canonical SyncEngine
 * instance from a store-like object.
 *
 * Policy:
 *  - Prefer explicit accessor methods on the store when available:
 *      - If store.getSyncEngine()/store.setSyncEngine() exist we call them
 *        and propagate any underlying errors.
 *  - When accessors are not present we fall back to a non-leaking in-process
 *    WeakMap registry to provide a deterministic, per-store canonical
 *    SyncEngine instance. This improves test determinism and prevents
 *    duplicate engines in hosts that don't implement explicit accessors.
 */

const fallbackRegistry: WeakMap<object, any> = new WeakMap();

export function getSyncEngineFromStore(store: any): any | undefined {
  if (!store) return undefined;
  if (typeof store.getSyncEngine === 'function') {
    try {
      return store.getSyncEngine();
    } catch (err) {
      // Propagate errors so callers become aware of accessor failures
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
  // Fallback: return a registered engine from the in-process WeakMap.
  try {
    if (typeof store === 'object' || typeof store === 'function') {
      return fallbackRegistry.get(store as object);
    }
  } catch (err) {
    // If WeakMap access fails for any reason, propagate as an explicit error
    throw err instanceof Error ? err : new Error(String(err));
  }
  return undefined;
}

export function setSyncEngineOnStore(store: any, engine: any): void {
  if (!store) throw new Error('setSyncEngineOnStore: store is required');
  if (typeof store.setSyncEngine === 'function') {
    try {
      store.setSyncEngine(engine);
      return;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  // Fallback: register the engine in the in-process WeakMap.
  try {
    if (typeof store === 'object' || typeof store === 'function') {
      fallbackRegistry.set(store as object, engine);
      return;
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  throw new Error('setSyncEngineOnStore: unable to attach engine to provided store');
}
