// Lightweight centralized telemetry emitter used by subsystems for structured
// observability. Intentionally minimal to avoid heavyweight dependencies.

export type TelemetryEvent = { type: string; payload: any };

class TelemetryCenter {
  private listeners: Set<(event: { type: string; payload: any }) => void> = new Set();
  // Tighter caps to reduce observability-induced fan-out in large deployments.
  private static readonly MAX_LISTENERS = 8; // lower cap to limit global telemetry subscribers
  // When many listeners are registered, prefer async delivery to avoid
  // synchronous fan-out that can block emitters. Keep small thresholds so
  // most telemetry remains synchronous for low-listener-count environments.
  private static readonly SYNC_THRESHOLD = 2; // lower threshold to yield earlier
  private static readonly MACROTASK_THRESHOLD = 8; // schedule macrotasks sooner for very large listener counts
  // Simple per-event-type debounce to avoid tight emit storms for hot events.
  private lastEmit: Map<string, number> = new Map();
  private static readonly MIN_EMIT_MS = 50; // increase debounce to reduce hot-event pressure

  emit(type: string, payload: any): void {
    const ev = { type, payload };
    // Debounce frequent identical events to protect listeners from hot loops
    try {
      const now = Date.now();
      const last = this.lastEmit.get(type) || 0;
      if (now - last < TelemetryCenter.MIN_EMIT_MS) return;
      this.lastEmit.set(type, now);
    } catch (_) {}

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

  // Optional diagnostic helper to inspect current listener count without
  // relying on implementation-specific internals. This aids tests and
  // monitoring tools in asserting telemetry subscription state.
  listenerCount(): number {
    return this.listeners.size;
  }
}

export const telemetry: { emit(type: string, payload: any): void; on(listener: (event: { type: string; payload: any }) => void): () => void; clear(): void; listenerCount?: () => number; } = new TelemetryCenter();
