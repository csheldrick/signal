// Re-export storage event types from core/types to avoid duplicated/ diverging
// type definitions. This keeps a single authoritative shape for storage events
// while preserving the local module surface expected by storage consumers.

import type {
  StorageEvent as CoreStorageEvent,
  StorageEventType as CoreStorageEventType,
  StorageEventListener as CoreStorageEventListener,
  StorageEventBusContract as CoreStorageEventBusContract,
  DocumentSnapshot,
  DocumentLink,
  DocumentSnapshotServiceOptions as CoreDocumentSnapshotServiceOptions,
} from '../core/types.js';

// Local aliases re-exported for compatibility with existing imports.
export type StorageEventType = CoreStorageEventType;
export type StorageEvent = CoreStorageEvent;
export type StorageEventListener = CoreStorageEventListener;
export interface StorageEventBusContract extends CoreStorageEventBusContract {}

// DocumentSnapshotService options live under storage concerns; re-export the
// canonical type from core so callers do not diverge on this surface.
export type DocumentSnapshotServiceOptions = CoreDocumentSnapshotServiceOptions;
