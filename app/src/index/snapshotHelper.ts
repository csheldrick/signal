import type { Document, DocumentSnapshot, DocumentLink } from '../core/types.js';

// Defensive helper to clone and freeze a Document/DocumentSnapshot so that
// subsystems (like the inverted index) can safely store immutable snapshots
// without risking external mutation. This centralizes the cloning logic so
// the index implementation can remain concise and tests can reuse the same
// behavior.
export function createSafeSnapshot(doc: Document | DocumentSnapshot): DocumentSnapshot {
  if (!doc || typeof (doc as any).id !== 'string') throw new Error('invalid document');
  const cloned: DocumentSnapshot = {
    id: (doc as any).id,
    title: String((doc as any).title || ''),
    content: String((doc as any).content || ''),
    tags: Array.isArray((doc as any).tags) ? [...(doc as any).tags] : [],
    links: Array.isArray((doc as any).links) ? (doc as any).links.map((l: any) => ({ sourceId: String(l.sourceId), targetId: String(l.targetId), kind: (l.kind || 'related') })) : [],
    createdAt: Number((doc as any).createdAt) || 0,
    updatedAt: Number((doc as any).updatedAt) || 0,
    version: typeof (doc as any).version === 'number' ? (doc as any).version : undefined,
  };

  // Freeze arrays and nested link objects to strengthen readonly guarantees
  try {
    if (Array.isArray(cloned.tags)) Object.freeze(cloned.tags);
  } catch (_) {}
  try {
    if (Array.isArray(cloned.links)) {
      for (const l of cloned.links) try { Object.freeze(l); } catch (_) {}
      Object.freeze(cloned.links as any);
    }
  } catch (_) {}
  try { Object.freeze(cloned); } catch (_) {}
  return cloned;
}
