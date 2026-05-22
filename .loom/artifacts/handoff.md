# Loom Handoff — signal
> Graph v8 · Generated 2026-05-22T17:55:23 UTC

**This document is a cross-session context brief.** Paste it into a new agent session to resume work without re-reading source files.

## Executive Summary

- Signal is a 2-module application composed of signal-app and signal-runner, supported by 40 contracts, 1 invariant, and 24 service routes, representing a moderately sized but well-bounded system ready for active development or handoff.
- Comprehension health is strong: zero low-confidence nodes, zero active drift events, and zero pending evolution proposals indicate the codebase is well-understood and stable at the time of this handoff.
- Both top-level modules show zero fan-in and fan-out coupling, which may reflect accurate isolation or could indicate that inter-module dependency data has not yet been fully mapped and should be verified.
- The single registered invariant warrants explicit review to confirm it is still enforced across all 24 service routes and has not been quietly violated as the contract surface grew to 40 entries.
- Recommended next steps: validate module coupling metrics are complete and not artifacts of incomplete analysis, confirm the lone invariant is tested and visible in CI, and establish a baseline for architectural lineage tracking so future structural decisions are captured from this point forward.

## Suggested Next Steps

- Comprehension model looks healthy. Run `loom drift` to check for fresh divergence.

## Comprehension State

| Kind | Count |
|---|---|
| Modules | 2 |
| Contracts | 40 |
| Invariants | 1 |
| Services | 24 |
| Lineage nodes | 0 |

## Modules

### signal-app (95%)
- **Path:** `app`
- **Files:** 20 | **Coupling:** fanIn: 0, fanOut: 0
- **Owners:** LocalSummarizer, LocalSummarizer.summarize, SignalApp, SignalApp.start, SignalApp.shutdown, SignalApp.isRunning, createDocument, updateDocument, linkDocuments, deleteDocument, GraphBuilder, GraphBuilder.buildGraph, GraphBuilder.findClusters, GraphBuilder.findHubs, ExportPlugin, ExportPlugin.activate, ExportPlugin.deactivate, ExportPlugin.exportToMarkdown, PluginHost, PluginHost.register, Summarizer, AppConfig, Document, DocumentLink, LinkKind, SearchQuery, SearchResult, DocumentChange, GraphNode, AdjacencyList, Plugin, PluginContext, StorageEventType, StorageEventCreated, StorageEventUpdated, StorageEventDeleted, StorageEventLinked, StorageEvent, SyncState, VectorClock, SyncMessage, PresenceTracker, PresenceTracker.join, PresenceTracker.leave, PresenceTracker.getActive, PresenceTracker.getViewers, PresenceTracker.focusDocument, PresenceTracker.summary, PresenceStatus, PeerPresence, IndexStats, SearchHit, DocumentVersion, VersionDiff, ConflictCandidate, ConflictResolution, TransportSend, SyncManagerOptions, ConflictStrategy, PeerInfo, SyncAck, ConflictRecord, QueueEntry, SyncQueueOptions
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

### PresenceTracker.leave (70%)
```
PresenceTracker.leave(peerId: string): void
```
- **Module:** signal-app
- *Evidence:* `app/src/collaboration/presence.ts:48` — Exported function signature extracted by static analysis. Side effects detected: none.

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

### PresenceTracker (88%)
```
PresenceTracker
```
- **Module:** signal-app
- *Evidence:* `app/src/collaboration/presence.ts:29` — Exported function signature extracted by static analysis. Side effects detected: none.

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

_…and 10 more contracts_

## Invariants

- **guard: Guard clause (null/undefined check)** (88%)
  Detected 3 occurrence(s) of guard pattern across 3 file(s) in module 'signal-app'. Example: "if (!doc) return false;"
  - evidence: `app/src/storage/store.ts:46`
  - evidence: `app/src/collaboration/presence.ts:67`
