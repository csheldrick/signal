# signal — Comprehension Report
> Graph v2 · Project type: **web-api**

## Module Boundaries

### signal-app
Module boundary at app containing 46 source file(s).
_Path: `app`_
Confidence: 95%

## Inferred Contracts

### Contract: LocalSummarizer
Confidence: 85%

### Contract: PeerPresence
Confidence: 85%

### Contract: PresenceTracker
Confidence: 85%

### Contract: SignalApp
Confidence: 85%

### Contract: Document
Confidence: 85%

### Contract: AppConfig
Confidence: 85%

### Contract: VectorClock
Confidence: 85%

### Contract: SyncState
Confidence: 85%

### Contract: ConflictStrategy
Confidence: 85%

### Contract: PeerInfo
Confidence: 85%

### Contract: SyncAck
Confidence: 85%

### Contract: ConflictRecord
Confidence: 85%

### Contract: SyncMessage
Confidence: 85%

### Contract: OfflineEntry
Confidence: 85%

### Contract: OfflineSyncQueueOptions
Confidence: 85%

### Contract: OfflineSyncQueue
Confidence: 85%

### Contract: SyncManagerOptions
Confidence: 85%

### Contract: ConflictCandidate
Confidence: 85%

### Contract: ConflictCandidateRecord
Confidence: 85%

### Contract: DocumentSnapshot
Confidence: 85%

### Contract: DocumentLink
Confidence: 85%

### Contract: LinkKind
Confidence: 85%

### Contract: SearchQuery
Confidence: 85%

### Contract: SearchResult
Confidence: 85%

### Contract: SearchResultSnapshot
Confidence: 85%

### Contract: DocumentChange
Confidence: 85%

### Contract: GraphBuilder
Confidence: 85%

### Contract: Indexer
Confidence: 85%

### Contract: WorkerPool
Confidence: 85%

### Contract: ExportPlugin
Confidence: 85%

### Contract: HealthPlugin
Confidence: 85%

### Contract: StorageEventType
Confidence: 85%

### Contract: Plugin
Confidence: 85%

### Contract: PluginContext
Confidence: 85%

### Contract: PluginHost
Confidence: 85%

### Contract: SearchPlugin
Confidence: 85%

### Contract: StorageEvent
Confidence: 85%

### Contract: Listener
Confidence: 85%

### Contract: StorageEventBusContract
Confidence: 85%

### Contract: StorageEventBus
Confidence: 85%

### Contract: ScopedStorageEventBusContract
Confidence: 85%

### Contract: ScopedStorageEventBus
Confidence: 85%

### Contract: TransportSend
Confidence: 85%

### Contract: QueueEntry
Confidence: 85%

### Contract: SyncQueueOptions
Confidence: 85%

### Contract: SyncQueue
Confidence: 85%

### Contract: SyncSessionState
Confidence: 85%

### Contract: SyncSessionEvent
Confidence: 85%

### Contract: SyncSessionTrackerOptions
Confidence: 85%

### Contract: SyncSessionTracker
Confidence: 85%

### Contract: PeerSession
Confidence: 85%

### Contract: TelemetryEvent
Confidence: 85%

### Contract: DocumentVersion
Confidence: 85%

### Contract: VersionDiff
Confidence: 85%

### Contract: VersionHistory
Confidence: 85%

### LocalSummarizer
Exported function `LocalSummarizer` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 88%

### LocalSummarizer.summarize
Exported function `LocalSummarizer.summarize(document: Document | DocumentSnapshot): Promise<string>` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### LocalSummarizer.isAvailable
Exported function `LocalSummarizer.isAvailable(): boolean` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### LocalSummarizer.getGlobalActiveRequests
Exported function `LocalSummarizer.getGlobalActiveRequests(): number` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### LocalSummarizer.tryRecordRequest
Exported function `LocalSummarizer.tryRecordRequest(): boolean` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### LocalSummarizer.recordRequest
Exported function `LocalSummarizer.recordRequest(): void` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 70%

### LocalSummarizer.releaseRequest
Exported function `LocalSummarizer.releaseRequest(): void` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 70%

### LocalSummarizer.safeRelease
Exported function `LocalSummarizer.safeRelease(): void` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 70%

### RemoteSummarizer
Exported function `RemoteSummarizer` in app/src/ai/summarizer.ts. Side effects: io, async.
Confidence: 88%

### RemoteSummarizer.isAvailable
Exported function `RemoteSummarizer.isAvailable(): boolean` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### RemoteSummarizer.summarize
Exported function `RemoteSummarizer.summarize(document: Document | DocumentSnapshot): Promise<string>` in app/src/ai/summarizer.ts. Side effects: async.
Confidence: 95%

