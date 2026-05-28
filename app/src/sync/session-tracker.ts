import { EventEmitter } from 'node:events';

export type SyncSessionState = 'open' | 'closed';

export interface SyncSessionEvent {
  type: 'opened' | 'closed' | 'heartbeat' | 'stale_detected';
  peerId: string;
  timestamp: number;
}

export interface SyncSessionTrackerOptions {
  heartbeatIntervalMs?: number;
  staleTimeoutMs?: number;
}

/**
 * SyncSessionTracker
 *
 * Manages per-peer sync session lifecycle. Emits events on an internal bus
 * so multiple subsystems (SyncManager, PresenceTracker) can observe a
 * single authoritative session view.
 */
export class SyncSessionTracker extends EventEmitter {
  private sessions: Map<string, { state: SyncSessionState; lastHeartbeat: number }> = new Map();
  // Soft cap on tracked sessions to avoid unbounded memory growth when many peers connect.
  private static readonly MAX_SESSIONS = 1000; // cap total tracked sessions
  private heartbeatIntervalMs: number;
  private staleTimeoutMs: number;
  private timer?: ReturnType<typeof setInterval>;

  constructor(opts?: SyncSessionTrackerOptions) {
    super();
    // Reduce EventEmitter listener ceiling to avoid accidental memory growth
    // when many subsystems attach to the tracker. Callers that legitimately
    // need more listeners may call setMaxListeners on the tracker instance.
    try { this.setMaxListeners(50); } catch (_) {}
    // Increase defaults to reduce hot timers and event fan-out
    this.heartbeatIntervalMs = opts?.heartbeatIntervalMs ?? 30_000; // default 30s
    this.staleTimeoutMs = opts?.staleTimeoutMs ?? 120_000; // default 2min

    try {
      this.timer = setInterval(() => this.checkStale(), Math.max(1000, Math.floor(this.heartbeatIntervalMs / 2)));
    } catch (_) {
      this.timer = undefined;
    }
  }

  openSession(peerId: string, _initialClock?: any): void {
    const now = Date.now();
    // Enforce soft cap on total tracked sessions to avoid unbounded memory growth.
    try {
      if (!this.sessions.has(peerId) && this.sessions.size >= SyncSessionTracker.MAX_SESSIONS) {
        // Prefer removing closed/stale sessions first
        for (const [k, v] of this.sessions.entries()) {
          if (v.state === 'closed') {
            this.sessions.delete(k);
            break;
          }
        }
        // If still at capacity, evict the least-recently-updated session
        if (this.sessions.size >= SyncSessionTracker.MAX_SESSIONS) {
          let oldestKey: string | undefined;
          let oldestTime = Infinity;
          for (const [k, v] of this.sessions.entries()) {
            if (v.lastHeartbeat < oldestTime) {
              oldestTime = v.lastHeartbeat;
              oldestKey = k;
            }
          }
          if (oldestKey) this.sessions.delete(oldestKey);
        }
      }
    } catch (_) { /* swallow eviction errors */ }

    const prev = this.sessions.get(peerId);
    this.sessions.set(peerId, { state: 'open', lastHeartbeat: now });
    if (!prev || prev.state !== 'open') {
      try { this.emit('event', { type: 'opened', peerId, timestamp: now } as SyncSessionEvent); } catch (_) {}
    }
  }

  closeSession(peerId: string): void {
    const now = Date.now();
    const prev = this.sessions.get(peerId);
    if (!prev || prev.state === 'closed') return;
    this.sessions.set(peerId, { state: 'closed', lastHeartbeat: now });
    try { this.emit('event', { type: 'closed', peerId, timestamp: now } as SyncSessionEvent); } catch (_) {}
  }

  updateHeartbeat(peerId: string): void {
    const now = Date.now();
    const prev = this.sessions.get(peerId);
    if (!prev) {
      this.sessions.set(peerId, { state: 'open', lastHeartbeat: now });
      try { this.emit('event', { type: 'opened', peerId, timestamp: now } as SyncSessionEvent); } catch (_) {}
      return;
    }

    // Only emit heartbeat events periodically to avoid heavy fan-out when
    // many peers frequently pulse. Emit at most once per (heartbeatIntervalMs/2).
    const minDelta = Math.floor(this.heartbeatIntervalMs / 2);
    const shouldEmitHeartbeat = (now - prev.lastHeartbeat) >= minDelta;

    this.sessions.set(peerId, { state: 'open', lastHeartbeat: now });
    if (shouldEmitHeartbeat) {
      try { this.emit('event', { type: 'heartbeat', peerId, timestamp: now } as SyncSessionEvent); } catch (_) {}
    }
  }

  list(): string[] {
    return Array.from(this.sessions.keys());
  }

  isOpen(peerId: string): boolean {
    const s = this.sessions.get(peerId);
    return !!s && s.state === 'open';
  }

  private checkStale(): void {
    try {
      const now = Date.now();
      for (const [peerId, s] of this.sessions.entries()) {
        if (s.state === 'open' && now - s.lastHeartbeat > this.staleTimeoutMs) {
          // mark stale: close session and emit stale_detected
          this.sessions.set(peerId, { state: 'closed', lastHeartbeat: s.lastHeartbeat });
          try { this.emit('event', { type: 'stale_detected', peerId, timestamp: now } as SyncSessionEvent); } catch (_) {}
        }
      }
    } catch (_) { /* swallow */ }
  }

  dispose(): void {
    try { if (this.timer) clearInterval(this.timer); } catch (_) {}
    try { this.removeAllListeners(); } catch (_) {}
  }
}
