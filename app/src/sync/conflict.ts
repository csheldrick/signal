// ── Conflict Resolution ──────────────────────────────────────
// Detects concurrent writes and applies a configurable merge strategy.
// Depends on: core/types, sync/protocol.

import type { Document, DocumentSnapshot } from '../core/types.js';
import type { ConflictRecord, ConflictStrategy, VectorClock } from './protocol.js';
import { isConcurrent } from './protocol.js';

export interface ConflictCandidate {
  documentId: string;
  local: DocumentSnapshot;
  localClock: VectorClock;
  remote: DocumentSnapshot;
  remoteClock: VectorClock;
}

export interface ConflictResolution {
  winner: Document;
  record: ConflictRecord;
}

/**
 * Detect whether a remote document write genuinely conflicts with the local
 * version (concurrent vector clocks) or is simply a causally-later update.
 */
export type ConflictCandidateRecord = ConflictCandidate;

export function isConflict(localClock: VectorClock, remoteClock: VectorClock): boolean {
  return isConcurrent(localClock, remoteClock);
}

/**
 * Resolve a conflict between two document versions.
 * Returns the winning document and a record for audit / UI display.
 */
export function resolveConflict(
  candidate: ConflictCandidate,
  strategy: ConflictStrategy = 'last-write-wins',
): ConflictResolution {
  const { local, localClock, remote, remoteClock } = candidate;
  // Normalize inputs to mutable Document for resolution logic while keeping the
  // external API permissive (accepts DocumentSnapshot). Callers that pass
  // snapshots are not exposed to internal mutation because we operate on copies
  // / assertions here.
  // Operate on shallow copies to avoid mutating caller-owned objects
  // (Document or DocumentSnapshot). This preserves store/test invariants and
  // ensures resolution logic cannot leak internal mutations.
  const ldoc: Document = { ...(local as Document) };
  const rdoc: Document = { ...(remote as Document) };
  const resolvedAt = Date.now();

  let winner: Document;

  switch (strategy) {
    case 'last-write-wins': {
      // Prefer the more recently updated document. If timestamps are equal,
      // apply a deterministic tie-breaker: prefer the version with larger
      // serialized content size (more content), then lexicographically by id.
      if (rdoc.updatedAt > ldoc.updatedAt) {
        winner = { ...rdoc };
      } else if (rdoc.updatedAt < ldoc.updatedAt) {
        winner = { ...ldoc };
      } else {
        const remoteSize =
          (rdoc.content ? rdoc.content.length : 0) + (rdoc.title ? rdoc.title.length : 0);
        const localSize =
          (ldoc.content ? ldoc.content.length : 0) + (ldoc.title ? ldoc.title.length : 0);
        if (remoteSize !== localSize) {
          winner = remoteSize > localSize ? { ...rdoc } : { ...ldoc };
        } else {
          winner = rdoc.id >= ldoc.id ? { ...rdoc } : { ...ldoc };
        }
      }
      break;
    }

    case 'first-write-wins':
      winner = ldoc.createdAt <= rdoc.createdAt ? { ...ldoc } : { ...rdoc };
      break;

    case 'merge-content': {
      // Merge with defensive caps to avoid unbounded memory/CPU use when
      // documents are very large. Use a simple truncated merge strategy and
      // a predictable marker so downstream tooling can detect truncation.
      const MAX_MERGED_CONTENT = 10000; // bytes/characters cap for merged payload
      const l = typeof ldoc.content === 'string' ? ldoc.content : '';
      const r = typeof rdoc.content === 'string' ? rdoc.content : '';

      const mergedContent =
        l === r
          ? l
          : (() => {
              if ((l.length + r.length + 32) <= MAX_MERGED_CONTENT) {
                return `${l}\n<<<conflict:remote>>>\n${r}`;
              }
              const reserve = 48; const half = Math.max(0, Math.floor((MAX_MERGED_CONTENT - reserve) / 2));
              return `${l.slice(0, half)}\n<<<conflict:remote>>>\n${r.slice(-half)}`;
            })();

      // Merge tags by union.
      const mergedTags = Array.from(new Set([...ldoc.tags, ...rdoc.tags]));

      // Prefer the more recently updated title.
      const mergedTitle = rdoc.updatedAt >= ldoc.updatedAt ? rdoc.title : ldoc.title;

      winner = {
        ...ldoc,
        title: mergedTitle,
        content: mergedContent,
        tags: mergedTags,
        updatedAt: Math.max(ldoc.updatedAt, rdoc.updatedAt),
      };
      break;
    }

    default:
      winner = { ...rdoc };
      break;
  }

  const record: ConflictRecord = {
    documentId: candidate.documentId,
    localClock,
    remoteClock,
    localTimestamp: ldoc.updatedAt,
    remoteTimestamp: rdoc.updatedAt,
    resolvedBy: strategy,
    resolvedAt,
  };

  return { winner, record };
}
