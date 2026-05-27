# signal — Comprehension Report
> Graph v2 · Project type: **web-api**

## Module Boundaries

### signal-app
Module boundary at app containing 35 source file(s).
_Path: `app`_
Confidence: 95%

## Inferred Contracts

### Contract: Summarizer
Confidence: 85%

### Contract: LocalSummarizer
Confidence: 85%

### Contract: RemoteSummarizer
Confidence: 85%

### Contract: DocumentReader
Confidence: 85%

### Contract: PresenceStatus
Confidence: 85%

### Contract: PeerPresence
Confidence: 85%

### Contract: PresenceTracker
Confidence: 85%

### Contract: AppConfig
Confidence: 85%

### Contract: SignalApp
Confidence: 85%

### Contract: Document
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

### Contract: SearchHit
Confidence: 85%

### Contract: InvertedIndexSearchHit
Confidence: 85%

### Contract: IndexStats
Confidence: 85%

### Contract: InvertedIndex
Confidence: 85%

### Contract: GraphNode
Confidence: 85%

### Contract: AdjacencyList
Confidence: 85%

### Contract: GraphAdjacencyList
Confidence: 85%

### Contract: GraphBuilder
Confidence: 85%

### Contract: IndexerContract
Confidence: 85%

### Contract: Indexer
Confidence: 85%

### Contract: IndexWorker
Confidence: 85%

### Contract: WorkerPoolOptions
Confidence: 85%

### Contract: WorkerPool
Confidence: 85%

### Contract: ExportPlugin
Confidence: 85%

### Contract: Plugin
Confidence: 85%

### Contract: PluginContext
Confidence: 85%

### Contract: PluginHost
Confidence: 85%

### Contract: SearchPlugin
Confidence: 85%

### Contract: StorageEventType
Confidence: 85%

### Contract: StorageEventCreated
Confidence: 85%

### Contract: StorageEventUpdated
Confidence: 85%

### Contract: StorageEventDeleted
Confidence: 85%

### Contract: StorageEventLinked
Confidence: 85%

### Contract: StorageEvent
Confidence: 85%

### Contract: StorageEventBusContract
Confidence: 85%

### Contract: StorageEventBus
Confidence: 85%

### Contract: DocumentSnapshotServiceOptions
Confidence: 85%

### Contract: ConflictCandidate
Confidence: 85%

### Contract: ConflictResolution
Confidence: 85%

### Contract: ConflictCandidateRecord
Confidence: 85%

### Contract: TransportSend
Confidence: 85%

### Contract: SyncManagerOptions
Confidence: 85%

### Contract: OfflineEntry
Confidence: 85%

### Contract: OfflineSyncQueueOptions
Confidence: 85%

### Contract: OfflineSyncQueue
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

### Contract: VectorClock
Confidence: 85%

### Contract: SyncMessage
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
Exported function `LocalSummarizer.summarize(document: Document): Promise<string>` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### RemoteSummarizer
Exported function `RemoteSummarizer` in app/src/ai/summarizer.ts. Side effects: io, async.
Confidence: 88%

### RemoteSummarizer.summarize
Exported function `RemoteSummarizer.summarize(document: Document): Promise<string>` in app/src/ai/summarizer.ts. Side effects: async.
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

### PresenceTracker.getViewers
Exported function `PresenceTracker.getViewers(documentId: string): PeerPresence[]` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

### PresenceTracker.focusDocument
Exported function `PresenceTracker.focusDocument(peerId: string, documentId: string): Promise<boolean>` in app/src/collaboration/presence.ts. Side effects: async.
Confidence: 95%

### PresenceTracker.setValidator
Exported function `PresenceTracker.setValidator(validate?: (id: string) => boolean | Promise<boolean>): void` in app/src/collaboration/presence.ts. Side effects: io.
Confidence: 70%

