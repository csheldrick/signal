# Signal Experiment Tasks

Tasks are ordered by dependency. Each task produces code that Loom can analyze,
creating the structural complexity needed for the framework experiment.

## Phase 1: Core Types and Storage (structural foundation)

### TASK-001: Define core document types

**Module:** `app/src/core/types.ts`
**Goal:** Establish the shared type vocabulary. Every other module imports from here,
making this a high-centrality node in the dependency graph.

- [ ] `Document` interface (id, title, content, tags, links, timestamps)
- [ ] `DocumentLink` interface (sourceId, targetId, kind)
- [ ] `SearchQuery` interface (text, tags, dateRange)
- [ ] `SearchResult` interface (document, score, highlights)

### TASK-002: Implement document store

**Module:** `app/src/storage/store.ts`
**Goal:** In-memory document CRUD with JSON persistence. Hub node in the graph.

- [ ] `DocumentStore` class with `create`, `read`, `update`, `delete`, `list`
- [ ] `search(query)` method (simple text/tag matching)
- [ ] `getLinks(documentId)` for explicit graph traversal
- [ ] JSON file persistence (`save()` / `load()`)

### TASK-003: Define storage events

**Module:** `app/src/storage/events.ts`
**Goal:** Event types that other modules subscribe to. Creates `depends_on` edges.

- [ ] `StorageEvent` discriminated union (created, updated, deleted, linked)
- [ ] `StorageEventBus` with typed `on()` / `emit()`

## Phase 2: Cross-Module Dependencies (edge complexity)

### TASK-004: Document graph builder

**Module:** `app/src/graph/builder.ts`
**Goal:** Builds a graph from document links. Imports from `core/types` and `storage`.

- [ ] `GraphBuilder` class
- [ ] `buildGraph(store)` → returns adjacency list from document links
- [ ] `findClusters()` → connected components
- [ ] `findHubs()` → documents with highest link count

### TASK-005: AI summarizer

**Module:** `app/src/ai/summarizer.ts`
**Goal:** Summarizes documents. Imports from `core/types`. Demonstrates the `ai`
subsystem boundary.

- [ ] `Summarizer` interface with `summarize(document): Promise<string>`
- [ ] `LocalSummarizer` implementation (simple extractive: first N sentences)

### TASK-006: Editor operations

**Module:** `app/src/editor/operations.ts`
**Goal:** Document editing operations. Imports from `core/types`, `storage`, and
emits storage events.

- [ ] `createDocument(title, content, tags)`
- [ ] `updateDocument(id, changes)`
- [ ] `linkDocuments(sourceId, targetId, kind)`
- [ ] `deleteDocument(id)` (cascades link removal)

## Phase 3: Plugin System (boundary experiment)

### TASK-007: Plugin host

**Module:** `app/src/plugins/host.ts`
**Goal:** Plugin lifecycle manager. Defines the sandbox boundary.

- [ ] `Plugin` interface (id, name, activate, deactivate)
- [ ] `PluginHost` class (register, enable, disable, list)
- [ ] `PluginContext` — restricted API surface plugins receive (NO direct store access)

### TASK-008: Search plugin (deliberate boundary violation)

**Module:** `app/src/plugins/search.ts`
**Goal:** A plugin that deliberately imports from `storage/store.ts` directly,
violating the sandbox boundary. This is the seeded architectural tension for EXP-002.

- [ ] `SearchPlugin` implementing `Plugin`
- [ ] Direct import of `DocumentStore` from `../storage/store.js` (violation!)
- [ ] `search(query)` method that uses the store directly

### TASK-009: Export plugin (correct boundary usage)

**Module:** `app/src/plugins/export.ts`
**Goal:** A plugin that correctly uses only the `PluginContext` API.
Contrast with TASK-008 for boundary detection validation.

- [ ] `ExportPlugin` implementing `Plugin`
- [ ] Uses only `PluginContext` methods (no direct storage import)
- [ ] `exportToMarkdown()` via context API

## Phase 4: Sync Skeleton (subsystem depth)

### TASK-010: Sync protocol types

**Module:** `app/src/sync/protocol.ts`
**Goal:** Types for the sync layer. Adds another subsystem to the graph.

- [ ] `SyncMessage` type (operation, documentId, payload, vectorClock)
- [ ] `VectorClock` type and merge function
- [ ] `SyncState` enum (idle, syncing, conflicted, resolved)

### TASK-011: Sync engine stub

**Module:** `app/src/sync/engine.ts`
**Goal:** Sync engine that imports from `storage` and `sync/protocol`.
Creates cross-subsystem edges.

- [ ] `SyncEngine` class (stub — no real networking)
- [ ] `applyRemoteChange(message)` — merges into local store
- [ ] `generateOutbound(event)` — converts storage events to sync messages

## Phase 5: App Entry Point

### TASK-012: Application bootstrap

**Module:** `app/src/core/app.ts`
**Goal:** Wires everything together. High fan-out node importing from all subsystems.

- [ ] `SignalApp` class
- [ ] Constructor wires: store, event bus, graph builder, plugin host, sync engine
- [ ] `start()` — loads persisted state, enables plugins
- [ ] `shutdown()` — saves state, disables plugins

## Phase 6: Framework Validation

### TASK-013: Run Loom onboard and validate export

- [ ] Run `loom onboard` on Signal
- [ ] Verify `LoomExport` contains ≥20 nodes, ≥15 edges, ≥3 clusters
- [ ] Verify cross-subsystem edges exist (editor → storage, plugins → storage)
- [ ] Save export for Weave import

### TASK-014: Run Weave import and validate cognitive state

- [ ] Import LoomExport into Weave runtime
- [ ] Inject activation at the boundary-violating node (plugins/search.ts)
- [ ] Run 50 ticks
- [ ] Verify ContradictionDetectionOperator fires
- [ ] Verify at least one tension is created

### TASK-015: Run Utilis execution and validate feedback loop

- [ ] Register `createIntentHandler()` with Weave runtime
- [ ] Register an execution trigger for high-activation nodes
- [ ] Run ticks until an ExecutionIntent fires
- [ ] Verify IntentResult returns with `status: 'ok'`
- [ ] Verify Weave ingests the result and creates an `execution_result` node
