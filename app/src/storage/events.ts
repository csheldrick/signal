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

    // Schedule on the microtask queue so emit returns immediately.
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(invoke);
    } else {
      Promise.resolve().then(invoke);
    }
  }

  /**
   * Attach a document-existence validator derived from observed storage events.
   * Returns an async function that resolves true when the bus has observed a
   * 'created' event for the id and not a subsequent 'deleted'. This provides
   * a migration-friendly, testable replacement for direct store access so
   * callers (e.g. PresenceTracker) need not import DocumentStore.
   */
  attachDocumentValidatorFromEvents(): (id: string) => Promise<boolean> {
    const known = new Set<string>();

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
}
