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
import { createLazySyncEngine } from './lazyEngine.js';
import { telemetry } from './telemetry.js';

import { SyncQueue } from './queue.js';
import { OfflineSyncQueue } from './offline-queue.js';
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
  /** Optional durable offline queue to persist outbound messages when enqueue fails */
  offlineQueue?: OfflineSyncQueue;
}

export class SyncManager {
  private readonly engine: SyncEngine;
  private readonly queue: SyncQueue;
  private readonly sessionTracker?: { openSession(peerId: string, initialClock?: VectorClock): void; closeSession(peerId: string): void; updateHeartbeat?(peerId: string): void };
  private readonly snapshotService?: { compactClock?: (clock: VectorClock) => VectorClock };
  private readonly offlineQueue?: import('./offline-queue.js').OfflineSyncQueue;
  // Observability for sessions: track last-seen and stale state and emit
  // lifecycle events on the store event bus so downstream consumers can
  // react without polling. These are best-effort and do not throw.
  private sessionLastSeen: Map<string, number> = new Map();
  private sessionStale: Map<string, boolean> = new Map();
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private readonly sessions: Map<string, PeerSession> = new Map();
  private readonly conflictLog: ConflictRecord[] = [];
  private readonly conflictStrategy: ConflictStrategy;
  private readonly peerId: string;
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private transport: TransportSend | undefined;
  // Deterministic per-manager counter used to generate stable message suffixes
  // for tests and to avoid relying on Math.random() at runtime.
  private msgCounter: number = 0;
  private authValidator?: (peerId: string, message?: SyncMessage) => boolean;
  private static readonly MAX_TELEMETRY_LISTENERS = 32;
  private telemetryListeners: Set<(event: { type: string; payload: any }) => void> = new Set();

