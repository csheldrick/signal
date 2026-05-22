# Loom Handoff — signal
> Graph v2 · Generated 2026-05-22T22:00:31 UTC

**This document is a cross-session context brief.** Paste it into a new agent session to resume work without re-reading source files.

## Suggested Next Steps

- Comprehension model looks healthy. Run `loom drift` to check for fresh divergence.

## Comprehension State

| Kind | Count |
|---|---|
| Modules | 1 |
| Contracts | 40 |
| Invariants | 1 |
| Services | 18 |
| Lineage nodes | 1 |

## Modules

### signal-app (95%)
- **Path:** `app`
- **Files:** 20 | **Coupling:** fanIn: 0, fanOut: 0
- **Owners:** LocalSummarizer, LocalSummarizer.summarize, PresenceTracker, PresenceTracker.join, PresenceTracker.leave, PresenceTracker.getActive, PresenceTracker.getViewers, PresenceTracker.focusDocument, PresenceTracker.summary, SignalApp, SignalApp.start, SignalApp.shutdown, SignalApp.isRunning, createDocument, updateDocument, linkDocuments, deleteDocument, GraphBuilder, GraphBuilder.buildGraph, GraphBuilder.findClusters, Summarizer, PresenceStatus, PeerPresence, AppConfig, Document, DocumentLink, LinkKind, SearchQuery, SearchResult, DocumentChange, GraphNode, AdjacencyList, IndexStats, SearchHit, Plugin, PluginContext, StorageEventType, StorageEventCreated, StorageEventUpdated, StorageEventDeleted, StorageEventLinked, StorageEvent, ConflictCandidate, ConflictResolution, TransportSend, SyncManagerOptions, SyncState, ConflictStrategy, PeerInfo, SyncAck, ConflictRecord, VectorClock, SyncMessage, QueueEntry, SyncQueueOptions, DocumentVersion, VersionDiff
- *Evidence:* `C:\vscode-projects\signal\app` — app/package.json found at app/package.json — explicit module boundary (javascript).
- *Evidence:* `C:\vscode-projects\signal\app\package.json` — package.json defines the module name and version.

## Contracts

### PresenceTracker.leave (70%)
```
PresenceTracker.leave(peerId: string): void
```
- **Module:** signal-app
- *Evidence:* `app/src/collaboration/presence.ts:48` — Exported function signature extracted by static analysis. Side effects detected: none.

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

### Contract: Document (85%)

### Contract: DocumentLink (85%)

### Contract: DocumentChange (85%)

### Contract: SearchQuery (85%)

### Contract: SearchResult (85%)

### Contract: SearchHit (85%)

### Contract: VectorClock (85%)

### Contract: SyncMessage (85%)

### Contract: SyncAck (85%)

### Contract: PeerInfo (85%)

### Contract: ConflictRecord (85%)

### Contract: ConflictCandidate (85%)

### Contract: ConflictResolution (85%)

### Contract: StorageEvent (85%)

### Contract: GraphNode (85%)

### Contract: AdjacencyList (85%)

### Contract: IndexStats (85%)

### Contract: Plugin (85%)

### Contract: PluginContext (85%)

### Contract: PeerSession (85%)

### LocalSummarizer (88%)
```
LocalSummarizer
```
- **Module:** signal-app
- *Evidence:* `app/src/ai/summarizer.ts:11` — Exported function signature extracted by static analysis. Side effects detected: none.

### PresenceTracker (88%)
```
PresenceTracker
```
- **Module:** signal-app
- *Evidence:* `app/src/collaboration/presence.ts:29` — Exported function signature extracted by static analysis. Side effects detected: none.

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

### LocalSummarizer.summarize (95%)
```
LocalSummarizer.summarize(document: Document): Promise<string>
```
- **Module:** signal-app
- *Evidence:* `app/src/ai/summarizer.ts:18` — Exported function signature extracted by static analysis. Side effects detected: none.

### PresenceTracker.join (95%)
```
PresenceTracker.join(peerId: string, documentId?: string): PeerPresence
```
- **Module:** signal-app
- *Evidence:* `app/src/collaboration/presence.ts:37` — Exported function signature extracted by static analysis. Side effects detected: none.

### PresenceTracker.getActive (95%)
```
PresenceTracker.getActive(): PeerPresence[]
```
- **Module:** signal-app
- *Evidence:* `app/src/collaboration/presence.ts:55` — Exported function signature extracted by static analysis. Side effects detected: none.

_…and 10 more contracts_

## Invariants

- **guard: Guard clause (null/undefined check)** (88%)
  Detected 3 occurrence(s) of guard pattern across 3 file(s) in module 'signal-app'. Example: "if (!doc) return false;"
  - evidence: `app/src/collaboration/presence.ts:67`
  - evidence: `app/src/indexing/index.ts:39`

## Architectural Lineage

- **[REFACTOR]** [REFACTOR] refactor: update README for clarity, remove runner package, and adjust package.j [`d266672`] · 2026-05-22 by csheldrick
