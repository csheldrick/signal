import { SYM_SYNC_ENGINE } from './store.js';

// Internal WeakMap-based registry used when the store object does not
// provide explicit getter/setter APIs. This avoids polluting host objects
// with multiple registration surfaces and centralizes registration for
// testability and determinism.
const weakRegistry = new WeakMap<object, any>();

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

    // Prefer explicit setter API when present.
    try {
      if (typeof store.setSyncEngine === 'function') {
        try { store.setSyncEngine(engine); return; } catch (_) { /* fallthrough */ }
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
