# signal — Comprehension Report
> Graph v5 · Project type: **web-api**

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

- **Document**: Defined in app/src/core/types.ts
- **DocumentLink**: Defined in app/src/core/types.ts
- **LinkKind**: Defined in app/src/core/types.ts
- **SearchQuery**: Defined in app/src/core/types.ts
- **SearchResult**: Defined in app/src/core/types.ts
- **DocumentChange**: Defined in app/src/core/types.ts
- **GraphNode**: Defined in app/src/graph/builder.ts
- **AdjacencyList**: Defined in app/src/graph/builder.ts
- **StorageEvent**: Defined in app/src/storage/events.ts
- **SyncMessage**: Message exchanged between peers for document sync
- **VectorClock**: Logical clock for causal ordering across peers
- **Plugin**: Defined in app/src/plugins/host.ts
- **PluginContext**: Defined in app/src/plugins/host.ts
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
- **SignalApp**: Central hub wiring all subsystems together
- **DocumentStore**: In-memory document CRUD with JSON file persistence and event emission
- **StorageEventBus**: Pub/sub event bus for storage mutation notifications
- **EditorOperations**: High-level document editing operations (create, update, link)
- **GraphBuilder**: Builds traversable adjacency graph from document links
- **PluginHost**: Plugin lifecycle manager enforcing sandbox boundary
- **ExportPlugin**: Markdown export plugin using PluginContext correctly
- **SearchPlugin**: Search plugin that deliberately violates plugin boundary by importing DocumentStore directly
- **SyncEngine**: Stub eventual-consistency sync engine using vector clocks
- **SyncProtocol**: Types and utilities for peer-to-peer sync messaging
- **LocalSummarizer**: Local document summarization by sentence extraction
- **UIRenderer**: Text-based rendering of documents and graphs
- **app**: Module: app
- **runner**: Module: runner

## Constraints

- Plugin sandbox boundary: Plugins must interact only via PluginContext, not import storage or other internals directly
- Local-first architecture: Data is stored locally (in-memory + JSON persistence) before any sync occurs
- Event-driven storage: All storage mutations emit events so other subsystems can react without tight coupling
- Input validation: Validation libraries or validation code patterns detected
- Async job processing: Background job or queue processing patterns detected
- Observability: Logging and telemetry instrumentation detected
- Test coverage required: Test tooling and test file patterns detected
