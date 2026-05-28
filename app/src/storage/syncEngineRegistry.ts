import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Registry helpers for attaching and retrieving a canonical SyncEngine
 * instance from a store-like object. To reduce split ownership and avoid
 * multiple registration surfaces, we prefer store-provided accessors when
 * available or the well-known SYM_SYNC_ENGINE symbol property. We no longer
 * maintain an in-process fallback registry to avoid divergent canonical
 * instances across hosts and to make registration errors explicit.
 *
 * Behavior:
 *  - getSyncEngineFromStore returns the result of store.getSyncEngine() if
 *    present, otherwise consults the store's SYM_SYNC_ENGINE symbol property
 *    when available. If direct symbol access throws (e.g. exotic proxies),
 *    we attempt a best-effort stringified-key fallback to remain compatible
 *    with constrained environments. Returns undefined when no engine is found.
 *  - setSyncEngineOnStore attempts to register via store.setSyncEngine(engine)
 *    when available; otherwise it will assign the SYM_SYNC_ENGINE symbol on
 *    the store object if possible. If defining the symbol property fails we
 *    attempt the stringified-key fallback used by some constrained runtimes.
 *    If neither mechanism is available the helper throws so callers can
 *    surface configuration failures instead of silently creating duplicate engines.
 */

export function getSyncEngineFromStore(store: any): any | undefined {
  if (!store) return undefined;

  // Prefer store-provided getter when present so hosts can explicitly
  // manage the canonical engine on their store implementation.
  if (typeof store.getSyncEngine === 'function') {
    try {
      return store.getSyncEngine();
    } catch (err) {
      // Propagate to make misconfigured accessors visible to callers
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  // If the store exposes a well-known symbol property (DocumentStore sets
  // this symbol), prefer returning that value. Some constrained hosts may
  // not allow direct symbol access and instead use a stringified key; try
  // both to maximize compatibility while keeping failures explicit.
  if (typeof SYM_SYNC_ENGINE !== 'undefined' && (typeof store === 'object' || typeof store === 'function')) {
    try {
      return (store as any)[SYM_SYNC_ENGINE];
    } catch (_) {
      // Best-effort fallback: some runtimes persist symbol values under
      // the stringified symbol key. Try that before giving up.
      try {
        return (store as any)[String(SYM_SYNC_ENGINE)];
      } catch (_) {
        return undefined;
      }
    }
  }

  // No canonical engine published on the store
  return undefined;
}

export function setSyncEngineOnStore(store: any, engine: any): void {
  if (!store) return;

  // Detect conflicting registrations and fail fast so callers must resolve
  // duplicate-engine situations explicitly rather than silently creating
  // parallel engines.
  const existing = getSyncEngineFromStore(store as any);
  if (existing !== undefined && existing !== engine) {
    throw new Error('setSyncEngineOnStore: conflicting SyncEngine already registered on store');
  }

  // Prefer explicit setter API when present. Hosts should implement this
  // to participate in canonical registration.
  if (typeof store.setSyncEngine === 'function') {
    try {
      store.setSyncEngine(engine);
      return;
    } catch (err) {
      // Propagate to aid diagnostics
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  // Attempt to set the well-known symbol property if available and the
  // store is an object. Use a non-enumerable property to avoid leaking on
  // iteration. If defineProperty fails, attempt a stringified-key fallback
  // before propagating the error so callers can detect that registration
  // is not possible in this environment.
  if (typeof SYM_SYNC_ENGINE !== 'undefined' && (typeof store === 'object' || typeof store === 'function')) {
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, writable: true, configurable: true });
      return;
    } catch (_) {
      try {
        // Best-effort fallback for constrained environments
        (store as any)[String(SYM_SYNC_ENGINE)] = engine;
        return;
      } catch (err) {
        // Propagate the original failure to surface configuration issues
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  // If we reach here, the host store does not provide an accessor and we
  // cannot attach the canonical engine symbol; surface this as an error so
  // callers can take corrective action rather than silently falling back.
  throw new Error('setSyncEngineOnStore: unable to register SyncEngine on store (no setter or symbol property)');
}
