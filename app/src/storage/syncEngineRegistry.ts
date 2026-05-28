import { SYM_SYNC_ENGINE } from './store.js';

// Internal WeakMap-based registry used when the store object does not
// provide explicit getter/setter APIs. This avoids polluting host objects
// with multiple registration surfaces and centralizes registration for
// testability and determinism.
const weakRegistry = new WeakMap<object, any>();

// Defensive lock to avoid races in environments that may attempt concurrent
// registration on the same host object. This is a best-effort advisory
// mutex; it reduces the window for duplicate engines but does not provide
// absolute atomicity across workers or isolates.
const registrationLocks = new WeakMap<object, boolean>();

/**
 * Retrieve a SyncEngine previously attached to a concrete store object.
 * Preference order:
 *  - store.getSyncEngine() / store.setSyncEngine(engine) (preferred)
 *  - a symbol-backed property (legacy / direct augmentation)
 *  - an internal WeakMap registry (new and preferred for non-intrusive hosts)
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

    // Finally consult the internal WeakMap registry for non-intrusive attachments.
    try {
      if (typeof store === 'object' && store !== null && weakRegistry.has(store)) {
        return weakRegistry.get(store);
      }
    } catch (_) {}

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
 *  - otherwise register in the internal WeakMap to avoid mutating host objects
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
          // Attempt a guarded registration to reduce races where two callers
          // try to set the engine simultaneously on exotic hosts.
          if (typeof store === 'object' && store !== null) {
            if (registrationLocks.has(store)) {
              // If another registration is in-flight, prefer to re-read the
              // canonical engine to avoid overwriting concurrently.
              const existing = getSyncEngineFromStore(store);
              if (existing !== undefined) return;
            }
            try { registrationLocks.set(store, true); } catch (_) {}
          }
          store.setSyncEngine(engine);
          try { registrationLocks.delete(store); } catch (_) {}
          return;
        } catch (_) {
          try { registrationLocks.delete(store); } catch (_) {}
          /* fallthrough */
        }
      }
    } catch (_) {}

    // Attempt to set a non-enumerable symbol-backed property for compatibility
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, enumerable: false, configurable: true, writable: true });
      return;
    } catch (_) {
      // fallthrough to WeakMap-based registration
    }

    // Fallback: register in internal WeakMap to avoid mutating exotic host objects
    try {
      if (typeof store === 'object' && store !== null) weakRegistry.set(store, engine);
    } catch (_) {
      // Swallow to be defensive about exotic host objects
    }
  } catch (_) {
    // Swallow to be defensive about exotic host objects
  }
}
