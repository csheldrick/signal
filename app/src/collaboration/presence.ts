// ── Presence Tracker ─────────────────────────────────────────
// ⚠️ DELIBERATE COMPOUND BOUNDARY VIOLATION
//
// This module bypasses two separate subsystem boundaries:
//
//   import DocumentStore  from '../storage/store.js'  ← VIOLATION 1
//   import SyncEngine     from '../sync/engine.js'    ← VIOLATION 2
//
// Neither import goes through PluginContext. The SyncEngine import is a
// second-order violation: presence is a *collaboration* concern, but it
// reaches directly into the *sync* layer to read the vector clock.
//
// EXP-005 hypothesis: Weave should surface this as a compound tension —
// higher pressure than a single-boundary violation (EXP-002) because the
// ContradictionDetectionOperator fires from two distinct source pairs.

import type { DocumentStore } from '../storage/store.js';
import type { SyncEngine } from '../sync/engine.js';

export type PresenceStatus = 'active' | 'idle' | 'offline';

export interface PeerPresence {
  peerId: string;
  documentId: string | undefined;
  status: PresenceStatus;
  lastSeen: number;
}

export class PresenceTracker {
  private peers: Map<string, PeerPresence> = new Map();

  constructor(
    private readonly store: DocumentStore,
    private readonly sync: SyncEngine,
  ) {}

  join(peerId: string, documentId?: string): PeerPresence {
    const presence: PeerPresence = {
      peerId,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
    };
    this.peers.set(peerId, presence);
    return presence;
  }

  leave(peerId: string): void {
    const existing = this.peers.get(peerId);
    if (existing) {
      this.peers.set(peerId, { ...existing, status: 'offline', lastSeen: Date.now() });
    }
  }

  getActive(): PeerPresence[] {
    return [...this.peers.values()].filter(p => p.status !== 'offline');
  }

  getViewers(documentId: string): PeerPresence[] {
    return this.getActive().filter(p => p.documentId === documentId);
  }

  // Reaches into DocumentStore to verify the document exists before registering
  // focus. Also stamps the clock from SyncEngine — the second boundary crossing.
  focusDocument(peerId: string, documentId: string): boolean {
    const doc = this.store.read(documentId);
    if (!doc) return false;

    const clock = this.sync.getClock();
    void clock;

    this.peers.set(peerId, {
      peerId,
      documentId,
      status: 'active',
      lastSeen: Date.now(),
    });
    return true;
  }

  summary(): { active: number; idle: number; offline: number } {
    const counts = { active: 0, idle: 0, offline: 0 };
    for (const p of this.peers.values()) counts[p.status]++;
    return counts;
  }
}
