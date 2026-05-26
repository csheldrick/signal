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
  private heartbeatIntervalMs: number;
  private staleTimeoutMs: number;
  private timer?: ReturnType<typeof setInterval>;

  constructor(opts?: SyncSessionTrackerOptions) {
    super();
    this.heartbeatIntervalMs = opts?.heartbeatIntervalMs ?? 10_000; // default 10s
    this.staleTimeoutMs = opts?.staleTimeoutMs ?? 30_000; // default 30s

    try {
      this.timer = setInterval(() => this.checkStale(), Math.max(1000, Math.floor(this.heartbeatIntervalMs / 2)));
    } catch (_) {
      this.timer = undefined;
    }
  }

  openSession(peerId: string, _initialClock?: any): void {
    const now = Date.now();
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
    this.sessions.set(peerId, { state: 'open', lastHeartbeat: now });
    try { this.emit('event', { type: 'heartbeat', peerId, timestamp: now } as SyncSessionEvent); } catch (_) {}
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
