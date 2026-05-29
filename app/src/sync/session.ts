// ── Peer Session ─────────────────────────────────────────────
// Tracks connectivity state and clock knowledge for a single remote peer.
// Depends on: sync/protocol.

import type { PeerInfo, SyncMessage, SyncState, VectorClock } from './protocol.js';
import { mergeClocks, clocksEqual } from './protocol.js';

export class PeerSession {
  private _clock: VectorClock;
  private _state: SyncState;
  private _lastSeen: number;
  readonly peerId: string;

  /** Buffered inbound messages received while in 'syncing' state. */
  private inboundBuffer: SyncMessage[] = [];
  // Prevent unbounded growth under heavy inbound traffic; drop oldest when full.
  private maxInboundBufferSize: number;

  constructor(peerId: string, initialClock: VectorClock = {}, maxInboundBufferSize: number = 20) {
    this.peerId = peerId;
    this._clock = { ...initialClock };
    this._state = 'idle';
    this._lastSeen = 0;
    this.maxInboundBufferSize = Math.max(10, Math.min(200, maxInboundBufferSize)); // clamp to sane bounds to avoid large buffers under load
  }

  // ── State ──────────────────────────────────────────────────

  get state(): SyncState {
    return this._state;
  }

  get clock(): VectorClock {
    return { ...this._clock };
  }

  get lastSeen(): number {
    return this._lastSeen;
  }

  get info(): PeerInfo {
    return {
      peerId: this.peerId,
      clock: this.clock,
      lastSeen: this._lastSeen,
      state: this._state,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────

  /** Call when a transport connection to this peer is established. */
  onConnected(): void {
    this._state = 'syncing';
    this._lastSeen = Date.now();
  }

  /** Call when the transport disconnects cleanly. */
  onDisconnected(): void {
    this._state = 'idle';
  }

  /**
   * Update the local knowledge of this peer's clock from any inbound message.
   * Returns true if the clock actually advanced.
   */
  updateClock(incoming: VectorClock): boolean {
    const merged = mergeClocks(this._clock, incoming);
    const advanced = !this.clocksEqualLocal(merged, this._clock);
    this._clock = merged;
    this._lastSeen = Date.now();
    return advanced;
  }

  // ── Conflict / resolution state ───────────────────────────

  markConflicted(): void {
    this._state = 'conflicted';
  }

  markResolved(): void {
    this._state = 'resolved';
    // Leave state as 'resolved' so callers can observe and transition when appropriate.
  }

  private clocksEqualLocal(a: VectorClock | undefined, b: VectorClock | undefined): boolean {
    return clocksEqual(a, b);
  }

  // ── Inbound buffer ─────────────────────────────────────────
  // Messages that arrive while we are mid-sync are buffered and replayed
  // once the current sync round completes.

  buffer(message: SyncMessage): void {
    // Drop oldest when buffer reaches capacity to avoid unbounded memory use.
    if (this.inboundBuffer.length >= this.maxInboundBufferSize) {
      this.inboundBuffer.shift();
    }
    this.inboundBuffer.push(message);
  }

  drainBuffer(): SyncMessage[] {
    const drained = [...this.inboundBuffer];
    this.inboundBuffer = [];
    return drained;
  }

  get bufferSize(): number {
    return this.inboundBuffer.length;
  }

  /**
   * Adjust the maximum inbound buffer size at runtime. This allows callers
   * to tighten the landing capacity if memory pressure or subsystem overload
   * is observed. Values are clamped to a sensible range to avoid extremes.
   */
  setMaxInboundBufferSize(size: number): void {
    try {
      this.maxInboundBufferSize = Math.max(10, Math.min(200, Math.floor(size)));
      // Trim the buffer immediately if it currently exceeds the new cap.
      if (this.inboundBuffer.length > this.maxInboundBufferSize) {
        this.inboundBuffer = this.inboundBuffer.slice(-this.maxInboundBufferSize);
      }
    } catch (_) { /* swallow */ }
  }
}
