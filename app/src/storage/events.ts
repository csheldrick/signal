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
    this.listeners.get(event.type)?.forEach(fn => fn(event));
    this.listeners.get('*')?.forEach(fn => fn(event));
  }
}