### PresenceTracker.setAsyncValidator
Exported function `PresenceTracker.setAsyncValidator(validate?: (id: string) => Promise<boolean>): void` in app/src/collaboration/presence.ts. Side effects: async.
Confidence: 70%

### PresenceTracker.summary
Exported function `PresenceTracker.summary(): {
    active: number;
    idle: number;
    offline: number;
}` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

### SignalApp
Exported function `SignalApp` in app/src/core/app.ts. Side effects: database, io, async.
Confidence: 88%

### SignalApp.enableRemoteSummarizer
Exported function `SignalApp.enableRemoteSummarizer(fetcher: (document: Document, opts?: {
    authToken?: string;
}) => Promise<string>, options?: {
    allowNetwork?: boolean;
    maxSentences?: number;
}): boolean` in app/src/core/app.ts. Pure function (no detected side effects).
Confidence: 95%

## Detected Invariants

- **error-boundary: Error boundary (try/catch)**: Detected 183 occurrence(s) of error-boundary pattern across 22 file(s) in module 'signal-app'. Example: "try { LocalSummarizer.releaseRequest(); } catch (_) { /* swallow */ }" _(88%)_
- **guard: Guard clause (null/undefined check)**: Detected 26 occurrence(s) of guard pattern across 14 file(s) in module 'signal-app'. Example: "if (!entry) return undefined;" _(88%)_
- **validation: Input validation boundary**: Detected 13 occurrence(s) of validation pattern across 5 file(s) in module 'signal-app'. Example: "// If a validator exists, validate in the background with a short timeout." _(88%)_
- **sanitization: Input sanitization**: Detected 4 occurrence(s) of sanitization pattern across 3 file(s) in module 'signal-app'. Example: "// Sanitize inputs to protect the search/subsystem from pathological" _(88%)_

## Architectural Decisions (Lineage)

- **[REFACTOR] refactor: replace Document type with DocumentSnapshot for improved readonly cont** `20ae1ff` 2026-05-26
  refactor: replace Document type with DocumentSnapshot for improved readonly contract

- Updated presence.ts to use Docum
- **[REFACTOR] fix(presence): refactor to use PluginContext for document access and remove dire** `2b3326d` 2026-05-25
  fix(presence): refactor to use PluginContext for document access and remove direct imports

 
- **[REFACTOR] Refactor code structure for improved readability and maintainability** `7542e4c` 2026-05-25
  Refactor code structure for improved readability and maintainability

 

## Entities

