// ── Conflict Resolution ──────────────────────────────────────
// Detects concurrent writes and applies a configurable merge strategy.
// Depends on: core/types, sync/protocol.

import type { Document } from '../core/types.js';
import type { ConflictRecord, ConflictStrategy, VectorClock } from './protocol.js';
import { isConcurrent } from './protocol.js';

export interface ConflictCandidate {
  documentId: string;
  local: Document;
  localClock: VectorClock;
  remote: Document;
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
  const resolvedAt = Date.now();

  let winner: Document;

  switch (strategy) {
    case 'last-write-wins': {
      // Prefer the more recently updated document. If timestamps are equal,
      // apply a deterministic tie-breaker: prefer the version with larger
      // serialized content size (more content), then lexicographically by id.
      if (remote.updatedAt > local.updatedAt) {
        winner = remote;
      } else if (remote.updatedAt < local.updatedAt) {
        winner = local;
      } else {
        const remoteSize = JSON.stringify(remote).length;
        const localSize = JSON.stringify(local).length;
        if (remoteSize !== localSize) {
          winner = remoteSize > localSize ? remote : local;
        } else {
          winner = remote.id >= local.id ? remote : local;
        }
      }
      break;
    }

    case 'first-write-wins':
      winner = local.createdAt <= remote.createdAt ? local : remote;
      break;

    case 'merge-content': {
      // Naive content merge: concatenate divergent sections with a separator.
      // A real implementation would use a CRDT or three-way diff here.
      const mergedContent =
        local.content === remote.content
          ? local.content
          : `${local.content}\n<<<conflict:remote>>>\n${remote.content}`;

      // Merge tags by union.
      const mergedTags = Array.from(new Set([...local.tags, ...remote.tags]));

      // Prefer the more recently updated title.
      const mergedTitle = remote.updatedAt >= local.updatedAt ? remote.title : local.title;

      winner = {
        ...local,
        title: mergedTitle,
        content: mergedContent,
        tags: mergedTags,
        updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      };
      break;
    }

    default:
      winner = remote;
  }

  const record: ConflictRecord = {
    documentId: candidate.documentId,
    localClock,
    remoteClock,
    localTimestamp: local.updatedAt,
    remoteTimestamp: remote.updatedAt,
    resolvedBy: strategy,
    resolvedAt,
  };

  return { winner, record };
}
