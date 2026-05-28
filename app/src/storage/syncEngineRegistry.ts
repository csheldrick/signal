import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Retrieve a SyncEngine previously attached to a concrete store object.
 * This helper is tolerant of two registration surfaces:
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

    // Fallback to symbol-backed property used by older codepaths.
    try {
      return (store as any)[SYM_SYNC_ENGINE];
    } catch (_) {
      return undefined;
    }
  } catch (_) {
    return undefined;
  }
}

/**
 * Attach a SyncEngine to the provided store object.
 * If the store exposes a setSyncEngine method we prefer calling it so
 * stores can implement custom registration semantics; otherwise we attach
 * under a non-enumerable symbol property for compatibility.
 */
export function setSyncEngineOnStore(store: any, engine: any): void {
  try {
    if (!store) return;
    // Prefer explicit setter API when present.
    try {
      if (typeof store.setSyncEngine === 'function') {
        try { store.setSyncEngine(engine); return; } catch (_) { /* fallthrough to symbol */ }
      }
    } catch (_) {}

    // Fallback to symbol-backed non-enumerable property.
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, enumerable: false, configurable: true, writable: true });
    } catch (_) {
      // Some hosts disallow defineProperty — fall back to direct assignment.
      try { (store as any)[SYM_SYNC_ENGINE] = engine; } catch (_) { /* swallow */ }
    }
  } catch (_) {
    // Swallow to be defensive about exotic host objects
  }
}
