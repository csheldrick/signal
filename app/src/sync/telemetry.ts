// Lightweight centralized telemetry emitter used by subsystems for structured
// observability. Intentionally minimal to avoid heavyweight dependencies.

export type TelemetryEvent = { type: string; payload: any };

class TelemetryCenter {
  private listeners: Set<(event: { type: string; payload: any }) => void> = new Set();

  emit(type: string, payload: any): void {
    const ev = { type, payload };
    for (const l of Array.from(this.listeners)) {
      try {
        l(ev);
      } catch (_) {
        // swallow listener errors to avoid telemetry causing failures
      }
    }
  }

  on(listener: (event: { type: string; payload: any }) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const telemetry = new TelemetryCenter();
