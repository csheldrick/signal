import { SYM_SYNC_ENGINE } from './store.js';

/**
 * Registry helpers for attaching and retrieving a canonical SyncEngine
 * instance from a store-like object. To reduce split ownership and avoid
 * multiple registration surfaces, we prefer store-provided accessors when
 * available, then the well-known SYM_SYNC_ENGINE symbol property, and as a
 * last-resort in-process WeakMap fallback for constrained hosts that do not
 * permit attaching properties to exotic store objects.
 *
 * Behavior:
 *  - getSyncEngineFromStore returns the result of store.getSyncEngine() if
 *    present, otherwise consults the store's SYM_SYNC_ENGINE symbol property
 *    when available, and finally consults an internal WeakMap registry.
 *    If direct symbol access throws (e.g. exotic proxies), we attempt a
 *    best-effort stringified-key fallback before consulting the WeakMap.
 *    Returns undefined when no engine is found.
 *  - setSyncEngineOnStore attempts to register via store.setSyncEngine(engine)
 *    when available; otherwise it will assign the SYM_SYNC_ENGINE symbol on
 *    the store object if possible. If defining the symbol property fails we
 *    attempt the stringified-key fallback used by some constrained runtimes
 *    and finally store the engine in an internal WeakMap. The WeakMap is
 *    non-invasive and avoids mutating host objects while still providing a
 *    canonical registry for environments that prohibit property attachment.
 */

// Internal fallback registry for hosts that cannot accept symbol/property
// attachment on store objects. WeakMap avoids leaking memory and is only used
// when explicit setter or symbol property assignment is not possible. This
// provides a predictable canonical binding in tests and exotic runtimes.
const internalRegistry = new WeakMap<object, any>();

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
        // fall through to WeakMap fallback
      }
    }
  }

  // WeakMap fallback: some hosts disallow attaching properties but the
  // process-local registry can provide a canonical engine binding without
  // mutating the host object. This keeps behavior deterministic in tests
  // and exotic runtimes while remaining non-invasive.
  try {
    if (typeof store === 'object' || typeof store === 'function') {
      if (internalRegistry.has(store)) return internalRegistry.get(store);
    }
  } catch (_) { /* swallow */ }

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
  // before using the WeakMap fallback so callers have maximum compatibility.
  if (typeof SYM_SYNC_ENGINE !== 'undefined' && (typeof store === 'object' || typeof store === 'function')) {
    try {
      Object.defineProperty(store, SYM_SYNC_ENGINE, { value: engine, writable: true, configurable: true });
      return;
    } catch (_) {
      try {
        // Best-effort fallback for constrained environments
        (store as any)[String(SYM_SYNC_ENGINE)] = engine;
        return;
      } catch (_err) {
        // Fall through to WeakMap fallback
      }
    }
  }

  // WeakMap fallback: if we cannot attach the engine to the host store,
  // record it in the internal WeakMap registry. This avoids mutating exotic
  // host objects while still providing a canonical process-local binding.
  try {
    if (typeof store === 'object' || typeof store === 'function') {
      internalRegistry.set(store, engine);
      return;
    }
  } catch (_) { /* swallow */ }

  // If we reach here, the host store does not provide an accessor and we
  // cannot attach the canonical engine symbol or registry; surface this as
  // an error so callers can take corrective action rather than silently
  // falling back.
  throw new Error('setSyncEngineOnStore: unable to register SyncEngine on store (no setter, symbol property, or registry available)');
}
