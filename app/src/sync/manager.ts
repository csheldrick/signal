// ── Sync Manager ─────────────────────────────────────────────
// Top-level coordinator:
//   • subscribes to DocumentStore events → enqueues outbound SyncMessages
//   • accepts inbound messages from transport → applies via SyncEngine
//   • manages PeerSessions
//   • runs periodic flush loop
//
// Depends on: storage/store, sync/engine, sync/queue, sync/session,
//             sync/conflict, sync/protocol.

import type { DocumentStore } from '../storage/store.js';
import type { StorageEvent } from '../storage/events.js';
import type { ConflictStrategy, SyncMessage, VectorClock } from './protocol.js';
import { SyncEngine } from './engine.js';
import { SyncQueue } from './queue.js';
import { PeerSession } from './session.js';
import { isConflict, resolveConflict } from './conflict.js';
import type { ConflictRecord } from './protocol.js';

/** Pluggable transport send function. Implementations wire WebSocket / WebRTC / etc. */
export type TransportSend = (peerId: string, message: SyncMessage) => Promise<void>;

export interface SyncManagerOptions {
  /** Local peer identifier. */
  peerId: string;
  /** Strategy to use when concurrent writes collide. Default 'last-write-wins'. */
  conflictStrategy?: ConflictStrategy;
  /** How often (ms) the flush loop runs. Default 200. */
  flushIntervalMs?: number;
}

export class SyncManager {
  private readonly engine: SyncEngine;
  private readonly queue: SyncQueue;
  private readonly sessions: Map<string, PeerSession> = new Map();
  private readonly conflictLog: ConflictRecord[] = [];
  private readonly conflictStrategy: ConflictStrategy;
  private readonly peerId: string;
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private transport: TransportSend | undefined;
  private authValidator?: (peerId: string, message?: SyncMessage) => boolean;
  private telemetryListeners: Set<(event: { type: string; payload: any }) => void> = new Set();

  constructor(
    private readonly store: DocumentStore,
    opts: SyncManagerOptions,
  ) {
    this.peerId = opts.peerId;
    this.conflictStrategy = opts.conflictStrategy ?? 'last-write-wins';

    this.engine = new SyncEngine(store, opts.peerId);
    this.queue = new SyncQueue();

    // Auto-enqueue on every local store mutation.
    store.events.on('*', (event: StorageEvent) => {
      const message = this.engine.generateOutbound(event);
      if (message) {
        void this.queue.enqueue(message);
      }
    });
  }

  // ── Transport wiring ──────────────────────────────────────

  /** Attach a transport. The manager will call this whenever it has messages to send. */
  setTransport(send: TransportSend, authValidator?: (peerId: string, message?: SyncMessage) => boolean): void {
    this.transport = send;
    this.authValidator = authValidator;
  }

  /**
   * Register a telemetry/metrics listener. Returns a disposer to remove it.
   */
  onTelemetry(listener: (event: { type: string; payload: any }) => void): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  private emitTelemetry(type: string, payload: any): void {
    for (const l of this.telemetryListeners) {
      try { l({ type, payload }); } catch (_) { /* swallow listener errors */ }
    }
  }

  // ── Peer lifecycle ─────────────────────────────────────────

  addPeer(peerId: string, initialClock: VectorClock = {}): PeerSession {
    if (this.sessions.has(peerId)) return this.sessions.get(peerId)!;
    const session = new PeerSession(peerId, initialClock);
    session.onConnected();
    this.sessions.set(peerId, session);
    return session;
  }

  removePeer(peerId: string): void {
    const session = this.sessions.get(peerId);
    if (session) {
      session.onDisconnected();
      this.sessions.delete(peerId);
    }
  }

  getPeer(peerId: string): PeerSession | undefined {
    return this.sessions.get(peerId);
  }

  listPeers(): PeerSession[] {
    return Array.from(this.sessions.values());
  }

  // ── Inbound ───────────────────────────────────────────────

