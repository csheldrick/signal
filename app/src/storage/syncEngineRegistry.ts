import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Retrieve a SyncEngine previously attached to a concrete store object.
 * Preference order:
 *  - store.getSyncEngine() / store.setSyncEngine(engine) (preferred)
 *  - a symbol-backed property (legacy / direct augmentation)
 */
export function getSyncEngineFromStore(store: any): any | undefined {
  try {
    if (!store) return undefined;

    // Prefer explicit getter methods when present on the store object.
    try {
      if (typeof store.getSyncEngine === 'function') {
        try { return store.getSyncEngine(); } catch (_) { /* fallthrough */ }
      }
    } catch (_) {}

    // Next prefer a non-enumerable symbol-backed property used by older codepaths.
    try {
      const symVal = (store as any)[SYM_SYNC_ENGINE];
      if (symVal !== undefined) return symVal;
    } catch (_) { /* ignore */ }

    return undefined;
  } catch (_) {
    return undefined;
  }
}

/**
 * Attach a SyncEngine to the provided store object.
 * Preference for registration:
 *  - call store.setSyncEngine(engine) when provided
 *  - set a non-enumerable symbol property when possible (legacy hosts)
 *
 * Note: We deliberately avoid any internal WeakMap fallback to keep the
 * registry surface explicit and deterministic; callers should prefer using
 * the store's getter/setter API or the symbol-backed property on the store.
 */
export function setSyncEngineOnStore(store: any, engine: any): void {
  try {
    if (!store) return;

    // If an engine is already registered on this store and it differs from
    // the provided one, fail fast so callers can detect configuration errors
    // instead of silently creating duplicate engines.
    try {
      const existing = getSyncEngineFromStore(store);
      if (existing !== undefined && existing !== engine) {
        throw new Error('setSyncEngineOnStore: conflicting SyncEngine already registered on store');
      }
    } catch (e) {
      // If getSyncEngineFromStore itself throws, propagate to caller to
      // surface the registry inconsistency.
      throw e;
    }

    // Prefer explicit setter API when present.
    try {
      if (typeof store.setSyncEngine === 'function') {
        try {
          store.setSyncEngine(engine);
          return;
        } catch (_) {
          /* fallthrough */
        }
      }
    } catch (_) {}

    // Attempt to set a non-enumerable symbol-backed property for compatibility
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, enumerable: false, configurable: true, writable: true });
      return;
    } catch (_) {
      // fallthrough; if we cannot set property, we intentionally do not
      // attempt hidden fallbacks so that callers observe explicit failures
      // instead of silent best-effort registrations.
    }
  } catch (_) {
    // Swallow to be defensive about exotic host objects, but avoid
    // providing implicit alternate registry surfaces.
  }
}
