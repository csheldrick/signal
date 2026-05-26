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
import { getSyncEngineFromStore, setSyncEngineOnStore } from '../storage/syncEngineRegistry.js';
import { SyncQueue } from './queue.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
  /** Optional externally-provided SyncEngine instance to avoid duplicate engine creation. */
  engine?: SyncEngine;
  /** Optional external session tracker so PresenceTracker and SyncManager can share authoritative sessions. */
  sessionTracker?: { openSession(peerId: string, initialClock?: VectorClock): void; closeSession(peerId: string): void; updateHeartbeat?(peerId: string): void };
  /** Optional snapshot service to compact vector clocks and expose snapshot hooks. */
  snapshotService?: { compactClock?: (clock: VectorClock) => VectorClock };
}

export class SyncManager {
  private readonly engine: SyncEngine;
  private readonly queue: SyncQueue;
  private readonly sessionTracker?: { openSession(peerId: string, initialClock?: VectorClock): void; closeSession(peerId: string): void; updateHeartbeat?(peerId: string): void };
  private readonly snapshotService?: { compactClock?: (clock: VectorClock) => VectorClock };
  private readonly sessions: Map<string, PeerSession> = new Map();
  private readonly conflictLog: ConflictRecord[] = [];
  private readonly conflictStrategy: ConflictStrategy;
  private readonly peerId: string;
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private transport: TransportSend | undefined;
  private authValidator?: (peerId: string, message?: SyncMessage) => boolean;
  private static readonly MAX_TELEMETRY_LISTENERS = 32;
  private telemetryListeners: Set<(event: { type: string; payload: any }) => void> = new Set();

  constructor(
    private readonly store: DocumentStore,
    opts: SyncManagerOptions,
  ) {
    this.peerId = opts.peerId;
    this.conflictStrategy = opts.conflictStrategy ?? 'last-write-wins';

    // Reuse an existing engine attached to the store when possible to avoid
    // creating duplicate SyncEngine instances that would lead to divergent
    // VectorClock histories. Cache the engine on the store under a non-enumerable
    // property name to keep it private.
    if (opts.engine) {
      this.engine = opts.engine;
    } else {
      try {
      const fromStore = getSyncEngineFromStore(store as any);
      if (fromStore) {
        this.engine = fromStore;
      } else {
        // Use canonical factory which consults store accessors or falls back
        // to the internal WeakMap registry. Register on the store if possible.
        const created = SyncEngine.getOrCreate(store as any, opts.peerId);
        try { setSyncEngineOnStore(store as any, created); } catch (_) { /* swallow */ }
        this.engine = created;
      }
      } catch (_) {
        // Best-effort fallback to factory when any accessor inspection fails.
        this.engine = SyncEngine.getOrCreate(store as any, opts.peerId);
      }
    }
    this.queue = new SyncQueue();
    // Attach optional external hooks (readonly assignment allowed in constructor)
    this.sessionTracker = opts.sessionTracker;
    this.snapshotService = opts.snapshotService;

    // Outbound generation is driven by the SyncEngine. Rather than subscribing
    // directly to store.events and enqueueing immediately (which can cause
    // duplicate enqueues and high synchronous fan-out when many listeners exist),
    // we centralize draining the engine's outbound buffer during flush(). This
    // provides a single controlled point for backpressure and avoids duplicate
    // work when other engines/listeners are present.
    // (Previously this block subscribed to store.events and enqueued directly.)
  }

  // ── Transport wiring ──────────────────────────────────────

