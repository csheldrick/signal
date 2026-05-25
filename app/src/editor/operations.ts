// ── Editor Operations ───────────────────────────────────────
// High-level document editing operations.
// Imports from core/types, storage/store, and storage/events.

import type { Document, DocumentChange, LinkKind } from '../core/types.js';
import type { DocumentStore } from '../storage/store.js';

let nextId = 1;

function generateId(): string {
  return `doc_${Date.now()}_${nextId++}`;
}

export function createDocument(
  store: DocumentStore,
  title: string,
  content: string,
  tags: string[] = [],
): Document {
  const id = generateId();
  return store.create(id, title, content, tags);
}

export function updateDocument(
  store: DocumentStore,
  id: string,
  changes: DocumentChange,
): Document | undefined {
  return store.update(id, changes);
}

export function linkDocuments(
  store: DocumentStore,
  sourceId: string,
  targetId: string,
  kind: LinkKind,
): boolean {
  const link = store.link(sourceId, targetId, kind);
  return link !== undefined;
}

export function deleteDocument(
  store: DocumentStore,
  id: string,
): boolean {
  return store.delete(id);
}