- **Summarizer**: interface in app/src/ai/summarizer.ts
- **LocalSummarizer**: class in app/src/ai/summarizer.ts
- **RemoteSummarizer**: class in app/src/ai/summarizer.ts
- **DocumentReader**: interface in app/src/collaboration/presence.ts
- **PresenceStatus**: type in app/src/collaboration/presence.ts
- **PeerPresence**: interface in app/src/collaboration/presence.ts
- **PresenceTracker**: class in app/src/collaboration/presence.ts
- **AppConfig**: interface in app/src/core/app.ts
- **SignalApp**: class in app/src/core/app.ts
- **Document**: interface in app/src/core/types.ts
- **DocumentSnapshot**: interface in app/src/core/types.ts
- **DocumentLink**: interface in app/src/core/types.ts
- **LinkKind**: type in app/src/core/types.ts
- **SearchQuery**: interface in app/src/core/types.ts
- **SearchResult**: interface in app/src/core/types.ts
- **SearchResultSnapshot**: interface in app/src/core/types.ts
- **DocumentChange**: interface in app/src/core/types.ts
- **SearchHit**: interface in app/src/core/types.ts
- **InvertedIndexSearchHit**: interface in app/src/core/types.ts
- **IndexStats**: interface in app/src/core/types.ts
- **InvertedIndex**: interface in app/src/core/types.ts
- **GraphNode**: interface in app/src/graph/builder.ts
- **AdjacencyList**: interface in app/src/graph/builder.ts
- **GraphAdjacencyList**: type in app/src/graph/builder.ts
- **GraphBuilder**: class in app/src/graph/builder.ts
- **IndexerContract**: interface in app/src/index/inverted.ts
- **Indexer**: class in app/src/index/inverted.ts
- **IndexWorker**: interface in app/src/index/workerPool.ts
- **WorkerPoolOptions**: interface in app/src/index/workerPool.ts
- **WorkerPool**: class in app/src/index/workerPool.ts
- **ExportPlugin**: class in app/src/plugins/export.ts
- **Plugin**: interface in app/src/plugins/host.ts
- **PluginContext**: interface in app/src/plugins/host.ts
- **PluginHost**: class in app/src/plugins/host.ts
- **SearchPlugin**: class in app/src/plugins/search.ts
- **StorageEventType**: type in app/src/storage/events.ts
- **StorageEventCreated**: interface in app/src/storage/events.ts
- **StorageEventUpdated**: interface in app/src/storage/events.ts
- **StorageEventDeleted**: interface in app/src/storage/events.ts
- **StorageEventLinked**: interface in app/src/storage/events.ts
- **StorageEvent**: type in app/src/storage/events.ts
- **StorageEventBusContract**: interface in app/src/storage/events.ts
- **StorageEventBus**: class in app/src/storage/events.ts
- **DocumentSnapshotServiceOptions**: interface in app/src/storage/snapshot-service.ts
- **ConflictCandidate**: interface in app/src/sync/conflict.ts
- **ConflictResolution**: interface in app/src/sync/conflict.ts
- **ConflictCandidateRecord**: Detect whether a remote document write genuinely conflicts with the local version (concurrent vector clocks) or is simply a causally-later update.
- **TransportSend**: Pluggable transport send function. Implementations wire WebSocket / WebRTC / etc.
- **SyncManagerOptions**: interface in app/src/sync/manager.ts
- **OfflineEntry**: interface in app/src/sync/offline-queue.ts
- **OfflineSyncQueueOptions**: interface in app/src/sync/offline-queue.ts
- **OfflineSyncQueue**: OfflineSyncQueue Durable, per-peer queue that persists opaque payloads to disk when network transport is unavailable. Ensures causal (timestamp/seq) ordering when draining and provides robust rewrite behaviour so partially applied drains do not lose remaining entries.
- **SyncState**: type in app/src/sync/protocol.ts
- **ConflictStrategy**: type in app/src/sync/protocol.ts
- **PeerInfo**: interface in app/src/sync/protocol.ts
- **SyncAck**: interface in app/src/sync/protocol.ts
- **ConflictRecord**: interface in app/src/sync/protocol.ts
- **VectorClock**: interface in app/src/sync/protocol.ts
- **SyncMessage**: interface in app/src/sync/protocol.ts
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

- **SyncEngine**: type in app/src/collaboration/presence.ts
- **ClockProvider**: interface in app/src/collaboration/presence.ts
- **SnapshotStore**: interface in app/src/storage/snapshot-service.ts
- **DocumentSnapshotService**: class in app/src/storage/snapshot-service.ts
- **DocumentStore**: class in app/src/storage/store.ts
- **SyncManager**: class in app/src/sync/manager.ts
- **SyncEngine**: Service inferred from type in app/src/collaboration/presence.ts
- **ClockProvider**: Service inferred from interface in app/src/collaboration/presence.ts
- **SnapshotStore**: Service inferred from interface in app/src/storage/snapshot-service.ts
- **DocumentSnapshotService**: Service inferred from class in app/src/storage/snapshot-service.ts
- **DocumentStore**: Service inferred from class in app/src/storage/store.ts
- **SyncManager**: Service inferred from class in app/src/sync/manager.ts
- **app**: Module: app

## Constraints

- Authentication required: Auth/session dependencies detected in imports
- Async job processing: Message queue or job processing dependency detected
- Observability: Logging or telemetry dependency detected
- Persistent storage: Database driver or ORM detected
- Test coverage required: Test framework detected
