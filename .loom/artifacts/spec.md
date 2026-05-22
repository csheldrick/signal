# signal — Comprehension Report
> Graph v8 · Project type: **web-api**

## Module Boundaries

### signal-app
Module boundary at app containing 20 source file(s).
_Path: `app`_
Confidence: 95%

### signal-runner
Module boundary at runner containing 1 source file(s).
_Path: `runner`_
Confidence: 95%

## Inferred Contracts

### Contract: Document
Confidence: 85%

### Contract: DocumentLink
Confidence: 85%

### Contract: LinkKind
Confidence: 85%

### Contract: SearchQuery
Confidence: 85%

### Contract: SearchResult
Confidence: 85%

### Contract: DocumentChange
Confidence: 85%

### Contract: GraphNode
Confidence: 85%

### Contract: AdjacencyList
Confidence: 85%

### Contract: StorageEvent
Confidence: 85%

### Contract: SyncMessage
Confidence: 85%

### Contract: VectorClock
Confidence: 85%

### Contract: Plugin
Confidence: 85%

### Contract: PluginContext
Confidence: 85%

### LocalSummarizer
Exported function `LocalSummarizer` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 88%

### LocalSummarizer.summarize
Exported function `LocalSummarizer.summarize(document: Document): Promise<string>` in app/src/ai/summarizer.ts. Pure function (no detected side effects).
Confidence: 95%

### SignalApp
Exported function `SignalApp` in app/src/core/app.ts. Side effects: database.
Confidence: 88%

### SignalApp.start
Exported function `SignalApp.start(dataPath?: string): void` in app/src/core/app.ts. Pure function (no detected side effects).
Confidence: 70%

### SignalApp.shutdown
Exported function `SignalApp.shutdown(dataPath?: string): void` in app/src/core/app.ts. Side effects: database.
Confidence: 70%

### SignalApp.isRunning
Exported function `SignalApp.isRunning(): boolean` in app/src/core/app.ts. Pure function (no detected side effects).
Confidence: 95%

### createDocument
Exported function `createDocument(store: DocumentStore, title: string, content: string, tags: string[]): Document` in app/src/editor/operations.ts. Pure function (no detected side effects).
Confidence: 95%

### updateDocument
Exported function `updateDocument(store: DocumentStore, id: string, changes: DocumentChange): Document | undefined` in app/src/editor/operations.ts. Pure function (no detected side effects).
Confidence: 95%

### linkDocuments
Exported function `linkDocuments(store: DocumentStore, sourceId: string, targetId: string, kind: LinkKind): boolean` in app/src/editor/operations.ts. Pure function (no detected side effects).
Confidence: 95%

### deleteDocument
Exported function `deleteDocument(store: DocumentStore, id: string): boolean` in app/src/editor/operations.ts. Pure function (no detected side effects).
Confidence: 95%

### GraphBuilder
Exported function `GraphBuilder` in app/src/graph/builder.ts. Pure function (no detected side effects).
Confidence: 88%

### GraphBuilder.buildGraph
Exported function `GraphBuilder.buildGraph(): AdjacencyList` in app/src/graph/builder.ts. Pure function (no detected side effects).
Confidence: 95%

### GraphBuilder.findClusters
Exported function `GraphBuilder.findClusters(): string[][]` in app/src/graph/builder.ts. Pure function (no detected side effects).
Confidence: 95%

### GraphBuilder.findHubs
Exported function `GraphBuilder.findHubs(minLinks: number): GraphNode[]` in app/src/graph/builder.ts. Pure function (no detected side effects).
Confidence: 95%

### ExportPlugin
Exported function `ExportPlugin` in app/src/plugins/export.ts. Pure function (no detected side effects).
Confidence: 88%

### ExportPlugin.activate
Exported function `ExportPlugin.activate(context: PluginContext): void` in app/src/plugins/export.ts. Pure function (no detected side effects).
Confidence: 70%

### ExportPlugin.deactivate
Exported function `ExportPlugin.deactivate(): void` in app/src/plugins/export.ts. Pure function (no detected side effects).
Confidence: 70%

### ExportPlugin.exportToMarkdown
Exported function `ExportPlugin.exportToMarkdown(): string` in app/src/plugins/export.ts. Pure function (no detected side effects).
Confidence: 95%

### PluginHost
Exported function `PluginHost` in app/src/plugins/host.ts. Pure function (no detected side effects).
Confidence: 88%