### createValidatorFromStore
Exported function `createValidatorFromStore(_store: any): (id: string) => Promise<boolean>` in app/src/collaboration/presence.ts. Side effects: io.
Confidence: 95%

### createValidatorFromPluginContext
Exported function `createValidatorFromPluginContext(context?: PluginContext): (id: string) => Promise<boolean>` in app/src/collaboration/presence.ts. Side effects: io.
Confidence: 95%

### PresenceTracker
Exported function `PresenceTracker` in app/src/collaboration/presence.ts. Side effects: io, async.
Confidence: 88%

### PresenceTracker.setPluginContext
Exported function `PresenceTracker.setPluginContext(context?: PluginContext): void` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 70%

### PresenceTracker.setSessionTracker
Exported function `PresenceTracker.setSessionTracker(tracker?: {
    openSession?: (id: string, clock?: any) => void;
    closeSession?: (id: string) => void;
    list?: () => any[];
}): void` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 70%

### PresenceTracker.stopCleanupTimer
Exported function `PresenceTracker.stopCleanupTimer(): void` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 70%

### PresenceTracker.join
Exported function `PresenceTracker.join(peerId: string, documentId?: string): PeerPresence` in app/src/collaboration/presence.ts. Side effects: async.
Confidence: 95%

### PresenceTracker.leave
Exported function `PresenceTracker.leave(peerId: string, awaitCleanup: boolean): Promise<void>` in app/src/collaboration/presence.ts. Side effects: async.
Confidence: 95%

### PresenceTracker.getActive
Exported function `PresenceTracker.getActive(): PeerPresence[]` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

## Detected Invariants

- **error-boundary: Defensive cleanup of global request slot after successful acquisition - prevents error propagation if release fails due to race conditions**: Detected 265 occurrence(s) of error-boundary pattern across 26 file(s) in module 'signal-app'. Example: "try { LocalSummarizer.releaseRequest(); } catch (_) { /* swallow */ }" _(88%)_
- **guard: Legitimate guard for Map entry existence check before accessing promise - standard defensive pattern**: Detected 28 occurrence(s) of guard pattern across 16 file(s) in module 'signal-app'. Example: "if (!entry) return undefined;" _(88%)_
- **validation: Input validation boundary**: Detected 15 occurrence(s) of validation pattern across 6 file(s) in module 'signal-app'. Example: "// If a validator exists, validate in the background with a short timeout." _(88%)_
- **sanitization: Input sanitization**: Detected 5 occurrence(s) of sanitization pattern across 4 file(s) in module 'signal-app'. Example: "// Sanitize inputs to protect the search/subsystem from pathological" _(88%)_
- **rate-limit: Rate limiting enforcement**: Detected 6 occurrence(s) of rate-limit pattern across 4 file(s) in module 'signal-app'. Example: "const debounceMs = 2000; // increased debounce to group bursts and reduce IO pressure (longer coalescing to cut filesyst" _(88%)_

## Architectural Decisions (Lineage)

- **[MIGRATION] feat: flip Signal to generative bootstrap + fitness selection** `1cc3ad2` 2026-05-29
  feat: flip Signal to generative bootstrap + fitness selection

