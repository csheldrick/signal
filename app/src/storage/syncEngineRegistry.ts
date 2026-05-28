import { SYM_SYNC_ENGINE } from './store.js';

// Fallback WeakMap-based registry to centralize registration when the host
// store does not expose explicit getter/setter or is not extensible. Using a
// WeakMap avoids leaking memory and provides a single authoritative registry
// surface which reduces the risk of duplicate SyncEngine instances being
// silently created by different code paths.
const _registry = new WeakMap<object, any>();

/**
 * Retrieve a SyncEngine previously attached to a concrete store object.
 * Preference order:
 *  - store.getSyncEngine() / store.setSyncEngine(engine) (preferred)
 *  - a symbol-backed property (legacy / direct augmentation)
 *  - internal WeakMap registry (fallback)
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

    // Finally consult the internal WeakMap fallback registry.
    try {
      if (typeof store === 'object' && store !== null) {
        const found = _registry.get(store as object);
        if (found !== undefined) return found;
      }
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
 *  - WeakMap fallback when host objects are non-extensible or lack APIs
 *
 * This centralizes registration and reduces accidental duplicate engine
 * creation by providing a deterministic fallback registry when other
 * registration surfaces are not available.
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
      // fallthrough; if we cannot set property, use WeakMap fallback
    }

    // WeakMap fallback: use internal registry for non-extensible or unusual
    // host objects. This avoids mutating host objects and still provides a
    // canonical reference the rest of the system can rely on.
    try {
      if (typeof store === 'object' && store !== null) {
        _registry.set(store as object, engine);
        return;
      }
    } catch (_) {
      // Swallow to be defensive about exotic host objects, but avoid
      // providing implicit alternate registry surfaces when impossible.
    }
  } catch (_) {
    // Swallow to be defensive about exotic host objects, but avoid
    // providing implicit alternate registry surfaces.
  }
}