  constructor(
    private readonly store: DocumentStore,
    opts: SyncManagerOptions,
  ) {
    this.peerId = opts.peerId;
    this.conflictStrategy = opts.conflictStrategy ?? 'last-write-wins';

    // Lazily obtain a SyncEngine proxy to avoid eager subscriptions and buffering at startup.
    if (opts.engine) {
      this.engine = opts.engine;
    } else {
      // Use a lazy SyncEngine proxy to defer constructing the concrete
      // SyncEngine (and subscribing to store events) until the manager
      // actually needs it. This reduces startup fan-out and avoids
      // unnecessary buffering in short-lived hosts.
      try {
        this.engine = createLazySyncEngine(store as any, opts.peerId) as unknown as SyncEngine;
      } catch (_) {
        // Fallback to canonical factory when lazy creation fails
        this.engine = SyncEngine.getOrCreate(store as any, opts.peerId);
      }
    }
    this.queue = new SyncQueue();

    // Session lifecycle observability: emit lifecycle events on the store's
    // event bus so downstream consumers (PresenceTracker, SyncManager internals,
    // observability tools) can react without polling. We emit both a new
    // PascalCase event name and the legacy snake_case name for backwards
    // compatibility with existing listeners. All emissions are best-effort and
    // non-blocking.
    try {
      // initialize timers/maps
      this.sessionLastSeen = new Map<string, number>();
      this.sessionStale = new Map<string, boolean>();
      const HEARTBEAT_INTERVAL_MS = 30_000; // heartbeat cadence
      const STALE_MS = 60_000; // consider a session stale after 60s of inactivity

      this.heartbeatTimer = setInterval(() => {
        try {
          const now = Date.now();
          const busAny: any = (this.store as any).events;

          for (const peerId of Array.from(this.sessions.keys())) {
            // Ensure we have a baseline last-seen for newly added sessions
            if (!this.sessionLastSeen.has(peerId)) this.sessionLastSeen.set(peerId, now);

            // Emit heartbeat events (new and legacy forms)
            const heartbeat = { type: 'SyncSessionHeartbeat', peerId, timestamp: now } as any;
            const heartbeatLegacy = { type: 'sync_session_heartbeat', peerId, timestamp: now } as any;
            try {
              if (busAny && typeof busAny.emitAsync === 'function') {
                try { busAny.emitAsync(heartbeat); } catch (_) {}
                try { busAny.emitAsync(heartbeatLegacy); } catch (_) {}
              } else if (busAny && typeof busAny.emit === 'function') {
                try { busAny.emit(heartbeat); } catch (_) {}
                try { busAny.emit(heartbeatLegacy); } catch (_) {}
              }
            } catch (_) { /* swallow */ }

            // Stale detection
            try {
              const last = this.sessionLastSeen.get(peerId) ?? 0;
              const wasStale = this.sessionStale.get(peerId) ?? false;
              if (!wasStale && now - last > STALE_MS) {
                this.sessionStale.set(peerId, true);
                const stale = { type: 'SyncSessionStale', peerId, timestamp: now } as any;
                const staleLegacy = { type: 'sync_session_stale', peerId, timestamp: now } as any;
                try {
                  if (busAny && typeof busAny.emitAsync === 'function') {
                    try { busAny.emitAsync(stale); } catch (_) {}
                    try { busAny.emitAsync(staleLegacy); } catch (_) {}
                  } else if (busAny && typeof busAny.emit === 'function') {
                    try { busAny.emit(stale); } catch (_) {}
                    try { busAny.emit(staleLegacy); } catch (_) {}
                  }
                } catch (_) { /* swallow */ }
              } else if (wasStale && now - last <= STALE_MS) {
                // recovered from stale
                this.sessionStale.set(peerId, false);
              }
            } catch (_) { /* swallow per-session stale logic errors */ }
          }
        } catch (_) { /* swallow heartbeat loop errors */ }
      }, HEARTBEAT_INTERVAL_MS);
    } catch (_) { /* swallow timer creation errors for test/env compatibility */ }

    // Attach optional external hooks (readonly assignment allowed in constructor)
    this.sessionTracker = opts.sessionTracker;
    this.snapshotService = opts.snapshotService;
    this.offlineQueue = opts.offlineQueue;

    // If an offlineQueue is provided, attempt a best-effort drain when the
    // manager starts or when a transport is attached so that offline-first
    // persisted messages are replayed in causal order before live sends.
    // Do not block construction; perform drains asynchronously and emit
    // telemetry for observability.


    // Outbound generation is driven by the SyncEngine. Rather than subscribing
    // directly to store.events and enqueueing immediately (which can cause
    // duplicate enqueues and high synchronous fan-out when many listeners exist),
    // we centralize draining the engine's outbound buffer during flush(). This
    // provides a single controlled point for backpressure and avoids duplicate
    // work when other engines/listeners are present.
    // (Previously this block subscribed to store.events and enqueued directly.)

    // If an OfflineSyncQueue is provided, attempt an asynchronous best-effort
    // replay of persisted entries. This supports offline-first workflows while
    // ensuring that replay does not block the manager construction. Replayed
    // entries will be handed to the manager's transport when available via
    // start/attach logic below — for now we emit telemetry to indicate presence.
    if (this.offlineQueue) {
      try {
        // Emit size/health telemetry to help operators know there's pending offline data
        try { telemetry.emit('offline_queue_attached', { peerId: this.peerId, size: this.offlineQueue.size(this.peerId), timestamp: Date.now() }); } catch (_) {}
      } catch (_) {}
    }
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

    // If an OfflineSyncQueue was provided, attempt an asynchronous best-effort
    // replay of persisted entries into the in-memory queue so normal flush
    // logic will send them in causal order. We perform this asynchronously
    // to avoid blocking callers and emit telemetry for observability.
    if (this.offlineQueue) {
      try {
        (async () => {
          try {
            await (this.offlineQueue as any).drain(this.peerId, async (entry: any) => {
              try {
                // Re-enqueue the payload into the in-memory SyncQueue so it
                // participates in normal flush/ack semantics. If enqueue fails
                // we propagate the error to cause the remaining entries to be
                // preserved on disk by OfflineSyncQueue.drain rewrite logic.
                const msg = entry.payload as SyncMessage;
                await this.queue.enqueue(msg);
              } catch (err) {
                throw err;
              }
            });
            try { telemetry.emit('offline_queue_drained', { peerId: this.peerId, timestamp: Date.now() }); } catch (_) {}
          } catch (err) {
            try { telemetry.emit('offline_queue_drain_failed', { peerId: this.peerId, error: String(err), timestamp: Date.now() }); } catch (_) {}
          }
        })();
      } catch (_) {}
    }
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
      const outbound = this.engine.drainOutbound() || [];
      // Batch enqueue outbound messages to avoid long synchronous bursts. Yield
      // to the event loop every BATCH_SIZE messages so the flush loop doesn't
      // monopolize the host when many outbound messages are present.
      const BATCH_SIZE = 50;
      const enqPromises: Promise<void>[] = [];

      for (let i = 0; i < outbound.length; i++) {
        const msg = outbound[i];
        const prepared = ((msg as any).messageId ? (msg as any) : (() => {
          const suffix = (this.msgCounter++).toString(36);
          const msgId = `${this.peerId}:${msg.documentId}:${msg.timestamp}:${suffix}`;
          return { ...(msg as any), messageId: msgId } as unknown as SyncMessage;
        })());

        try { this.emitTelemetry('outbound_prepared', { message: prepared }); } catch (_) { /* swallow */ }

        enqPromises.push(
          this.queue.enqueue(prepared).catch(async (err) => {
            try { this.emitTelemetry('queue_enqueue_failed', { message: prepared, error: err }); } catch (_) {}
            try {
              if (this.offlineQueue) {
                // Best-effort: persist into the provided offline queue
                try { await (this.offlineQueue as any).enqueue(this.peerId, prepared.documentId ?? '', prepared); } catch (_) {}
              } else {
                const path = `.signal_offline_${this.peerId}.json`;
                let arr: any[] = [];
                if (existsSync(path)) {
                  try { arr = JSON.parse(readFileSync(path, 'utf-8') || '[]'); } catch (_) { arr = []; }
                }
                arr.push(prepared);
                try { writeFileSync(path, JSON.stringify(arr), 'utf-8'); } catch (_) {}
              }
            } catch (_) {}
          }),
        );

        // Yield periodically to keep the event loop responsive for large batches
        if ((i + 1) % BATCH_SIZE === 0) {
          await Promise.resolve();
        }
      }

      // Allow outstanding enqueues to settle without throwing into the flush
      // loop. allSettled ensures we tolerate failures while keeping semantics
      // predictable for the remainder of the flush.
      try { await Promise.allSettled(enqPromises); } catch (_) { /* swallow */ }
    } catch (err) {
      // Ensure unexpected engine errors don't crash the flush loop.
      this.emitTelemetry('engine_drain_error', { error: err });
    }

    // Periodic compaction: allow an optional snapshot service to compact
    // the engine's vector clock to bound comparison/merge cost over long
    // running sessions. This is best-effort and non-fatal.
    try {
      if (this.snapshotService && typeof this.snapshotService.compactClock === 'function') {
        try { (this.engine as any).compactClock(this.snapshotService.compactClock); } catch (_) { /* swallow */ }
      }
    } catch (_) {}

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
