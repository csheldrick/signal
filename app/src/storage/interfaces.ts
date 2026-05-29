// Lightweight type-only re-exports to reduce runtime dependency fan-in on storage/store
// Importing these types does not require loading the full storage/store module at runtime
// when used as TypeScript `import type` imports.

export type { DocumentStore } from './store.js';
export type { StorageEventBus } from './events.js';
export type { StorageEvent } from './event-types.js';
