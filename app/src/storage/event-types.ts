// Re-export storage event types directly from core to avoid duplicated or
// drifting local aliases. Keep the exported surface narrowly focused on
// the event-related contracts to prevent accidental coupling to unrelated
// core types.

export type { StorageEventType, StorageEvent, StorageEventListener, StorageEventBusContract } from '../core/types.js';