  /**
   * Receive an inbound message from a peer.
   * Detects conflicts, resolves them, then applies to the local store.
   */
  receive(message: SyncMessage): void {
    let session = this.sessions.get(message.peerId);
    if (!session) {
      session = this.addPeer(message.peerId, message.clock);
    }

    // Authorization check for inbound messages. If an authValidator exists and
    // declines the message, we ignore it to avoid applying unauthorized changes.
    if (this.authValidator && !this.authValidator(message.peerId, message)) {
      this.emitTelemetry('inbound_rejected', { peerId: message.peerId, message });
      return;
    }

    session.updateClock(message.clock);

    if (message.operation === 'update') {
      const localDoc = this.store.read(message.documentId);
      if (localDoc) {
        const localClock = this.engine.getClock();
        if (isConflict(localClock, message.clock)) {
          const remoteDoc = (() => {
            const payload = message.payload as {
              title?: string;
              content?: string;
              tags?: string[];
            };
            return {
              ...localDoc,
              ...payload,
              updatedAt: message.timestamp,
            };
          })();

          session.markConflicted();
          const { winner, record } = resolveConflict(
            {
              documentId: message.documentId,
              local: localDoc,
              localClock,
              remote: remoteDoc,
              remoteClock: message.clock,
            },
            this.conflictStrategy,
          );
          this.conflictLog.push(record);
          session.markResolved();

          // Apply the winning version if it differs from what we have.
          if (winner !== localDoc) {
            this.store.update(message.documentId, {
              title: winner.title,
              content: winner.content,
              tags: winner.tags,
            });
          }
          return;
        }
      }
    }

    this.engine.applyRemoteChange(message);
  }

  // ── Outbound flush ────────────────────────────────────────

  /**
   * Flush due outbound messages to all connected peers.
   * Called automatically by the flush loop; also available for manual flush.
   */
  async flush(): Promise<void> {
    // No transport attached or no sessions — nothing to send.
    if (!this.transport || this.sessions.size === 0) return;

    const due = this.queue.peek();
    for (const entry of due) {
      // Collect sessions eligible to receive this message.
      const recipients: PeerSession[] = [];
      for (const session of this.sessions.values()) {
        if (session.state === 'idle' || session.state === 'resolved') {
          recipients.push(session);
        }
      }

      if (recipients.length === 0) continue;

      // Send to all eligible recipients in parallel. Use Promise.allSettled so
      // one failure does not short-circuit other sends and we can inspect
      // results to decide whether to ack or fail the queued entry.
      const sendPromises = recipients.map(s => {
        try {
          // If an auth validator is present and declines this recipient, reject
          // immediately to record a delivery failure for that peer.
          if (this.authValidator && !this.authValidator(s.peerId, entry.message)) {
            return Promise.reject(new Error('unauthorized'));
          }
          // transport is non-null here (checked above). Wrap in Promise.resolve
          // to ensure synchronous throws become rejections.
          return Promise.resolve(this.transport!(s.peerId, entry.message));
        } catch (err) {
          return Promise.reject(err);
        }
      });

      const results = await Promise.allSettled(sendPromises);

      // If every send succeeded, ack the entry once. Otherwise fail once with
      // the first error so the queue's retry/failure policy can handle it.
      const firstReject = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
      // Emit per-peer delivery telemetry and decide ack/fail semantics.
      for (let i = 0; i < recipients.length; i++) {
        const r = results[i] as PromiseSettledResult<void> | undefined;
        const peerId = recipients[i].peerId;
        const success = r && r.status === 'fulfilled';
        this.emitTelemetry('deliver_attempt', { peerId, message: entry.message, success });
      }

      if (!firstReject) {
        this.queue.ack(entry.message);
        this.emitTelemetry('queue_ack', { message: entry.message });
      } else {
        const err = firstReject.reason instanceof Error ? firstReject.reason : new Error(String(firstReject.reason));
        this.queue.fail(entry.message, err);
        this.emitTelemetry('queue_fail', { message: entry.message, error: err });
      }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────

  start(flushIntervalMs = 200): void {
    if (this.flushTimer !== undefined) return;
    this.flushTimer = setInterval(() => void this.flush(), flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer !== undefined) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.queue.clear();
  }

  // ── Diagnostics ───────────────────────────────────────────

  getConflictLog(): ConflictRecord[] {
    return [...this.conflictLog];
  }

  getClock(): VectorClock {
    return this.engine.getClock();
  }

  getQueueSize(): number {
    return this.queue.size;
  }
}
