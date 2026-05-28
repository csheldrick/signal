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
 *    when available. Returns undefined when no engine is found.
 *  - setSyncEngineOnStore attempts to register via store.setSyncEngine(engine)
 *    when available; otherwise it will assign the SYM_SYNC_ENGINE symbol on
 *    the store object if possible. If neither mechanism is available the
 *    helper throws so callers can surface configuration failures instead of
 *    silently creating duplicate engines.
 */

export function getSyncEngineFromStore(store: any): any | undefined {
  if (!store) return undefined;

  // Prefer store-provided getter when present so hosts can explicitly
  // manage the canonical engine on their store implementation.
  if (typeof store.getSyncEngine === 'function') {
    return store.getSyncEngine();
  }

  // If the store exposes a well-known symbol property (DocumentStore sets
  // this symbol), prefer returning that value. This helps environments that
  // don't expose accessor methods but do store the canonical engine on the
  // instance via the shared symbol. Let property access errors surface so
  // callers become aware of misconfigured/proxied stores.
  if (typeof SYM_SYNC_ENGINE !== 'undefined' && (typeof store === 'object' || typeof store === 'function')) {
    return (store as any)[SYM_SYNC_ENGINE];
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
    store.setSyncEngine(engine);
    return;
  }

  // Attempt to set the well-known symbol property if available and the
  // store is an object. Use a non-enumerable property to avoid leaking on
  // iteration. If defineProperty fails, propagate the error so callers can
  // detect that registration is not possible in this environment.
  if (typeof SYM_SYNC_ENGINE !== 'undefined' && (typeof store === 'object' || typeof store === 'function')) {
    Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, writable: true, configurable: true });
    return;
  }

  // If we reach here, the host store does not provide an accessor and we
  // cannot attach the canonical engine symbol; surface this as an error so
  // callers can take corrective action rather than silently falling back.
  throw new Error('setSyncEngineOnStore: unable to register SyncEngine on store (no setter or symbol property)');
}
