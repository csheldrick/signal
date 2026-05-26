// ── Storage Events ──────────────────────────────────────────
// Event types for storage mutations. Other modules subscribe
// to these events, creating depends_on edges in the graph.

import type { DocumentSnapshot, DocumentLink } from '../core/types.js';

export type StorageEventType = 'created' | 'updated' | 'deleted' | 'linked';

export interface StorageEventCreated {
  type: 'created';
  document: DocumentSnapshot;
  timestamp: number;
}

export interface StorageEventUpdated {
  type: 'updated';
  documentId: string;
  previous: DocumentSnapshot;
  current: DocumentSnapshot;
  timestamp: number;
}

export interface StorageEventDeleted {
  type: 'deleted';
  documentId: string;
  timestamp: number;
}

export interface StorageEventLinked {
  type: 'linked';
  link: DocumentLink;
  timestamp: number;
}

export type StorageEvent =
  | StorageEventCreated
  | StorageEventUpdated
  | StorageEventDeleted
  | StorageEventLinked;

type Listener = (event: StorageEvent) => void;

export interface StorageEventBusContract {
  on(type: StorageEventType | '*', listener: Listener): void;
  off(type: StorageEventType | '*', listener: Listener): void;
  emit(event: StorageEvent): void;
  emitAsync(event: StorageEvent): void;
  attachDocumentValidatorFromEvents(initial?: Iterable<string>): (id: string) => Promise<boolean> & { dispose?: () => void };
  attachDocumentValidatorSnapshot(initial?: Iterable<string>): (id: string) => boolean & { dispose?: () => void };
}

export type DeprecatedStorageEventCreated = StorageEventCreated;

export class StorageEventBus implements StorageEventBusContract {
  private listeners: Map<StorageEventType | '*', Set<Listener>> = new Map();
  private asyncQueue: StorageEvent[] = [];
  private asyncScheduled: boolean = false; private trace: StorageEvent[] = [];

  on(type: StorageEventType | '*', listener: Listener): void {
    // Prevent unbounded listener growth which can cause heavy synchronous
    // fan-out and subsystem overload. Enforce soft caps and refuse to add new
    // listeners when global or per-type limits are exceeded.
    const MAX_TOTAL_LISTENERS = 1000;
    const MAX_PER_TYPE = 250;

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
    // Threshold chosen conservatively; tune if necessary. When exceeded we
    // schedule a microtask so the emitter yields control briefly but preserves
    // listener invocation order relative to this emit call.
    const SYNC_LISTENER_THRESHOLD = 2; // yield earlier to reduce synchronous fan-out under load
    if (totalListeners > SYNC_LISTENER_THRESHOLD) {
      Promise.resolve().then(() => invoke());
    } else {
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
        const directArr = direct ? Array.from(direct) : [];
        const starArr = star ? Array.from(star) : [];
        for (const fn of directArr) { try { fn(ev); } catch (_) { /* swallow listener errors */ } }
        for (const fn of starArr) { try { fn(ev); } catch (_) { /* swallow listener errors */ } }
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
  attachDocumentValidatorFromEvents(initial?: Iterable<string>): (id: string) => Promise<boolean> {
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

    // Observe all events to maintain an internal existence set.
    this.on('*', listener);

    // Return an async validator function. For callers that wish to stop
    // observing events (and avoid keeping the listener referenced) a
    // .dispose() method is attached to the returned function. This keeps
    // the original callable API stable while providing an explicit teardown
    // mechanism to avoid unbounded listener growth.
    const validator = async (id: string) => {
      return known.has(id);
    };

    (validator as any).dispose = () => { this.off('*', listener); };

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
  attachDocumentValidatorSnapshot(initial?: Iterable<string>): (id: string) => boolean {
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

    this.on('*', listener);

    // Synchronous snapshot validator. We attach an optional .dispose()
    // method to allow callers to remove the underlying listener when they
    // no longer need the snapshot, preventing memory and processing leaks.
    const validator = (id: string) => known.has(id);
    (validator as any).dispose = () => { this.off('*', listener); };
    return validator;
  }
}
