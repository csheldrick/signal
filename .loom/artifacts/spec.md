# signal — Comprehension Report
> Graph v6 · Project type: **web-api**

## Module Boundaries

### signal-app
Module boundary at app containing 13 source file(s).
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

## Detected Invariants

- **guard: Guard clause (null/undefined check)**: Detected 1 occurrence(s) of guard pattern across 1 file(s) in module 'signal-app'. Example: "if (!existing) return undefined;" _(65%)_

## Entities

- **Document**: Core knowledge unit with id, title, content, tags, links, and timestamps
- **DocumentLink**: Typed directed edge between two documents (reference, related, derived_from, blocks)
- **LinkKind**: Enumerated relationship type for DocumentLink edges
- **SearchQuery**: Query parameters for full-text and tag-based document search
- **SearchResult**: Ranked document match returned from a search operation
- **DocumentChange**: Delta record describing a mutation applied to a document
- **GraphNode**: Lightweight projection of a document for graph traversal (id, title, linkCount)
- **AdjacencyList**: In-memory graph structure with node map and edge sets
- **StorageEvent**: Discriminated union event emitted on storage mutations (created, updated, deleted, linked)
- **SyncMessage**: Wire message carrying a CRDT operation, payload, vector clock, and peer metadata
- **VectorClock**: Per-peer logical clock map used for eventual-consistency conflict resolution
- **Plugin**: Lifecycle interface (activate/deactivate) for extensible plugin modules
- **PluginContext**: Sandboxed API surface exposed to plugins (list, search, get documents)
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

## Services

- **CoreTypes**: Shared type vocabulary imported by all modules
- **SignalApp**: Central application wiring hub that composes all subsystems; highest fan-out node in the dependency graph
- **DocumentStore**: In-memory CRUD store for documents with JSON file persistence and event emission; central hub depended on by most modules
- **StorageEventBus**: Pub/sub event bus for storage mutation events enabling decoupled inter-module communication
- **EditorOperations**: High-level document editing functions (create, update, link) delegating to DocumentStore
- **GraphBuilder**: Builds a traversable AdjacencyList from document links stored in DocumentStore
- **PluginHost**: Manages plugin lifecycle and enforces sandbox boundary by exposing only PluginContext to plugins
- **ExportPlugin**: Plugin that exports documents to Markdown using only PluginContext (correct boundary usage)
- **SearchPlugin**: Plugin that performs document search but directly imports DocumentStore in violation of the plugin sandbox boundary
- **SyncEngine**: Stub eventual-consistency sync layer that tracks vector clocks and queues outbound SyncMessages
- **SyncProtocol**: Types and utilities for peer-to-peer sync messaging
- **LocalSummarizer**: Local AI summarization implementation that extracts top-N sentences from document content
- **UIRenderer**: Text-based renderer for documents and graph adjacency lists
- **app**: Module: app
- **runner**: Module: runner
- **ExperimentRunner**: Node.js entry point that instantiates Weave ContinuityRuntime, loads a LoomExport from .loom/loom.db, and wires Utilis intent handlers and operators

## Constraints

- Plugin sandbox boundary: Plugins must interact only via PluginContext, not import storage or other internals directly
- Local-first architecture: Data is stored locally (in-memory + JSON persistence) before any sync occurs
- Event-driven storage: All storage mutations emit events so other subsystems can react without tight coupling
- Input validation: Validation libraries or validation code patterns detected
- Async job processing: Background job or queue processing patterns detected
- Observability: Logging and telemetry instrumentation detected
- Test coverage required: Test tooling and test file patterns detected
- Plugin Sandbox Boundary: Plugins must interact with the system exclusively through PluginContext, not by importing DocumentStore or other internal modules directly, to preserve encapsulation and security
- Local-First Storage: All document data is persisted locally (JSON file + in-memory Map) with no remote database dependency, supporting offline-first usage
- Eventual Consistency: Sync layer uses vector clocks and CRDT-style merge to reconcile divergent document states across peers without requiring coordination
- Type-Only Cross-Module Imports: Several modules import only types (import type) from dependencies, limiting runtime coupling and enabling better tree-shaking
- No External Runtime Dependencies in app/: The app package declares no runtime dependencies, only devDependencies, constraining it to pure TypeScript with Node built-ins
- Loom Onboarding Prerequisite: The experiment runner requires loom onboard to have been executed in the signal root to produce .loom/loom.db before the runner can start
