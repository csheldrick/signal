// ── Scoped Storage Bus ──────────────────────────────────────
// A scoped StorageEventBus that provides a typed view of the
// concrete implementation while keeping the contract separate.
// This module exports types to reduce circular dependencies and
// provide explicit typing for consumers.

import type { StorageEventType, StorageEvent, Listener } from './events.js';


// Scoped bus contract that extends the base event bus contract
// with scoped-specific capabilities.
export interface ScopedStorageEventBusContract {
  on(type: StorageEventType | '*', listener: Listener): void;
  off(type: StorageEventType | '*', listener: Listener): void;
  onAsync(type: StorageEventType | '*', listener: Listener): void;
  offAsync(type: StorageEventType | '*', listener: Listener): void;
  emit(event: StorageEvent): void;
  emitAsync(event: StorageEvent): void;
}

// Scoped implementation that wraps the concrete StorageEventBus
// with typed accessors.
export class ScopedStorageEventBus implements ScopedStorageEventBusContract {
  private _bus: any;
  
  constructor(bus: any) {
    this._bus = bus;
  }
  
  on(type: StorageEventType | '*', listener: Listener): void {
    try { this._bus.on(type, listener); } catch (_) { /* swallow */ }
  }
  
  off(type: StorageEventType | '*', listener: Listener): void {
    try { this._bus.off(type, listener); } catch (_) { /* swallow */ }
  }
  
  onAsync(type: StorageEventType | '*', listener: Listener): void {
    try { this._bus.onAsync(type, listener); } catch (_) { /* swallow */ }
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
}

// Export types for consumers that want to depend on the scoped bus contract.
export type { Listener };
