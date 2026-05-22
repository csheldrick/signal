# signal — Architectural Topology
> Generated 2026-05-22 · Graph bf558c90

27 nodes · 0 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_0f3298["signal-app"]
  %% services
  CoreTypes_6a8434("CoreTypes")
  SignalApp_76adff("SignalApp")
  DocumentStore_a47ce2("DocumentStore")
  StorageEventBus_812d79("StorageEventBus")
  EditorOperations_b93e48("EditorOperations")
  GraphBuilder_227f2d("GraphBuilder")
  PluginHost_9a372e("PluginHost")
  ExportPlugin_61138f("ExportPlugin")
  SearchPlugin_783151("SearchPlugin")
  SyncEngine_3e1fcd("SyncEngine")
  SyncProtocol_ff1d82("SyncProtocol")
  LocalSummarizer_bbc114("LocalSummarizer")
  UIRenderer_ba1179("UIRenderer")
  %% entitys
  Document_6cf1f8[["Document"]]
  DocumentLink_2c9b80[["DocumentLink"]]
  LinkKind_ddac64[["LinkKind"]]
  SearchQuery_ede4bb[["SearchQuery"]]
  SearchResult_a7fa97[["SearchResult"]]
  DocumentChange_d37604[["DocumentChange"]]
  GraphNode_30298f[["GraphNode"]]
  AdjacencyList_7d7655[["AdjacencyList"]]
  StorageEvent_0617fe[["StorageEvent"]]
  SyncMessage_2b7535[["SyncMessage"]]
  VectorClock_27ec07[["VectorClock"]]
  Plugin_146a63[["Plugin"]]
  PluginContext_055dc6[["PluginContext"]]

  %% relationships

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_0f3298 moduleStyle
  class CoreTypes_6a8434,SignalApp_76adff,DocumentStore_a47ce2,StorageEventBus_812d79,EditorOperations_b93e48,GraphBuilder_227f2d,PluginHost_9a372e,ExportPlugin_61138f,SearchPlugin_783151,SyncEngine_3e1fcd,SyncProtocol_ff1d82,LocalSummarizer_bbc114,UIRenderer_ba1179 serviceStyle
  class Document_6cf1f8,DocumentLink_2c9b80,LinkKind_ddac64,SearchQuery_ede4bb,SearchResult_a7fa97,DocumentChange_d37604,GraphNode_30298f,AdjacencyList_7d7655,StorageEvent_0617fe,SyncMessage_2b7535,VectorClock_27ec07,Plugin_146a63,PluginContext_055dc6 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 0 | 0 |
| CoreTypes | service | 0 | 0 | 0 |
| SignalApp | service | 0 | 0 | 0 |
| DocumentStore | service | 0 | 0 | 0 |
| StorageEventBus | service | 0 | 0 | 0 |
| EditorOperations | service | 0 | 0 | 0 |
| GraphBuilder | service | 0 | 0 | 0 |
| PluginHost | service | 0 | 0 | 0 |
| ExportPlugin | service | 0 | 0 | 0 |
| SearchPlugin | service | 0 | 0 | 0 |
| SyncEngine | service | 0 | 0 | 0 |
| SyncProtocol | service | 0 | 0 | 0 |
| LocalSummarizer | service | 0 | 0 | 0 |
| UIRenderer | service | 0 | 0 | 0 |
| Document | entity | 0 | 0 | 0 |
| DocumentLink | entity | 0 | 0 | 0 |
| LinkKind | entity | 0 | 0 | 0 |
| SearchQuery | entity | 0 | 0 | 0 |
| SearchResult | entity | 0 | 0 | 0 |
| DocumentChange | entity | 0 | 0 | 0 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom weave` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