Implements plan 001 (workspace/plans/001-generative-fitne
- **[MIGRATION] docs(plans): add generative bootstrap + fitness selection migration plan** `248a72b` 2026-05-29
  docs(plans): add generative bootstrap + fitness selection migration plan

 

## Entities

- **LocalSummarizer**: class in app/src/ai/summarizer.ts
- **PeerPresence**: type in app/src/collaboration/presence.ts
- **PresenceTracker**: class in app/src/collaboration/presence.ts
- **SignalApp**: class in app/src/core/app.ts
- **Document**: interface in app/src/core/types.ts
- **AppConfig**: interface in app/src/core/types.ts
- **VectorClock**: interface in app/src/core/types.ts
- **SyncState**: type in app/src/core/types.ts
- **ConflictStrategy**: type in app/src/core/types.ts
- **PeerInfo**: interface in app/src/core/types.ts
- **SyncAck**: interface in app/src/core/types.ts
- **ConflictRecord**: interface in app/src/core/types.ts
- **SyncMessage**: interface in app/src/core/types.ts
- **OfflineEntry**: interface in app/src/core/types.ts
- **OfflineSyncQueueOptions**: interface in app/src/core/types.ts
- **OfflineSyncQueue**: interface in app/src/core/types.ts
- **SyncManagerOptions**: interface in app/src/core/types.ts
- **ConflictCandidate**: interface in app/src/core/types.ts
- **ConflictCandidateRecord**: type in app/src/core/types.ts
- **DocumentSnapshot**: interface in app/src/core/types.ts
- **DocumentLink**: interface in app/src/core/types.ts
- **LinkKind**: type in app/src/core/types.ts
- **SearchQuery**: interface in app/src/core/types.ts
- **SearchResult**: interface in app/src/core/types.ts
- **SearchResultSnapshot**: interface in app/src/core/types.ts
- **DocumentChange**: interface in app/src/core/types.ts
- **GraphBuilder**: class in app/src/graph/builder.ts
- **Indexer**: class in app/src/index/inverted.ts
- **WorkerPool**: class in app/src/index/workerPool.ts
- **ExportPlugin**: class in app/src/plugins/export.ts
- **HealthPlugin**: class in app/src/plugins/health.ts
- **StorageEventType**: type in app/src/plugins/host.ts
- **Plugin**: type in app/src/plugins/host.ts
- **PluginContext**: type in app/src/plugins/host.ts
- **PluginHost**: class in app/src/plugins/host.ts
- **SearchPlugin**: class in app/src/plugins/search.ts
- **StorageEvent**: type in app/src/storage/events.ts
- **Listener**: type in app/src/storage/events.ts
- **StorageEventBusContract**: interface in app/src/storage/events.ts
- **StorageEventBus**: class in app/src/storage/events.ts
- **ScopedStorageEventBusContract**: interface in app/src/storage/scopedStorageBus.ts
- **ScopedStorageEventBus**: class in app/src/storage/scopedStorageBus.ts
- **TransportSend**: Pluggable transport send function. Implementations wire WebSocket / WebRTC / etc.
- **QueueEntry**: interface in app/src/sync/queue.ts
- **SyncQueueOptions**: interface in app/src/sync/queue.ts
- **SyncQueue**: class in app/src/sync/queue.ts
- **SyncSessionState**: type in app/src/sync/session-tracker.ts
- **SyncSessionEvent**: interface in app/src/sync/session-tracker.ts
- **SyncSessionTrackerOptions**: interface in app/src/sync/session-tracker.ts
- **SyncSessionTracker**: SyncSessionTracker Manages per-peer sync session lifecycle. Emits events on an internal bus so multiple subsystems (SyncManager, PresenceTracker) can observe a single authoritative session view.
- **PeerSession**: class in app/src/sync/session.ts
- **TelemetryEvent**: type in app/src/sync/telemetry.ts
- **DocumentVersion**: interface in app/src/versioning/history.ts
- **VersionDiff**: interface in app/src/versioning/history.ts
- **VersionHistory**: class in app/src/versioning/history.ts

## Services

- **SnapshotStore**: interface in app/src/core/types.ts
- **FileSnapshotStore**: Simple on-disk per-document snapshot store. Each document snapshot is persisted as an individual JSON file under the provided directory. This implementation is best-effort and swallows IO errors to avoid crashing the host process.
- **DocumentSnapshotService**: class in app/src/storage/snapshot-service.ts
- **DiskDocumentSnapshotStore**: DocumentSnapshotService - Writes snapshots atomically using write-then-rename (tmp -> final) - Retains at least two most-recent snapshots per document (prunes older) - Performs all work asynchronously so live document writes are not blocked
- **DocumentStore**: class in app/src/storage/store.ts
- **SyncEngine**: class in app/src/sync/engine.ts
- **SyncManager**: class in app/src/sync/manager.ts
- **SnapshotStore**: Service inferred from interface in app/src/core/types.ts
- **FileSnapshotStore**: Service inferred from Simple on-disk per-document snapshot store. Each document snapshot is persisted as an individual JSON file under the provided directory. This implementation is best-effort and swallows IO errors to avoid crashing the host process.
- **DocumentSnapshotService**: Service inferred from class in app/src/storage/snapshot-service.ts
- **DiskDocumentSnapshotStore**: Service inferred from DocumentSnapshotService - Writes snapshots atomically using write-then-rename (tmp -> final) - Retains at least two most-recent snapshots per document (prunes older) - Performs all work asynchronously so live document writes are not blocked
- **DocumentStore**: Service inferred from class in app/src/storage/store.ts
- **SyncEngine**: Service inferred from class in app/src/sync/engine.ts
- **SyncManager**: Service inferred from class in app/src/sync/manager.ts
- **app**: Module: app

## Constraints

- Authentication required: Auth/session dependencies detected in imports
- Async job processing: Message queue or job processing dependency detected
- Observability: Logging or telemetry dependency detected
- Persistent storage: Database driver or ORM detected
- Test coverage required: Test framework detected
