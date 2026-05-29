import type { SyncMessage, VectorClock } from '../core/types.js';
import { SyncEngine } from './engine.js';
import { getSyncEngineFromStore } from '../storage/syncEngineRegistry.js';

/**
 * Create a lightweight lazy SyncEngine proxy that defers creating/attaching
 * the real SyncEngine until the first call. This avoids eager subscriptions
 * and buffering performed by SyncEngine at construction time, reducing
 * startup fan-out and background work.
 */
export function createLazySyncEngine(store: any, peerId: string, provided?: SyncEngine): SyncEngine {
  let real: SyncEngine | undefined = provided;

    const ensure = (): SyncEngine => {
    if (real) return real as SyncEngine;

    // If the store already has a canonical engine, reuse it. Allow any
    // registry errors to propagate so callers become aware of misconfiguration
    // rather than silently creating duplicates.
    const fromStore = getSyncEngineFromStore(store as any);
    if (fromStore !== undefined && fromStore) {
      real = fromStore as SyncEngine;
      return real as SyncEngine;
    }

    // Create and register a concrete engine when first needed.
    real = SyncEngine.getOrCreate(store as any, peerId) as SyncEngine;
    // getOrCreate handles registration; avoid duplicating registration here.
    return real as SyncEngine;
  };

  return {
    applyRemoteChange(message: SyncMessage): boolean {
      try { return ensure().applyRemoteChange(message); } catch (_) { return false; }
    },
    generateOutbound(event: any): SyncMessage | undefined {
      try { return (ensure() as any).generateOutbound(event); } catch (_) { return undefined; }
    },
    drainOutbound(): SyncMessage[] {
      try { return ensure().drainOutbound(); } catch (_) { return []; }
    },
    getClock(): VectorClock {
      try { return ensure().getClock(); } catch (_) { return {}; }
    },
    compactClock(compactor: (clock: VectorClock) => VectorClock): void {
      try { ensure().compactClock(compactor); } catch (_) { /* swallow */ }
    },
  } as unknown as SyncEngine;
}
