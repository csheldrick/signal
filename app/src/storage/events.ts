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

export class StorageEventBus {
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
    // Invoke listeners asynchronously to avoid blocking the emitter and reduce
    // tight synchronous coupling between storage and its subscribers.
    const direct = this.listeners.get(event.type);
    const star = this.listeners.get('*');

    const invoke = () => {
      direct?.forEach(fn => { try { fn(event); } catch (_) { /* swallow listener errors */ } });
      star?.forEach(fn => { try { fn(event); } catch (_) { /* swallow listener errors */ } });
    };

    // Invoke synchronously to preserve ordering for validators/listeners.
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

    return async (id: string) => {
      return known.has(id);
    };
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

    return (id: string) => known.has(id);
  }
}
