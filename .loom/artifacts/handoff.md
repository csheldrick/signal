# Loom Handoff — signal
> Graph v2 · Generated 2026-05-22T14:21:49 UTC

**This document is a cross-session context brief.** Paste it into a new agent session to resume work without re-reading source files.

## Executive Summary

- Signal is a modestly-scoped application consisting of a single module with 33 contracts, 13 service routes, and 1 invariant, suggesting a self-contained system with straightforward internal structure.
- Comprehension health is strong: zero low-confidence nodes, zero active drift events, and zero pending evolution proposals indicate the codebase is well-mapped and stable with no known gaps in understanding.
- The single-module architecture with no fan-in or fan-out coupling and zero architectural lineage events suggests the system either operates in isolation or its integration points have not yet been documented—this warrants clarification.
- The low invariant count (1 across 33 contracts) is a concern; critical business rules may be implicit rather than explicitly captured, increasing risk of unintended behavioral changes during future development.
- Recommended next steps: (1) verify whether external integrations exist and document any missing lineage events, (2) conduct an invariant discovery pass to surface and formalize implicit business rules, and (3) establish baseline coupling and evolution tracking before the system grows beyond its current single-module boundary.

## Suggested Next Steps

- Comprehension model looks healthy. Run `loom drift` to check for fresh divergence.

## Comprehension State

| Kind | Count |
|---|---|
| Modules | 1 |
| Contracts | 33 |
| Invariants | 1 |
| Services | 13 |
| Lineage nodes | 0 |

## Modules

### signal-app (95%)
- **Path:** `app`
- **Files:** 13 | **Coupling:** fanIn: 0, fanOut: 0
- **Owners:** LocalSummarizer, LocalSummarizer.summarize, SignalApp, SignalApp.start, SignalApp.shutdown, SignalApp.isRunning, createDocument, updateDocument, linkDocuments, deleteDocument, GraphBuilder, GraphBuilder.buildGraph, GraphBuilder.findClusters, GraphBuilder.findHubs, ExportPlugin, ExportPlugin.activate, ExportPlugin.deactivate, ExportPlugin.exportToMarkdown, PluginHost, PluginHost.register, Summarizer, AppConfig, Document, DocumentLink, LinkKind, SearchQuery, SearchResult, DocumentChange, GraphNode, AdjacencyList, Plugin, PluginContext, StorageEventType, StorageEventCreated, StorageEventUpdated, StorageEventDeleted, StorageEventLinked, StorageEvent, SyncState, VectorClock, SyncMessage
- *Evidence:* `C:\vscode-projects\signal\app` — app/package.json found at app/package.json — explicit module boundary (javascript).
- *Evidence:* `C:\vscode-projects\signal\app\package.json` — package.json defines the module name and version.

## Contracts

### SignalApp.start (70%)
```
SignalApp.start(dataPath?: string): void
```
- **Module:** signal-app
- *Evidence:* `app/src/core/app.ts:51` — Exported function signature extracted by static analysis. Side effects detected: none.

### SignalApp.shutdown (70%)
```
SignalApp.shutdown(dataPath?: string): void
```
- **Side effects:** database
- **Module:** signal-app
- *Evidence:* `app/src/core/app.ts:59` — Exported function signature extracted by static analysis. Side effects detected: database.

### ExportPlugin.activate (70%)
```
ExportPlugin.activate(context: PluginContext): void
```
- **Module:** signal-app
- *Evidence:* `app/src/plugins/export.ts:12` — Exported function signature extracted by static analysis. Side effects detected: none.

### ExportPlugin.deactivate (70%)
```
ExportPlugin.deactivate(): void
```
- **Module:** signal-app
- *Evidence:* `app/src/plugins/export.ts:16` — Exported function signature extracted by static analysis. Side effects detected: none.

### PluginHost.register (70%)
```
PluginHost.register(plugin: Plugin): void
```
- **Module:** signal-app
- *Evidence:* `app/src/plugins/host.ts:29` — Exported function signature extracted by static analysis. Side effects detected: none.

