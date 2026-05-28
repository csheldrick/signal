// ── Storage Events ──────────────────────────────────────────
// Event types for storage mutations. Other modules subscribe
// to these events, creating depends_on edges in the graph.

import type { DocumentSnapshot, DocumentLink, DocumentValidatorAsync, DocumentValidatorSync } from '../core/types.js';

// Event types for storage mutations. Other modules subscribe
// to these events, creating depends_on edges in the graph.

export type StorageEventType = 'created' | 'updated' | 'deleted' | 'linked';

export interface StorageEventCreated {
  readonly type: 'created';
  readonly document: Readonly<DocumentSnapshot>;
  readonly timestamp: number;
  // Optional monotonic sequence number assigned by the persistent store when
  // available. Consumers that depend on ordering should consult this field.
  readonly seq?: number;
}

export interface StorageEventUpdated {
  readonly type: 'updated';
  readonly documentId: string;
  readonly previous: Readonly<DocumentSnapshot>;
  readonly current: Readonly<DocumentSnapshot>;
  readonly timestamp: number;
  // Optional monotonic sequence number assigned by the persistent store when
  // available. Consumers that depend on ordering should consult this field.
  readonly seq?: number;
}

export interface StorageEventDeleted {
  readonly type: 'deleted';
  readonly documentId: string;
  readonly timestamp: number;
  // Optional monotonic sequence number assigned by the persistent store when
  // available. Consumers that depend on ordering should consult this field.
  readonly seq?: number;
}

export interface StorageEventLinked {
  readonly type: 'linked';
  readonly link: Readonly<DocumentLink>;
  readonly timestamp: number;
  // Optional monotonic sequence number assigned by the persistent store when
  // available. Consumers that depend on ordering should consult this field.
  readonly seq?: number;
}

export type StorageEvent =
  | StorageEventCreated
  | StorageEventUpdated
  | StorageEventDeleted
  | StorageEventLinked;

// Listener receives a readonly snapshot of events to discourage mutation and
// reduce coupling between event producers and consumers.

type Listener = (event: Readonly<StorageEvent>) => void;

export interface StorageEventBusContract {
  on(type: StorageEventType | '*', listener: Listener): void;
  onAsync(type: StorageEventType | '*', listener: Listener): void;
  off(type: StorageEventType | '*', listener: Listener): void;
  offAsync(type: StorageEventType | '*', listener: Listener): void;
  emit(event: StorageEvent): void;
  emitAsync(event: StorageEvent): void;
  attachDocumentValidatorFromEvents(initial?: Iterable<string>): DocumentValidatorAsync;
  attachDocumentValidatorSnapshot(initial?: Iterable<string>): DocumentValidatorSync;
  /** Return a snapshot of recently emitted storage events for diagnostics */
  getTrace(): ReadonlyArray<StorageEvent>;
  /** Return counts of registered listeners for diagnostics */
  getListenerCounts(): { total: number; perType: Record<string, number>; asyncTotal: number };
  /** Clear the internal trace used for diagnostics */
  clearTrace(): void;
  /** Remove all registered listeners (useful in tests to avoid leaks) */
  removeAllListeners(): void;
}

// deprecated alias removed to reduce legacy surface area

export class StorageEventBus implements StorageEventBusContract {
  private listeners: Map<StorageEventType | '*', Set<Listener>> = new Map();
  private asyncQueue: StorageEvent[] = [];
  private asyncScheduled: boolean = false;
  private trace: StorageEvent[] = [];
  getTrace(): ReadonlyArray<StorageEvent> { try { return this.trace.slice(); } catch (_) { return []; } }
  getListenerCounts(): { total: number; perType: Record<string, number>; asyncTotal: number } {
    try {
      const perType: Record<string, number> = {};
      let total = 0;
      for (const [k, s] of this.listeners) { perType[String(k)] = s.size; total += s.size; }
      let asyncTotal = 0;
      for (const [k, s] of this.asyncListeners) { asyncTotal += s.size; }
      return { total, perType, asyncTotal };
    } catch (_) { return { total: 0, perType: {}, asyncTotal: 0 }; }
  }

  clearTrace(): void { try { this.trace = []; } catch (_) { /* swallow */ } }

  removeAllListeners(): void {
    try { this.listeners.clear(); this.asyncListeners.clear(); } catch (_) { /* swallow */ }
  }
  // Async listeners are intended for consumers that must not run synchronously
  // on the emitter's call path (e.g. plugins, background summarizers, session
  // lifecycle observers). They are invoked in microtasks/macrotasks depending
  // on load and are included in emitAsync flushes.
  private asyncListeners: Map<StorageEventType | '*', Set<Listener>> = new Map();

