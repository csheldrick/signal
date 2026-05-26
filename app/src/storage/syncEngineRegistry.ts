import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Retrieve a SyncEngine previously attached to a concrete store object.
 * This is the single canonical accessor used across the codebase; stores
 * may choose to expose their own getSyncEngine/setSyncEngine but consumers
 * should prefer these helpers so registration is consistent.
 */
export function getSyncEngineFromStore(store: any): any | undefined {
  try {
    if (!store) return undefined;
    return (store as any)[SYM_SYNC_ENGINE];
  } catch (_) {
    return undefined;
  }
}

/**
 * Attach a SyncEngine to the provided store object under a non-enumerable
 * symbol property. This avoids name collisions with store APIs while
 * providing a stable registration surface.
 */
export function setSyncEngineOnStore(store: any, engine: any): void {
  try {
    if (!store) return;
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, enumerable: false, configurable: true, writable: true });
    } catch (_) {
      // Fallback to direct assignment when defineProperty is disallowed
      (store as any)[SYM_SYNC_ENGINE] = engine;
    }
  } catch (_) {
    // Swallow to be defensive about exotic host objects
  }
}
