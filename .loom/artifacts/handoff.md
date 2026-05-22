# Loom Handoff — signal
> Graph v5 · Generated 2026-05-22T14:52:59 UTC

**This document is a cross-session context brief.** Paste it into a new agent session to resume work without re-reading source files.

## Executive Summary

- Signal is a modular application composed of 2 modules (signal-app and signal-runner), 33 contracts, 1 invariant, and 15 services/routes, representing a modest but formally structured system with clear interface boundaries.
- Comprehension health is strong: zero low-confidence nodes, zero active drift events, and zero pending evolution proposals indicate the knowledge graph is current and internally consistent.
- The single registered invariant should be reviewed to confirm it remains accurately scoped as the system grows, since under-specification of invariants is a common gap in early-stage projects.
- Both modules show zero fan-in and zero fan-out coupling metrics, which may reflect incomplete dependency mapping rather than true isolation and warrants verification before handoff is considered complete.
- Recommended next steps: validate that module coupling data is fully captured, confirm the invariant covers all critical system guarantees, and establish a baseline of architectural lineage events so future changes can be traced from this handoff point forward.

## Suggested Next Steps

- Comprehension model looks healthy. Run `loom drift` to check for fresh divergence.

## Comprehension State

| Kind | Count |
|---|---|
| Modules | 2 |
| Contracts | 33 |
| Invariants | 1 |
| Services | 15 |
| Lineage nodes | 0 |

## Modules

### signal-app (95%)
- **Path:** `app`
- **Files:** 13 | **Coupling:** fanIn: 0, fanOut: 0
- **Owners:** LocalSummarizer, LocalSummarizer.summarize, SignalApp, SignalApp.start, SignalApp.shutdown, SignalApp.isRunning, createDocument, updateDocument, linkDocuments, deleteDocument, GraphBuilder, GraphBuilder.buildGraph, GraphBuilder.findClusters, GraphBuilder.findHubs, ExportPlugin, ExportPlugin.activate, ExportPlugin.deactivate, ExportPlugin.exportToMarkdown, PluginHost, PluginHost.register, Summarizer, AppConfig, Document, DocumentLink, LinkKind, SearchQuery, SearchResult, DocumentChange, GraphNode, AdjacencyList, Plugin, PluginContext, StorageEventType, StorageEventCreated, StorageEventUpdated, StorageEventDeleted, StorageEventLinked, StorageEvent, SyncState, VectorClock, SyncMessage
- *Evidence:* `C:\vscode-projects\signal\app` — app/package.json found at app/package.json — explicit module boundary (javascript).
- *Evidence:* `C:\vscode-projects\signal\app\package.json` — package.json defines the module name and version.

### signal-runner (95%)
- **Path:** `runner`
- **Files:** 1 | **Coupling:** fanIn: 0, fanOut: 0
- *Evidence:* `C:\vscode-projects\signal\runner` — runner/package.json found at runner/package.json — explicit module boundary (javascript).
- *Evidence:* `C:\vscode-projects\signal\runner\package.json` — package.json defines the module name and version.

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
