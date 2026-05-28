/**
 * Simplified explicit registry helpers for attaching and retrieving the
 * canonical SyncEngine instance from a store-like object.
 *
 * Policy:
 *  - Only use explicit accessor methods on the store when present:
 *      - getSyncEngineFromStore will call store.getSyncEngine() and return
 *        its result (or undefined). If the accessor is missing it will
 *        throw so callers are aware that registration is not supported.
 *      - setSyncEngineOnStore will call store.setSyncEngine(engine). If the
 *        setter is missing the function will throw to make registration
 *        failures explicit instead of silently falling back to alternate
 *        registry surfaces.
 *
 * This removes legacy symbol-based and in-process WeakMap fallbacks to
 * centralize ownership and prevent split-registration surfaces that can
 * lead to duplicate SyncEngine instances and surprising listener duplication.
 */

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
  throw new Error('getSyncEngineFromStore: store.getSyncEngine() not available');
}

export function setSyncEngineOnStore(store: any, engine: any): void {
  if (!store) throw new Error('setSyncEngineOnStore: store is required');
  if (typeof store.setSyncEngine !== 'function') {
    throw new Error('setSyncEngineOnStore: store.setSyncEngine() not available');
  }
  try {
    store.setSyncEngine(engine);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}