  /** Attach a transport. The manager will call this whenever it has messages to send. */
  setTransport(send: TransportSend, authValidator?: (peerId: string, message?: SyncMessage) => boolean): void {
    // Wrap the provided transport with a light-weight yielding wrapper when
    // the session count is large so that heavy synchronous send bursts are
    // converted into asynchronous macrotasks. This reduces risk of blocking
    // the event loop when many peers are connected.
    this.authValidator = authValidator;

    const WRAP_SESSION_THRESHOLD = 50;
    this.transport = async (peerId: string, message: SyncMessage) => {
      try {
        if (this.sessions.size > WRAP_SESSION_THRESHOLD) {
          // Use a macrotask to yield; wrap the underlying send so callers see
          // a Promise-based API as before.
          return new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              Promise.resolve(send(peerId, message)).then(resolve).catch(reject);
            }, 0);
          });
        }
        return send(peerId, message);
      } catch (err) {
        return Promise.reject(err);
      }
    };
  }

  /**
   * Register a telemetry/metrics listener. Returns a disposer to remove it.
   */
  onTelemetry(listener: (event: { type: string; payload: any }) => void): () => void {
    try {
      if (this.telemetryListeners.size >= SyncManager.MAX_TELEMETRY_LISTENERS) {
        try { console.warn('SyncManager: telemetry listener limit reached; refusing to add'); } catch (_) {}
        return () => {};
      }
    } catch (_) {}

    this.telemetryListeners.add(listener);
    return () => { this.telemetryListeners.delete(listener); };
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
    try { this.sessionTracker?.openSession(peerId, initialClock); } catch (_) {}
    return session;
  }

  removePeer(peerId: string): void {
    const session = this.sessions.get(peerId);
    if (session) {
      session.onDisconnected();
      this.sessions.delete(peerId);
      try { this.sessionTracker?.closeSession(peerId); } catch (_) {}
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
      try { this.emitTelemetry('conflict_detected', { documentId: message.documentId, peerId: message.peerId, localClock, remoteClock: message.clock }); } catch (_) { /* swallow */ }
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
    // First, drain any outbound messages produced by the SyncEngine into the queue
    // so outbound generation is coalesced and controlled by the manager's flush
    // cadence instead of being enqueued directly by every storage event.
    try {
      const outbound = this.engine.drainOutbound();
      {
      // Batch enqueue outbound messages concurrently to avoid serializing the flush
      // on each individual enqueue while still honoring the queue's retry semantics.
      const enqPromises: Promise<void>[] = [];
      for (const msg of outbound) {
        // Ensure every outbound message carries a stable, explicit messageId so
        // downstream queue operations (findIndex / ack / fail) can rely on a
        // deterministic identity instead of fragile object reference equality.
        // The messageId combines the manager peerId, documentId and timestamp
        // and a small random suffix to avoid accidental collisions.
        // Preserve any upstream-provided messageId (e.g. from SyncEngine). Only
        // generate and attach a messageId when one is not already present. This
        // prevents churn and inconsistent identities between engine -> manager -> queue
        // which otherwise cause ack/fail/findIndex to miss entries.
        const prepared = ((msg as any).messageId ? (msg as any) : (() => {
          const suffix = Math.floor(Math.random() * 1e9).toString(36);
          const msgId = `${this.peerId}:${msg.documentId}:${msg.timestamp}:${suffix}`;
          return { ...(msg as any), messageId: msgId } as unknown as SyncMessage;
        })());
        try { this.emitTelemetry('outbound_prepared', { message: prepared }); } catch (_) { /* swallow */ }

        enqPromises.push(
          this.queue.enqueue(prepared).catch(err => {
            // Convert rejection to a handled telemetry emission so a single failure
            // does not throw from flush; queue.enqueue already enforces semantics.
            try { this.emitTelemetry('queue_enqueue_failed', { message: prepared, error: err }); } catch (_) {}

            // Persist the prepared message to a per-peer offline file so it can be
            // recovered across restarts. This conservative fallback reduces the
            // immediate data-loss surface when enqueues fail (e.g. transient disk/queue errors).
            try {
              const path = `.signal_offline_${this.peerId}.json`;
              let arr: any[] = [];
              if (existsSync(path)) {
                try { arr = JSON.parse(readFileSync(path, 'utf-8') || '[]'); } catch (_) { arr = []; }
              }
              arr.push(prepared);
              try { writeFileSync(path, JSON.stringify(arr), 'utf-8'); } catch (_) {}
            } catch (_) {}
          }),
        );
      }
      // Wait for all enqueues to be enqueued (not for delivery/acks) so we keep
      // the flush loop semantics predictable.
      void Promise.all(enqPromises);
    }
    } catch (err) {
      // Ensure unexpected engine errors don't crash the flush loop.
      this.emitTelemetry('engine_drain_error', { error: err });
    }

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

  start(flushIntervalMs = 1000): void {
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
    const clock = this.engine.getClock();
    try {
      if (this.snapshotService && typeof this.snapshotService.compactClock === 'function') {
        return this.snapshotService.compactClock(clock);
      }
    } catch (_) { /* swallow */ }
    return clock;
  }

  getQueueSize(): number {
    return this.queue.size;
  }
}
