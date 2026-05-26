# signal — Architectural Topology
> Generated 2026-05-26 · Graph b7d3ad20

70 nodes · 37 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_add003["signal-app"]
  %% services
  DocumentStore_0918ab("DocumentStore")
  SyncEngine_30797f("SyncEngine")
  DeprecatedDocumentStore_b7f170("DeprecatedDocumentStore")
  ClockProvider_54aa07("ClockProvider")
  SyncManager_660b45("SyncManager")
  DocumentStore_f693d4("DocumentStore")
  SyncEngine_cee391("SyncEngine")
  DeprecatedDocumentStore_fddb25("DeprecatedDocumentStore")
  ClockProvider_9f6bf3("ClockProvider")
  SyncManager_d111e5("SyncManager")
  app_df7421("app")
  %% entitys
  Summarizer_553179[["Summarizer"]]
  LocalSummarizer_5ade44[["LocalSummarizer"]]
  RemoteSummarizer_2b7a28[["RemoteSummarizer"]]
  DocumentReader_5719f2[["DocumentReader"]]
  PresenceStatus_b12afd[["PresenceStatus"]]
  PeerPresence_fbf9e8[["PeerPresence"]]
  PresenceTracker_24f23f[["PresenceTracker"]]
  AppConfig_18181c[["AppConfig"]]
  SignalApp_c62fb5[["SignalApp"]]
  Document_d8dcef[["Document"]]
  DocumentSnapshot_7faa2f[["DocumentSnapshot"]]
  DocumentLink_eff8b8[["DocumentLink"]]
  LinkKind_833bfa[["LinkKind"]]
  SearchQuery_2d3734[["SearchQuery"]]
  SearchResult_dc712d[["SearchResult"]]
  SearchResultSnapshot_22d26d[["SearchResultSnapshot"]]
  DocumentChange_d1af6a[["DocumentChange"]]
  DeprecatedDocumentChange_25589d[["DeprecatedDocumentChange"]]
  GraphNode_e2d547[["GraphNode"]]
  AdjacencyList_e15899[["AdjacencyList"]]
  GraphAdjacencyList_865ee7[["GraphAdjacencyList"]]
  GraphBuilder_2cdaa8[["GraphBuilder"]]
  IndexStats_3724ee[["IndexStats"]]
  SearchHit_d7d7c4[["SearchHit"]]
  InvertedIndexSearchHit_4ec1f4[["InvertedIndexSearchHit"]]
  InvertedIndex_73f755[["InvertedIndex"]]
  ExportPlugin_2dd259[["ExportPlugin"]]
  Plugin_7d7ac4[["Plugin"]]
  PluginContext_a62efb[["PluginContext"]]
  PluginHost_9b6c58[["PluginHost"]]
  SearchPlugin_3ffa04[["SearchPlugin"]]
  StorageEventType_7bd8cc[["StorageEventType"]]
  StorageEventCreated_33b5af[["StorageEventCreated"]]
  StorageEventUpdated_61c893[["StorageEventUpdated"]]
  StorageEventDeleted_bce49b[["StorageEventDeleted"]]
  StorageEventLinked_eb1052[["StorageEventLinked"]]
  StorageEvent_86243a[["StorageEvent"]]
  StorageEventBusContract_f91f63[["StorageEventBusContract"]]
  StorageEventBus_52a82d[["StorageEventBus"]]
  ConflictCandidate_544da5[["ConflictCandidate"]]
  ConflictResolution_2f9076[["ConflictResolution"]]
  ConflictCandidateRecord_084713[["ConflictCandidateRecord"]]
  TransportSend_7092c9[["TransportSend"]]
  SyncManagerOptions_8eb13c[["SyncManagerOptions"]]
  SyncState_5447a1[["SyncState"]]
  ConflictStrategy_8b58ee[["ConflictStrategy"]]
  PeerInfo_bd10a0[["PeerInfo"]]
  SyncAck_3de2bc[["SyncAck"]]
  ConflictRecord_c8f950[["ConflictRecord"]]
  VectorClock_edd95f[["VectorClock"]]
  SyncMessage_25a5b0[["SyncMessage"]]
  QueueEntry_5b8094[["QueueEntry"]]
  SyncQueueOptions_c494a3[["SyncQueueOptions"]]
  SyncQueue_cb9a17[["SyncQueue"]]
  PeerSession_34c26b[["PeerSession"]]
  DocumentVersion_b6cef7[["DocumentVersion"]]
  VersionDiff_b82b43[["VersionDiff"]]
  VersionHistory_db4261[["VersionHistory"]]

  %% relationships
  PresenceTracker_24f23f -->|"imports"| PluginHost_9b6c58
  SignalApp_c62fb5 -->|"imports"| DocumentStore_f693d4
  SignalApp_c62fb5 -->|"imports"| StorageEventBus_52a82d
  SignalApp_c62fb5 -->|"imports"| GraphBuilder_2cdaa8
  SignalApp_c62fb5 -->|"imports"| PluginHost_9b6c58
  SignalApp_c62fb5 -->|"imports"| SyncEngine_cee391
  SignalApp_c62fb5 -->|"imports"| PresenceTracker_24f23f
  SignalApp_c62fb5 -->|"imports"| RemoteSummarizer_2b7a28
  ExportPlugin_2dd259 -->|"imports"| PluginHost_9b6c58
  PluginHost_9b6c58 -->|"imports"| StorageEventBus_52a82d
  SearchPlugin_3ffa04 -->|"imports"| PluginHost_9b6c58
  DocumentStore_f693d4 -->|"imports"| StorageEventBus_52a82d
  SyncEngine_cee391 -->|"imports"| StorageEventBus_52a82d
  SyncManager_d111e5 -->|"imports"| DocumentStore_f693d4
  SyncManager_d111e5 -->|"imports"| StorageEventBus_52a82d
  SyncManager_d111e5 -->|"imports"| SyncEngine_cee391
  SyncManager_d111e5 -->|"imports"| SyncQueue_cb9a17
  SyncManager_d111e5 -->|"imports"| PeerSession_34c26b
  signal_app_add003 --o|"owns"| DocumentStore_0918ab
  signal_app_add003 --o|"owns"| SyncEngine_30797f
  signal_app_add003 --o|"owns"| SyncManager_660b45
  signal_app_add003 --o|"owns"| DocumentStore_f693d4
  signal_app_add003 --o|"owns"| SyncEngine_cee391
  signal_app_add003 --o|"owns"| SyncManager_d111e5
  signal_app_add003 --o|"owns"| LocalSummarizer_5ade44
  signal_app_add003 --o|"owns"| RemoteSummarizer_2b7a28
  signal_app_add003 --o|"owns"| PresenceTracker_24f23f
  signal_app_add003 --o|"owns"| SignalApp_c62fb5
  signal_app_add003 --o|"owns"| GraphBuilder_2cdaa8
  signal_app_add003 --o|"owns"| InvertedIndex_73f755
  signal_app_add003 --o|"owns"| ExportPlugin_2dd259
  signal_app_add003 --o|"owns"| PluginHost_9b6c58
  signal_app_add003 --o|"owns"| SearchPlugin_3ffa04
  signal_app_add003 --o|"owns"| StorageEventBus_52a82d
  signal_app_add003 --o|"owns"| SyncQueue_cb9a17
  signal_app_add003 --o|"owns"| PeerSession_34c26b
  signal_app_add003 --o|"owns"| VersionHistory_db4261

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_add003 moduleStyle
  class DocumentStore_0918ab,SyncEngine_30797f,DeprecatedDocumentStore_b7f170,ClockProvider_54aa07,SyncManager_660b45,DocumentStore_f693d4,SyncEngine_cee391,DeprecatedDocumentStore_fddb25,ClockProvider_9f6bf3,SyncManager_d111e5,app_df7421 serviceStyle
  class Summarizer_553179,LocalSummarizer_5ade44,RemoteSummarizer_2b7a28,DocumentReader_5719f2,PresenceStatus_b12afd,PeerPresence_fbf9e8,PresenceTracker_24f23f,AppConfig_18181c,SignalApp_c62fb5,Document_d8dcef,DocumentSnapshot_7faa2f,DocumentLink_eff8b8,LinkKind_833bfa,SearchQuery_2d3734,SearchResult_dc712d,SearchResultSnapshot_22d26d,DocumentChange_d1af6a,DeprecatedDocumentChange_25589d,GraphNode_e2d547,AdjacencyList_e15899,GraphAdjacencyList_865ee7,GraphBuilder_2cdaa8,IndexStats_3724ee,SearchHit_d7d7c4,InvertedIndexSearchHit_4ec1f4,InvertedIndex_73f755,ExportPlugin_2dd259,Plugin_7d7ac4,PluginContext_a62efb,PluginHost_9b6c58,SearchPlugin_3ffa04,StorageEventType_7bd8cc,StorageEventCreated_33b5af,StorageEventUpdated_61c893,StorageEventDeleted_bce49b,StorageEventLinked_eb1052,StorageEvent_86243a,StorageEventBusContract_f91f63,StorageEventBus_52a82d,ConflictCandidate_544da5,ConflictResolution_2f9076,ConflictCandidateRecord_084713,TransportSend_7092c9,SyncManagerOptions_8eb13c,SyncState_5447a1,ConflictStrategy_8b58ee,PeerInfo_bd10a0,SyncAck_3de2bc,ConflictRecord_c8f950,VectorClock_edd95f,SyncMessage_25a5b0,QueueEntry_5b8094,SyncQueueOptions_c494a3,SyncQueue_cb9a17,PeerSession_34c26b,DocumentVersion_b6cef7,VersionDiff_b82b43,VersionHistory_db4261 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 19 | 19 |
| SignalApp | entity | 1 | 7 | 8 |
| SyncManager | service | 1 | 5 | 6 |
| PluginHost | entity | 5 | 1 | 6 |
| StorageEventBus | entity | 6 | 0 | 6 |
| DocumentStore | service | 3 | 1 | 4 |
| SyncEngine | service | 3 | 1 | 4 |
| PresenceTracker | entity | 2 | 1 | 3 |
| RemoteSummarizer | entity | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| DocumentStore | service | 1 | 0 | 1 |
| SyncEngine | service | 1 | 0 | 1 |
| SyncManager | service | 1 | 0 | 1 |
| LocalSummarizer | entity | 1 | 0 | 1 |
| InvertedIndex | entity | 1 | 0 | 1 |
| VersionHistory | entity | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