### PluginHost.register
Exported function `PluginHost.register(plugin: Plugin): void` in app/src/plugins/host.ts. Pure function (no detected side effects).
Confidence: 70%

### PresenceTracker
Exported function `PresenceTracker` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 88%

### PresenceTracker.join
Exported function `PresenceTracker.join(peerId: string, documentId?: string): PeerPresence` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

### PresenceTracker.leave
Exported function `PresenceTracker.leave(peerId: string): void` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 70%

### PresenceTracker.getActive
Exported function `PresenceTracker.getActive(): PeerPresence[]` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

### PresenceTracker.getViewers
Exported function `PresenceTracker.getViewers(documentId: string): PeerPresence[]` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

### PresenceTracker.focusDocument
Exported function `PresenceTracker.focusDocument(peerId: string, documentId: string): boolean` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

### PresenceTracker.summary
Exported function `PresenceTracker.summary(): {
    active: number;
    idle: number;
    offline: number;
}` in app/src/collaboration/presence.ts. Pure function (no detected side effects).
Confidence: 95%

## Detected Invariants

- **guard: Guard clause (null/undefined check)**: Detected 3 occurrence(s) of guard pattern across 3 file(s) in module 'signal-app'. Example: "if (!doc) return false;" _(88%)_

## Entities

- **Document**: Core content unit with id, title, content, tags, links, and timestamps
- **DocumentLink**: Typed directional edge between two documents (reference, related, derived_from, blocks)
- **LinkKind**: Enumerated relationship type for document links
- **SearchQuery**: Full-text and tag-based query descriptor for document search
- **SearchResult**: Scored document match returned from search
- **DocumentChange**: Record of a mutation applied to a document
- **GraphNode**: Graph vertex representing a document with link count
- **AdjacencyList**: In-memory graph representation with node map and edge sets
- **StorageEvent**: Discriminated union event emitted on document CRUD mutations (created, updated, deleted, linked)
- **SyncMessage**: Protocol envelope carrying document state between peers
- **VectorClock**: Peer-keyed logical clock map used for distributed concurrency detection
- **Plugin**: Lifecycle interface for activatable/deactivatable extensions
- **PluginContext**: Sandboxed API surface exposed to plugins — abstracts direct store access
- **Summarizer**: Defined in app/src/ai/summarizer.ts
- **LocalSummarizer**: Defined in app/src/ai/summarizer.ts
- **AppConfig**: Defined in app/src/core/app.ts
- **SignalApp**: Defined in app/src/core/app.ts
- **GraphBuilder**: Defined in app/src/graph/builder.ts
- **ExportPlugin**: Defined in app/src/plugins/export.ts
- **PluginHost**: Defined in app/src/plugins/host.ts
- **SearchPlugin**: Defined in app/src/plugins/search.ts
- **StorageEventType**: Defined in app/src/storage/events.ts
- **StorageEventCreated**: Defined in app/src/storage/events.ts
- **StorageEventUpdated**: Defined in app/src/storage/events.ts
- **StorageEventDeleted**: Defined in app/src/storage/events.ts
- **StorageEventLinked**: Defined in app/src/storage/events.ts
- **DocumentVersion**: Immutable snapshot of a Document forming a parent-child temporal chain
- **SearchHit**: Indexed search result with document ID and IDF score
- **DocumentVersion**: Versioned snapshot with parentVersionId enabling lineage chains
- **IndexStats**: Metrics snapshot of the inverted index state
- **PeerInfo**: Metadata about a known sync peer including clock and last-seen timestamp
- **ConflictRecord**: Audit record of a detected and resolved write conflict
- **ConflictCandidate**: Pair of concurrent document versions awaiting resolution
- **ConflictResolution**: Outcome of conflict resolution including winning document and record
- **PeerSession**: Stateful representation of an active sync session with a remote peer
- **SyncAck**: Acknowledgement message confirming receipt of a sync message
- **SyncState**: State machine value for a sync session (idle, syncing, conflicted, resolved)
- **ConflictStrategy**: Policy enum for resolving concurrent writes (last-write-wins, first-write-wins, merge-content)

## Services

