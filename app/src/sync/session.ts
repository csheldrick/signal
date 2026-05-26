// ── Peer Session ─────────────────────────────────────────────
// Tracks connectivity state and clock knowledge for a single remote peer.
// Depends on: sync/protocol.

import type { PeerInfo, SyncMessage, SyncState, VectorClock } from './protocol.js';
import { mergeClocks } from './protocol.js';

export class PeerSession {
  private _clock: VectorClock;
  private _state: SyncState;
  private _lastSeen: number;
  readonly peerId: string;

  /** Buffered inbound messages received while in 'syncing' state. */
  private inboundBuffer: SyncMessage[] = [];

  constructor(peerId: string, initialClock: VectorClock = {}) {
    this.peerId = peerId;
    this._clock = { ...initialClock };
    this._state = 'idle';
    this._lastSeen = 0;
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
    const advanced = !this.clocksEqual(merged, this._clock);
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

  private clocksEqual(a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const k of aKeys) {
      if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
    }
    return true;
  }

  // ── Inbound buffer ─────────────────────────────────────────
  // Messages that arrive while we are mid-sync are buffered and replayed
  // once the current sync round completes.

  buffer(message: SyncMessage): void {
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
}
