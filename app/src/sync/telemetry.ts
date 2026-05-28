// Lightweight centralized telemetry emitter used by subsystems for structured
// observability. Intentionally minimal to avoid heavyweight dependencies.

export type TelemetryEvent = { type: string; payload: any };

class TelemetryCenter {
  private listeners: Set<(event: { type: string; payload: any }) => void> = new Set();
  private static readonly MAX_LISTENERS = 32; // cap to avoid unbounded observability fan-out
  // When many listeners are registered, prefer async delivery to avoid
  // synchronous fan-out that can block emitters. Keep small thresholds so
  // most telemetry remains synchronous for low-listener-count environments.
  private static readonly SYNC_THRESHOLD = 8;
  private static readonly MACROTASK_THRESHOLD = 64;

  emit(type: string, payload: any): void {
    const ev = { type, payload };
    const listeners = Array.from(this.listeners);
    try {
      if (listeners.length > TelemetryCenter.MACROTASK_THRESHOLD) {
        // Very large listener counts: schedule a macrotask to avoid blocking.
        setTimeout(() => {
          for (const l of listeners) {
            try { l(ev); } catch (_) { /* swallow */ }
          }
        }, 0);
        return;
      }

      if (listeners.length > TelemetryCenter.SYNC_THRESHOLD) {
        // Moderate listener counts: yield via a microtask to avoid immediate
        // synchronous fan-out while preserving reasonable ordering.
        Promise.resolve().then(() => {
          for (const l of listeners) {
            try { l(ev); } catch (_) { /* swallow */ }
          }
        });
        return;
      }

      // Small listener sets: invoke synchronously for deterministic semantics.
      for (const l of listeners) {
        try { l(ev); } catch (_) { /* swallow */ }
      }
    } catch (_) {
      // swallow any unexpected errors in telemetry emission
    }
  }

  on(listener: (event: { type: string; payload: any }) => void): () => void {
    try {
      if (this.listeners.size >= TelemetryCenter.MAX_LISTENERS) {
        try { console.warn('TelemetryCenter: listener limit reached; refusing to add'); } catch (_) {}
        return () => {};
      }
    } catch (_) {}
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  clear(): void {
    this.listeners.clear();
  }
}

import type { Observability } from '../core/types.js';

export const telemetry: Observability = new TelemetryCenter();