  on(type: StorageEventType | '*', listener: Listener): void {
    // Prevent unbounded listener growth which can cause heavy synchronous
    // fan-out and subsystem overload. Enforce soft caps and refuse to add new
    // listeners when global or per-type limits are exceeded.
    const MAX_TOTAL_LISTENERS = 100; // lowered to reduce global fan-out under heavy plugin/use
    const MAX_PER_TYPE = 20; // lower per-type bound to prevent high fan-out for single event types

    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    // Compute current totals conservatively.
    let total = 0;
    for (const s of this.listeners.values()) total += s.size;

    const set = this.listeners.get(type)!;
    if (set.size >= MAX_PER_TYPE) {
      try { console.warn(`StorageEventBus: listener limit reached for type '${String(type)}' — ignoring new listener`); } catch (_) {}
      return;
    }

    if (total >= MAX_TOTAL_LISTENERS) {
      try { console.warn('StorageEventBus: global listener limit reached — ignoring new listener'); } catch (_) {}
      return;
    }

    set.add(listener);
  }

  off(type: StorageEventType | '*', listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  onAsync(type: StorageEventType | '*', listener: Listener): void {
    // Lazily create the set for async listeners
    if (!this.asyncListeners.has(type)) {
      this.asyncListeners.set(type, new Set());
    }

    const set = this.asyncListeners.get(type)!;

    // No strict global caps for async listeners here; async listeners are
    // intentionally lighter-weight. Consumers should still avoid '*' abuse.
    set.add(listener);
  }

  offAsync(type: StorageEventType | '*', listener: Listener): void {
    this.asyncListeners.get(type)?.delete(listener);
  }

  emit(event: StorageEvent): void {
    // Listeners are invoked synchronously by default to preserve deterministic
    // ordering for validators/listeners that must observe state changes before
    // the emitter returns. If non-blocking semantics are required callers can
    // opt-in using emitAsync(event).
    try { this.trace.push(event); if (this.trace.length > 1000) this.trace.splice(0, this.trace.length - 1000); } catch (_) {}
    const direct = this.listeners.get(event.type);
    const star = this.listeners.get('*');

    const invoke = () => {
      // Copy current listeners to arrays to avoid issues when listeners are
      // added/removed during iteration and to keep invocation deterministic.
      const directArr = direct ? Array.from(direct) : [];
      const starArr = star ? Array.from(star) : [];
      for (const fn of directArr) { try { fn(event); } catch (_) { /* swallow listener errors */ } }
      for (const fn of starArr) { try { fn(event); } catch (_) { /* swallow listener errors */ } }
    };

    // If many listeners are registered, yield to the event loop to avoid
    // heavy synchronous fan-out that can overload downstream subsystems.
    // For small listener sets preserve synchronous semantics to maintain
    // ordering guarantees expected by validators/listeners.
    const totalListeners = (direct ? direct.size : 0) + (star ? star.size : 0);
    // Thresholds chosen to reduce synchronous fan-out under load while
    // preserving ordering guarantees for small listener sets. We use two
    // tiers: a microtask yield for moderate listener counts and a macrotask
    // (setTimeout) when listener counts are very large to allow the event
    // loop to recover and avoid long-running synchronous bursts.
    const MICROTASK_YIELD_THRESHOLD = 1; // preserve synchronous semantics for small listener sets (validators rely on sync behaviour)
    const MACROTASK_YIELD_THRESHOLD = 10; // more aggressive macrotask yield to avoid long synchronous bursts

    if (totalListeners > MACROTASK_YIELD_THRESHOLD) {
      // Very large listener counts: schedule a macrotask to avoid saturating
      // the microtask queue and give other I/O a chance to run.
      setTimeout(() => invoke(), 0);
    } else if (totalListeners > MICROTASK_YIELD_THRESHOLD) {
      // Moderate listener counts: yield via a microtask to preserve
      // ordering relative to the emitter but avoid blocking the emitter call.
      Promise.resolve().then(() => invoke());
    } else {
      // Small listener sets: preserve synchronous invocation for deterministic
      // semantics expected by validators/listeners.
      invoke();
    }
  }

  /**
   * Emit asynchronously. This preserves the old non-blocking behaviour for
   * callers that explicitly want to avoid synchronous listener invocation.
   *
   * Usage: call emitAsync(...) when you knowingly do not require listeners
   * to have observed the event before the emitter returns (background dispatch).
   */
  emitAsync(event: StorageEvent): void {
    // Enqueue the event and schedule a single macrotask to flush the queue.
    // This batches many emitAsync calls into a single dispatch and uses a
    // macrotask (setTimeout) to yield to the event loop, preventing large
    // numbers of microtasks from overwhelming the runtime.
    try { this.trace.push(event); if (this.trace.length > 1000) this.trace.splice(0, this.trace.length - 1000); } catch (_) {}
    this.asyncQueue.push(event);
    if (this.asyncScheduled) return;
    this.asyncScheduled = true;

    setTimeout(() => {
      const queue = this.asyncQueue.splice(0);
      this.asyncScheduled = false;

      for (const ev of queue) {
        const direct = this.listeners.get(ev.type);
        const star = this.listeners.get('*');
        const asyncDirect = this.asyncListeners.get(ev.type);
        const asyncStar = this.asyncListeners.get('*');
        const directArr = direct ? Array.from(direct) : [];
        const starArr = star ? Array.from(star) : [];
        const asyncDirectArr = asyncDirect ? Array.from(asyncDirect) : [];
        const asyncStarArr = asyncStar ? Array.from(asyncStar) : [];
        for (const fn of directArr) { try { fn(ev); } catch (_) { /* swallow listener errors */ } }
        for (const fn of starArr) { try { fn(ev); } catch (_) { /* swallow listener errors */ } }
        for (const fn of asyncDirectArr) { try { fn(ev); } catch (_) { /* swallow listener errors */ } }
        for (const fn of asyncStarArr) { try { fn(ev); } catch (_) { /* swallow listener errors */ } }
      }
    }, 0);
  }

  /**
   * Attach a document-existence validator derived from observed storage events.
   * Returns an async function that resolves true when the bus has observed a
   * 'created' event for the id and not a subsequent 'deleted'. This provides
   * a migration-friendly, testable replacement for direct store access so
   * callers (e.g. PresenceTracker) need not import DocumentStore.
   */
  attachDocumentValidatorFromEvents(initial?: Iterable<string>): DocumentValidatorAsync {
    const known = new Set<string>();

    // Seed from provided iterable (e.g., current store snapshot) so callers can validate
    // existing documents immediately without importing the store directly.
    if (initial) {
      for (const id of initial) known.add(id);
    }

    const listener: Listener = (event) => {
      switch (event.type) {
        case 'created':
          known.add(event.document.id);
          break;
        case 'deleted':
          known.delete(event.documentId);
          break;
        // updates/links do not change existence
        case 'updated':
        case 'linked':
          break;
      }
    };

    // Observe only the concrete events we care about to maintain an internal existence set.
    // Using a wildcard '*' listener increases star-listener fan-out on the StorageEventBus
    // and can overload downstream subsystems. We only need 'created' and 'deleted' here.
    // Register the listener using the async path to avoid adding synchronous
    // listeners that run on every emit() call; the async path yields to the
    // event loop which reduces synchronous fan-out pressure on emitters.
    if (typeof this.onAsync === 'function') {
      this.onAsync('created', listener);
      this.onAsync('deleted', listener);
    } else {
      // Fallback to synchronous registration when async listeners are not
      // available (older environments), preserving behaviour but risking
      // higher synchronous fan-out.
      this.on('created', listener);
      this.on('deleted', listener);
    }

    // Return an async validator function. For callers that wish to stop
    // observing events (and avoid keeping the listener referenced) a
    // .dispose() method is attached to the returned function. This keeps
    // the original callable API stable while providing an explicit teardown
    // mechanism to avoid unbounded listener growth.
    const validator = async (id: string) => {
      return known.has(id);
    };

    (validator as any).dispose = () => {
      try {
        if (typeof this.offAsync === 'function') {
          this.offAsync('created', listener);
          this.offAsync('deleted', listener);
        } else {
          this.off('created', listener);
          this.off('deleted', listener);
        }
      } catch (_) {}
    };

    return validator;
  }

  /**
   * Attach a synchronous document-existence validator derived from observed
   * storage events. Returns a synchronous function that consults an internal
   * Set updated by the same event listener used by the async validator.
   *
   * This provides a safe, zero-IO validator suitable for realtime paths that
   * require a pure (non-Promise) check, while still keeping the event-driven
   * updates happening in the background.
   */
  attachDocumentValidatorSnapshot(initial?: Iterable<string>): DocumentValidatorSync {
    const known = new Set<string>();

    if (initial) {
      for (const id of initial) known.add(id);
    }

    const listener: Listener = (event) => {
      switch (event.type) {
        case 'created':
          known.add(event.document.id);
          break;
        case 'deleted':
          known.delete(event.documentId);
          break;
        case 'updated':
        case 'linked':
          break;
      }
    };

    // Observe only the concrete events needed for the snapshot validator.
    // Avoid registering a wildcard '*' listener which causes large fan-out.
    this.on('created', listener);
    this.on('deleted', listener);

    // Synchronous snapshot validator. We attach an optional .dispose()
    // method to allow callers to remove the underlying listener when they
    // no longer need the snapshot, preventing memory and processing leaks.
    const validator = (id: string) => known.has(id);
    (validator as any).dispose = () => { this.off('created', listener); this.off('deleted', listener); };
    return validator;
  }
}
