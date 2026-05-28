import { SYM_SYNC_ENGINE } from './store.js';

// Exported in-process fallback registry for hosts that cannot accept symbol/property
// attachment on store objects. Tests and other subsystems may read this registry
// for deterministic inspection in exotic runtimes.
export const fallbackRegistry: { weak: WeakMap<object, any>; map: Map<string, any> } = {
  weak: new WeakMap<object, any>(),
  map: new Map<string, any>(),
};


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

// Note: keep a non-invasive, process-local fallback registry. We use a
// WeakMap for object/function store keys and a Map<string,any> for primitive
// or non-WeakMap-able keys. The exported `fallbackRegistry` above is the
// authoritative in-process registry consumers/tests may inspect.
// (declared above)


export function getSyncEngineFromStore(store: any): any | undefined {
  if (!store) return undefined;

  // Centralized lookup: consult the well-known symbol property or the
  // in-process fallback registry. We intentionally avoid calling arbitrary
  // store.getSyncEngine/setSyncEngine accessors here to prevent split
  // ownership and accidental recursive accessor cycles. Hosts should use
  // the registry helpers to register engines rather than implementing
  // custom getters/setters on store objects.

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

  // WeakMap / Map fallback: some hosts disallow attaching properties but the
  // process-local registry can provide a canonical engine binding without
  // mutating the host object. Use WeakMap for object/function keys and Map
  // for primitive or string-keyed stores. This keeps behavior deterministic
  // in tests and exotic runtimes while remaining non-invasive.
  try {
    if (typeof store === 'object' || typeof store === 'function') {
      if (fallbackRegistry.weak.has(store)) return fallbackRegistry.weak.get(store);
    } else {
      const key = String(store);
      if (fallbackRegistry.map.has(key)) return fallbackRegistry.map.get(key);
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
  // before using the in-process fallback so callers have maximum compatibility.
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
        // Fall through to in-process fallback
      }
    }
  }

  // In-process fallback: if we cannot attach the engine to the host store,
  // record it in the exported fallbackRegistry. Use WeakMap for object
  // keys and Map<string,any> for primitive keys.
  try {
    if (typeof store === 'object' || typeof store === 'function') {
      fallbackRegistry.weak.set(store, engine);
      return;
    }
    const key = String(store);
    fallbackRegistry.map.set(key, engine);
    return;
  } catch (_) { /* swallow */ }

  // If we reach here, the host store does not provide an accessor and we
  // cannot attach the canonical engine symbol or registry; surface this as
  // an error so callers can take corrective action rather than silently
  // falling back.
  throw new Error('setSyncEngineOnStore: unable to register SyncEngine on store (no setter, symbol property, or registry available)');
}
