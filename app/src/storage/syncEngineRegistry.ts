import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Retrieve a SyncEngine previously attached to a concrete store object.
 * Preference order:
 *  - store.getSyncEngine() (preferred if provided by the host)
 *  - a symbol-backed property (legacy / direct augmentation)
 */
export function getSyncEngineFromStore(store: any): any | undefined {
  try {
    if (!store) return undefined;

    // Prefer explicit getter methods when present on the store object.
    try {
      if (typeof store.getSyncEngine === 'function') {
        try { return store.getSyncEngine(); } catch (err) { throw err; }
      }
    } catch (err) {
      // Propagate errors from host getter so callers can surface misconfiguration.
      throw err;
    }

    // Next prefer a non-enumerable symbol-backed property used by older codepaths.
    try {
      const symVal = (store as any)[SYM_SYNC_ENGINE];
      if (symVal !== undefined) return symVal;
    } catch (_) { /* ignore read failures */ }

    return undefined;
  } catch (e) {
    // Surface unexpected errors explicitly rather than swallowing to aid
    // debugging of registry-related failures.
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/**
 * Attach a SyncEngine to the provided store object.
 * Preference for registration:
 *  - call store.setSyncEngine(engine) when provided
 *  - set a non-enumerable symbol property when possible (legacy hosts)
 *
 * This centralizes registration and reduces accidental duplicate engine
 * creation by relying on the store's own accessor API when available and
 * otherwise falling back to a symbol property. We intentionally do NOT use
 * a WeakMap fallback to avoid creating an alternate registry surface.
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
      // Propagate registry read errors to the caller — do not swallow them.
      throw e;
    }

    // Prefer explicit setter API when present.
    try {
      if (typeof store.setSyncEngine === 'function') {
        try {
          store.setSyncEngine(engine);
          return;
        } catch (err) {
          // If the host setter failed, surface the error to aid diagnostics.
          throw err;
        }
      }
    } catch (err) {
      throw err;
    }

    // Attempt to set a non-enumerable symbol-backed property for compatibility
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, enumerable: false, configurable: true, writable: true });
      return;
    } catch (err) {
      // If we cannot set the property, propagate the error so callers can
      // detect that registration is unavailable rather than silently
      // creating an alternate registry surface.
      throw err;
    }
  } catch (e) {
    // Re-throw to ensure callers become aware of registry failures which
    // would otherwise lead to duplicate engines or missed registrations.
    throw e instanceof Error ? e : new Error(String(e));
  }
}
