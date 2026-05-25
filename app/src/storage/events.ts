// ── Storage Events ──────────────────────────────────────────
// Event types for storage mutations. Other modules subscribe
// to these events, creating depends_on edges in the graph.

import type { Document, DocumentLink } from '../core/types.js';

export type StorageEventType = 'created' | 'updated' | 'deleted' | 'linked';

export interface StorageEventCreated {
  type: 'created';
  document: Document;
  timestamp: number;
}

export interface StorageEventUpdated {
  type: 'updated';
  documentId: string;
  previous: Document;
  current: Document;
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

export class StorageEventBus implements StorageEventBusContract {
  private listeners: Map<StorageEventType | '*', Set<Listener>> = new Map();

  on(type: StorageEventType | '*', listener: Listener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  off(type: StorageEventType | '*', listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(event: StorageEvent): void {
    // Listeners are invoked synchronously by default to preserve deterministic
    // ordering for validators/listeners that must observe state changes before
    // the emitter returns. If non-blocking semantics are required callers can
    // opt-in using emitAsync(event).
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

    // Invoke synchronously to preserve ordering for validators/listeners.
    invoke();
  }

  /**
   * Emit asynchronously. This preserves the old non-blocking behaviour for
   * callers that explicitly want to avoid synchronous listener invocation.
   *
   * Usage: call emitAsync(...) when you knowingly do not require listeners
   * to have observed the event before the emitter returns (background dispatch).
   */
  emitAsync(event: StorageEvent): void {
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

    // Preserve previous (historical) non-blocking behavior for callers that
    // intentionally opt into async dispatch.
    Promise.resolve().then(() => invoke());
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
