// ── Scoped Storage Bus ──────────────────────────────────────
// A scoped StorageEventBus that provides a typed view of the
// concrete implementation while keeping the contract separate.
// This module exports types to reduce circular dependencies and
// provide explicit typing for consumers.

import type { StorageEventType, StorageEvent, Listener } from './events.js';
import type { StorageEventBusContract } from './event-types.js';

// Scoped bus re-exports the canonical StorageEventBusContract to avoid a
// second, drifting contract that differed in subtle ways (e.g. disposer
// return values). Consumers should depend on ScopedStorageEventBusContract
// when they want a typed, narrow view of a concrete bus instance.
export type ScopedStorageEventBusContract = StorageEventBusContract;

// Scoped implementation that wraps the concrete StorageEventBus with typed
// accessors. This forwards all methods to the underlying bus and preserves
// return values (notably the disposer functions returned by on()/onAsync()).
export class ScopedStorageEventBus implements ScopedStorageEventBusContract {
  private _bus: any;

  constructor(bus: any) {
    this._bus = bus;
  }

  on(type: StorageEventType | '*', listener: Listener): () => void {
    try { return this._bus.on(type, listener); } catch (_) { return () => {}; }
  }

  off(type: StorageEventType | '*', listener: Listener): void {
    try { this._bus.off(type, listener); } catch (_) { /* swallow */ }
  }

  onAsync(type: StorageEventType | '*', listener: Listener): () => void {
    try { return this._bus.onAsync(type, listener); } catch (_) { return () => {}; }
  }

  offAsync(type: StorageEventType | '*', listener: Listener): void {
    try { this._bus.offAsync(type, listener); } catch (_) { /* swallow */ }
  }

  emit(event: StorageEvent): void {
    try { this._bus.emit(event); } catch (_) { /* swallow */ }
  }

  emitAsync(event: StorageEvent): void {
    try { this._bus.emitAsync(event); } catch (_) { /* swallow */ }
  }

  attachDocumentValidatorFromEvents(initial?: Iterable<string>): import('../core/types.js').DocumentValidatorAsync {
    try { return this._bus.attachDocumentValidatorFromEvents(initial); } catch (_) { return (async (_: string) => false) as any; }
  }

  attachDocumentValidatorSnapshot(initial?: Iterable<string>): import('../core/types.js').DocumentValidatorSync {
    try { return this._bus.attachDocumentValidatorSnapshot(initial); } catch (_) { return ((_: string) => false) as any; }
  }

  getTrace(): ReadonlyArray<import('../core/types.js').StorageEvent> {
    try { return this._bus.getTrace(); } catch (_) { return []; }
  }

  getListenerCounts(): { total: number; perType: Record<string, number>; asyncTotal: number } {
    try { return this._bus.getListenerCounts(); } catch (_) { return { total: 0, perType: {}, asyncTotal: 0 }; }
  }

  clearTrace(): void {
    try { this._bus.clearTrace(); } catch (_) { /* swallow */ }
  }

  removeAllListeners(): void {
    try { this._bus.removeAllListeners(); } catch (_) { /* swallow */ }
  }
}

// Export Listener type for convenience to consumers of the scoped bus.
export type { Listener };
