/* Centralized adapter for a small set of legacy globals.
 * This module provides typed setters/getters and isolates direct
 * globalThis reads/writes behind a small, auditable surface so the
 * rest of the codebase can avoid ad-hoc global side-effects.
 */

// Module-local storage used as the authoritative in-process value.
let _signalStorageEventBus: any | undefined;
let _disableBgSummarize: boolean | undefined;
let _signalStoreFilepath: string | undefined;

export function setSignalStorageEventBus(bus: any): void {
  _signalStorageEventBus = bus;
  try {
    // Keep legacy global slot for external adapters; swallow failures in
    // restricted environments (e.g. some test sandboxes).
    (globalThis as any).__SIGNAL_STORAGE_EVENT_BUS = bus;
  } catch (_) {
    /* swallow */
  }
}

export function getSignalStorageEventBus(): any | undefined {
  try {
    const g = (globalThis as any).__SIGNAL_STORAGE_EVENT_BUS;
    if (typeof g !== 'undefined') return g;
  } catch (_) {
    /* swallow */
  }
  return _signalStorageEventBus;
}

export function setDisableBgSummarize(v: boolean | undefined): void {
  _disableBgSummarize = v;
  try {
    (globalThis as any).__DISABLE_BG_SUMMARIZE = v;
  } catch (_) {
    /* swallow */
  }
}

export function getDisableBgSummarize(): boolean | undefined {
  try {
    const g = (globalThis as any).__DISABLE_BG_SUMMARIZE;
    if (typeof g !== 'undefined') return !!g;
  } catch (_) {
    /* swallow */
  }
  return _disableBgSummarize;
}

export function setSignalStoreFilepath(p: string | undefined): void {
  _signalStoreFilepath = p;
  try {
    (globalThis as any).__SIGNAL_STORE_FILEPATH = p;
  } catch (_) {
    /* swallow */
  }
}

export function getSignalStoreFilepath(): string | undefined {
  try {
    const g = (globalThis as any).__SIGNAL_STORE_FILEPATH;
    if (typeof g !== 'undefined') return g;
  } catch (_) {
    /* swallow */
  }
  return _signalStoreFilepath;
}
