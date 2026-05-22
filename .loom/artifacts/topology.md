# signal — Architectural Topology
> Generated 2026-05-22 · Graph bf558c90

44 nodes · 0 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_0f3298["signal-app"]
  signal_runner_3511a4["signal-runner"]
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
  app_31b8a1("app ·75%")
  runner_57841d("runner ·75%")
  ExperimentRunner_52f5c1("ExperimentRunner")
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
  Summarizer_681fb1[["Summarizer ·68%"]]
  LocalSummarizer_9500ba[["LocalSummarizer ·68%"]]
  AppConfig_4c6c88[["AppConfig ·68%"]]
  SignalApp_8a6325[["SignalApp ·68%"]]
  GraphBuilder_32958b[["GraphBuilder ·68%"]]
  ExportPlugin_2d7827[["ExportPlugin ·68%"]]
  PluginHost_818559[["PluginHost ·68%"]]
  SearchPlugin_45d93b[["SearchPlugin ·68%"]]
  StorageEventType_2dc5e1[["StorageEventType ·68%"]]
  StorageEventCreated_35779c[["StorageEventCreated ·68%"]]
  StorageEventUpdated_6fb7ef[["StorageEventUpdated ·68%"]]
  StorageEventDeleted_7edc85[["StorageEventDeleted ·68%"]]
  StorageEventLinked_3ce65d[["StorageEventLinked ·68%"]]

  %% relationships

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_0f3298,signal_runner_3511a4 moduleStyle
  class CoreTypes_6a8434,SignalApp_76adff,DocumentStore_a47ce2,StorageEventBus_812d79,EditorOperations_b93e48,GraphBuilder_227f2d,PluginHost_9a372e,ExportPlugin_61138f,SearchPlugin_783151,SyncEngine_3e1fcd,SyncProtocol_ff1d82,LocalSummarizer_bbc114,UIRenderer_ba1179,app_31b8a1,runner_57841d,ExperimentRunner_52f5c1 serviceStyle
  class Document_6cf1f8,DocumentLink_2c9b80,LinkKind_ddac64,SearchQuery_ede4bb,SearchResult_a7fa97,DocumentChange_d37604,GraphNode_30298f,AdjacencyList_7d7655,StorageEvent_0617fe,SyncMessage_2b7535,VectorClock_27ec07,Plugin_146a63,PluginContext_055dc6,Summarizer_681fb1,LocalSummarizer_9500ba,AppConfig_4c6c88,SignalApp_8a6325,GraphBuilder_32958b,ExportPlugin_2d7827,PluginHost_818559,SearchPlugin_45d93b,StorageEventType_2dc5e1,StorageEventCreated_35779c,StorageEventUpdated_6fb7ef,StorageEventDeleted_7edc85,StorageEventLinked_3ce65d entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 0 | 0 |
| signal-runner | module | 0 | 0 | 0 |
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
| app | service | 0 | 0 | 0 |
| runner | service | 0 | 0 | 0 |
| ExperimentRunner | service | 0 | 0 | 0 |
| Document | entity | 0 | 0 | 0 |
| DocumentLink | entity | 0 | 0 | 0 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom weave` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
