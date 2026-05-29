// Re-export storage event types directly from core to avoid duplicated or
// drifting local aliases. Using `export type { ... } from` keeps a single
// authoritative type surface and prevents accidental divergence between the
// storage/ module and core/types.ts.

export type { StorageEventType, StorageEvent, StorageEventListener, StorageEventBusContract, DocumentSnapshotServiceOptions } from '../core/types.js';
