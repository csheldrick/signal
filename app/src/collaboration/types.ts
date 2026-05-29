// Presence-related lightweight types separated from core types to reduce centrality
export type PresenceStatus = 'active' | 'idle' | 'offline';

export interface PeerPresence {
  peerId: string;
  documentId?: string;
  status: PresenceStatus;
  lastSeen: number;
  seq: number;
}

export interface PresenceTracker {
  setPluginContext(context?: any): void;
  setSessionTracker(tracker?: any): void;
  setValidator(validate?: (id: string) => boolean | Promise<boolean>): void;
  setAsyncValidator(validate?: (id: string) => Promise<boolean>): void;
  join(peerId: string, documentId?: string): PeerPresence;
  leave(peerId: string, awaitCleanup?: boolean): Promise<void>;
  getActive(): PeerPresence[];
  getViewers(documentId: string): PeerPresence[];
  focusDocument(peerId: string, documentId: string): Promise<boolean>;
  summary(): { active: number; idle: number; offline: number };
  stopCleanupTimer?(): void;
}
