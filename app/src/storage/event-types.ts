// Local storage-level event types to reduce dependency on core/types for high-centrality contracts

import type { DocumentSnapshot, DocumentLink } from '../core/types.js';

export type StorageEventType = 'created' | 'updated' | 'deleted' | 'linked';

export interface StorageEventCreated {
  readonly type: 'created';
  readonly document: Readonly<DocumentSnapshot>;
  readonly timestamp: number;
  readonly seq?: number;
}

export interface StorageEventUpdated {
  readonly type: 'updated';
  readonly documentId: string;
  readonly previous: Readonly<DocumentSnapshot>;
  readonly current: Readonly<DocumentSnapshot>;
  readonly timestamp: number;
  readonly seq?: number;
}

export interface StorageEventDeleted {
  readonly type: 'deleted';
  readonly documentId: string;
  readonly timestamp: number;
  readonly seq?: number;
}

export interface StorageEventLinked {
  readonly type: 'linked';
  readonly link: Readonly<DocumentLink>;
  readonly timestamp: number;
  readonly seq?: number;
}

export type StorageEvent = StorageEventCreated | StorageEventUpdated | StorageEventDeleted | StorageEventLinked;

export type StorageEventListener = (event: Readonly<StorageEvent>) => void;

export interface StorageEventBusContract {
  on(type: StorageEventType | '*', listener: StorageEventListener): void;
  onAsync(type: StorageEventType | '*', listener: StorageEventListener): void;
  off(type: StorageEventType | '*', listener: StorageEventListener): void;
  offAsync(type: StorageEventType | '*', listener: StorageEventListener): void;
  emit(event: StorageEvent): void;
  emitAsync(event: StorageEvent): void;
  attachDocumentValidatorFromEvents(initial?: Iterable<string>): ((id: string) => Promise<boolean>) & { dispose?: () => void };
  attachDocumentValidatorSnapshot(initial?: Iterable<string>): ((id: string) => boolean) & { dispose?: () => void };
  getTrace(): ReadonlyArray<StorageEvent>;
  getListenerCounts(): { total: number; perType: Record<string, number>; asyncTotal: number };
  clearTrace(): void;
  removeAllListeners(): void;
}

// DocumentSnapshotService options live under storage concerns
export interface DocumentSnapshotServiceOptions {
  compactionIntervalMs?: number;
  maxClockEntries?: number;
}