### Contract: Document (85%)

### Contract: DocumentLink (85%)

### Contract: LinkKind (85%)

### Contract: SearchQuery (85%)

### Contract: SearchResult (85%)

### Contract: DocumentChange (85%)

### Contract: GraphNode (85%)

### Contract: AdjacencyList (85%)

### Contract: StorageEvent (85%)

### Contract: SyncMessage (85%)

### Contract: VectorClock (85%)

### Contract: Plugin (85%)

### Contract: PluginContext (85%)

### LocalSummarizer (88%)
```
LocalSummarizer
```
- **Module:** signal-app
- *Evidence:* `app/src/ai/summarizer.ts:11` — Exported function signature extracted by static analysis. Side effects detected: none.

### SignalApp (88%)
```
SignalApp
```
- **Side effects:** database
- **Module:** signal-app
- *Evidence:* `app/src/core/app.ts:19` — Exported function signature extracted by static analysis. Side effects detected: database.

### GraphBuilder (88%)
```
GraphBuilder
```
- **Module:** signal-app
- *Evidence:* `app/src/graph/builder.ts:19` — Exported function signature extracted by static analysis. Side effects detected: none.

### ExportPlugin (88%)
```
ExportPlugin
```
- **Module:** signal-app
- *Evidence:* `app/src/plugins/export.ts:7` — Exported function signature extracted by static analysis. Side effects detected: none.

### PluginHost (88%)
```
PluginHost
```
- **Module:** signal-app
- *Evidence:* `app/src/plugins/host.ts:20` — Exported function signature extracted by static analysis. Side effects detected: none.

### LocalSummarizer.summarize (95%)
```
LocalSummarizer.summarize(document: Document): Promise<string>
```
- **Module:** signal-app
- *Evidence:* `app/src/ai/summarizer.ts:18` — Exported function signature extracted by static analysis. Side effects detected: none.

### SignalApp.isRunning (95%)
```
SignalApp.isRunning(): boolean
```
- **Module:** signal-app
- *Evidence:* `app/src/core/app.ts:73` — Exported function signature extracted by static analysis. Side effects detected: none.

### createDocument (95%)
```
createDocument(store: DocumentStore, title: string, content: string, tags: string[]): Document
```
- **Module:** signal-app
- *Evidence:* `app/src/editor/operations.ts:14` — Exported function signature extracted by static analysis. Side effects detected: none.

### updateDocument (95%)
```
updateDocument(store: DocumentStore, id: string, changes: DocumentChange): Document | undefined
```
- **Module:** signal-app
- *Evidence:* `app/src/editor/operations.ts:24` — Exported function signature extracted by static analysis. Side effects detected: none.

### linkDocuments (95%)
```
linkDocuments(store: DocumentStore, sourceId: string, targetId: string, kind: LinkKind): boolean
```
- **Module:** signal-app
- *Evidence:* `app/src/editor/operations.ts:32` — Exported function signature extracted by static analysis. Side effects detected: none.

### deleteDocument (95%)
```
deleteDocument(store: DocumentStore, id: string): boolean
```
- **Module:** signal-app
- *Evidence:* `app/src/editor/operations.ts:42` — Exported function signature extracted by static analysis. Side effects detected: none.

### GraphBuilder.buildGraph (95%)
```
GraphBuilder.buildGraph(): AdjacencyList
```
- **Module:** signal-app
- *Evidence:* `app/src/graph/builder.ts:22` — Exported function signature extracted by static analysis. Side effects detected: none.

_…and 3 more contracts_

## Invariants

- **guard: Guard clause (null/undefined check)** (65%)
  Detected 1 occurrence(s) of guard pattern across 1 file(s) in module 'signal-app'. Example: "if (!existing) return undefined;"
  - evidence: `app/src/storage/store.ts:46`
