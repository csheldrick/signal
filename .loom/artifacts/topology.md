# signal — Architectural Topology
> Generated 2026-05-22 · Graph 19516acf

39 nodes · 0 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_4d1b16["signal-app"]
  %% services
  DocumentStore_5f8d4a("DocumentStore")
  StorageEventBus_6c6045("StorageEventBus")
  GraphBuilder_89e2e6("GraphBuilder")
  InvertedIndex_b19661("InvertedIndex")
  SyncEngine_031669("SyncEngine")
  SyncManager_a5fbd4("SyncManager")
  SyncQueue_514f8b("SyncQueue")
  PeerSession_ac5c11("PeerSession")
  ConflictResolver_387473("ConflictResolver")
  PresenceTracker_60e618("PresenceTracker")
  PluginHost_9ccd45("PluginHost")
  SearchPlugin_d53963("SearchPlugin")
  ExportPlugin_e9a4de("ExportPlugin")
  LocalSummarizer_faf6c2("LocalSummarizer")
  VersionHistory_e9147e("VersionHistory")
  EditorOperations_7c322b("EditorOperations")
  UIRenderer_0717d9("UIRenderer")
  SignalApp_9b62bb("SignalApp")
  %% entitys
  Document_ceda6c[["Document"]]
  DocumentLink_887d74[["DocumentLink"]]
  DocumentChange_4eab47[["DocumentChange"]]
  SearchQuery_d91cf2[["SearchQuery"]]
  SearchResult_81fd23[["SearchResult"]]
  SearchHit_90d11a[["SearchHit"]]
  VectorClock_df3166[["VectorClock"]]
  SyncMessage_f6cba4[["SyncMessage"]]
  SyncAck_49e831[["SyncAck"]]
  PeerInfo_df4df2[["PeerInfo"]]
  ConflictRecord_2729dc[["ConflictRecord"]]
  ConflictCandidate_f77a85[["ConflictCandidate"]]
  ConflictResolution_869050[["ConflictResolution"]]
  StorageEvent_f7f6ab[["StorageEvent"]]
  GraphNode_c1de16[["GraphNode"]]
  AdjacencyList_a86d0e[["AdjacencyList"]]
  IndexStats_3766cb[["IndexStats"]]
  Plugin_335dbc[["Plugin"]]
  PluginContext_f2d446[["PluginContext"]]
  PeerSession_441ea2[["PeerSession"]]

  %% relationships

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_4d1b16 moduleStyle
  class DocumentStore_5f8d4a,StorageEventBus_6c6045,GraphBuilder_89e2e6,InvertedIndex_b19661,SyncEngine_031669,SyncManager_a5fbd4,SyncQueue_514f8b,PeerSession_ac5c11,ConflictResolver_387473,PresenceTracker_60e618,PluginHost_9ccd45,SearchPlugin_d53963,ExportPlugin_e9a4de,LocalSummarizer_faf6c2,VersionHistory_e9147e,EditorOperations_7c322b,UIRenderer_0717d9,SignalApp_9b62bb serviceStyle
  class Document_ceda6c,DocumentLink_887d74,DocumentChange_4eab47,SearchQuery_d91cf2,SearchResult_81fd23,SearchHit_90d11a,VectorClock_df3166,SyncMessage_f6cba4,SyncAck_49e831,PeerInfo_df4df2,ConflictRecord_2729dc,ConflictCandidate_f77a85,ConflictResolution_869050,StorageEvent_f7f6ab,GraphNode_c1de16,AdjacencyList_a86d0e,IndexStats_3766cb,Plugin_335dbc,PluginContext_f2d446,PeerSession_441ea2 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 0 | 0 |
| DocumentStore | service | 0 | 0 | 0 |
| StorageEventBus | service | 0 | 0 | 0 |
| GraphBuilder | service | 0 | 0 | 0 |
| InvertedIndex | service | 0 | 0 | 0 |
| SyncEngine | service | 0 | 0 | 0 |
| SyncManager | service | 0 | 0 | 0 |
| SyncQueue | service | 0 | 0 | 0 |
| PeerSession | service | 0 | 0 | 0 |
| ConflictResolver | service | 0 | 0 | 0 |
| PresenceTracker | service | 0 | 0 | 0 |
| PluginHost | service | 0 | 0 | 0 |
| SearchPlugin | service | 0 | 0 | 0 |
| ExportPlugin | service | 0 | 0 | 0 |
| LocalSummarizer | service | 0 | 0 | 0 |
| VersionHistory | service | 0 | 0 | 0 |
| EditorOperations | service | 0 | 0 | 0 |
| UIRenderer | service | 0 | 0 | 0 |
| SignalApp | service | 0 | 0 | 0 |
| Document | entity | 0 | 0 | 0 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom weave` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