- **CoreTypes**: Shared type vocabulary imported by all modules
- **SignalApp**: Root application wiring all subsystems together; high fan-out central hub node
- **DocumentStore**: In-memory CRUD store with JSON file persistence; hub node depended on by most modules
- **StorageEventBus**: Event emitter for storage mutations; decouples store from consumers via pub/sub
- **EditorOperations**: High-level document editing operations (create, update, link) delegating to DocumentStore
- **GraphBuilder**: Constructs traversable adjacency-list graph from document links stored in DocumentStore
- **PluginHost**: Plugin lifecycle manager exposing sandboxed PluginContext; enforces subsystem boundary
- **ExportPlugin**: Markdown export plugin using only PluginContext (correct boundary usage, contrast to SearchPlugin)
- **SearchPlugin**: Plugin that bypasses PluginContext and imports DocumentStore directly (deliberate boundary violation)
- **SyncEngine**: Core sync logic: maintains vector clock, processes inbound SyncMessages, produces outbound messages
- **SyncProtocol**: Types and utilities for peer-to-peer sync messaging
- **LocalSummarizer**: Local AI summarizer extracting leading sentences from document content
- **UIRenderer**: UI rendering layer for the workspace
- **app**: Module: app
- **runner**: Module: runner
- **ExperimentRunner**: Runner package that wires Signal, Loom, Weave, and Utilis together for experiment execution
- **InvertedIndex**: Full-text search index with IDF scoring; fan-in hub for document indexing
- **PresenceTracker**: Collaboration presence module with compound boundary violation: imports DocumentStore and SyncEngine directly
- **VersionHistory**: Document versioning and history management
- **SyncManager**: Top-level sync coordinator: subscribes to store events, manages peer sessions, runs flush loop
- **SyncQueue**: Outbound message queue buffering SyncMessages before transmission
- **SyncSession**: Per-peer session state management for the sync layer
- **ConflictResolver**: Detects concurrent writes via vector clock comparison and applies configurable merge strategy
- **Runner**: Experiment runner package wiring Signal, Loom, Weave, and Utilis together for architectural analysis

## Constraints

- Plugin sandbox boundary: Plugins must interact only via PluginContext, not import storage or other internals directly
- Local-first architecture: Data is stored locally (in-memory + JSON persistence) before any sync occurs
- Event-driven storage: All storage mutations emit events so other subsystems can react without tight coupling
- Input validation: Validation libraries or validation code patterns detected
- Async job processing: Background job or queue processing patterns detected
- Observability: Logging and telemetry instrumentation detected
- Test coverage required: Test tooling and test file patterns detected
- Plugin Sandbox Boundary: Plugins must access data only through PluginContext, not by importing DocumentStore or other internal modules directly, to maintain subsystem isolation
- Local-First Storage: All document data is persisted locally (JSON file + in-memory Map) with no remote database dependency, supporting offline-first usage
- Eventual Consistency: Sync layer uses vector clocks and CRDT-style merge to reconcile divergent document states across peers without requiring coordination
- Type-Only Cross-Module Imports: Several modules import only types (import type) from dependencies, limiting runtime coupling and enabling better tree-shaking
- No External Runtime Dependencies in app/: The app package declares no runtime dependencies, only devDependencies, constraining it to pure TypeScript with Node built-ins
- Loom Onboarding Prerequisite: The experiment runner requires loom onboard to have been executed in the signal root to produce .loom/loom.db before the runner can start
- Subsystem Boundary Isolation: Collaboration, sync, storage, and editor subsystems should not cross-import each other directly; cross-subsystem access must go through defined interfaces (e.g., PluginContext, events)
- Local-First / Offline Capability: All storage and operations must work locally without a server; JSON file persistence and in-memory store enforce this
- Eventual Consistency via Vector Clocks: Concurrent writes are detected using vector clocks and resolved via a configurable strategy rather than requiring coordination locks
- Immutable Version Snapshots: Document versions are append-only parent-child chains; history must not be mutated to preserve lineage integrity
- Type Centrality via core/types: All shared types must be defined in core/types.ts to maintain a single source of truth; no duplicate type definitions across modules
- Sync Subsystem Isolation: Collaboration concerns (e.g., presence) should not reach into the sync layer directly; cross-subsystem access must be mediated
- Local-First Data Ownership: All data is stored and processed locally (in-memory + JSON file); no mandatory remote backend
- No Test Coverage: Test script is a no-op placeholder; no automated tests exist yet, creating quality risk
- Non-Cryptographic ID Generation: Document IDs are generated from Date.now() + counter, not cryptographically random, risking collisions in concurrent environments
