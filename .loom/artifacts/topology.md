# signal — Architectural Topology
> Generated 2026-05-28 · Graph 8c8b8e4e

85 nodes · 48 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_f0e748["signal-app"]
  %% services
  DeprecatedDocumentStore_a56d38("DeprecatedDocumentStore")
  FileSnapshotStore_50fa4a("FileSnapshotStore")
  SnapshotStore_155c4c("SnapshotStore")
  DocumentSnapshotService_94736d("DocumentSnapshotService")
  DiskDocumentSnapshotStore_9e3d14("DiskDocumentSnapshotStore")
  DocumentStore_4cfa4a("DocumentStore")
  SyncEngine_f4ae37("SyncEngine")
  SyncManager_4d968f("SyncManager")
  DeprecatedDocumentStore_c80777("DeprecatedDocumentStore")
  FileSnapshotStore_43f2a4("FileSnapshotStore")
  SnapshotStore_f0229c("SnapshotStore")
  DocumentSnapshotService_5b75fa("DocumentSnapshotService")
  DiskDocumentSnapshotStore_29b397("DiskDocumentSnapshotStore")
  DocumentStore_5e4462("DocumentStore")
  SyncEngine_2e62cb("SyncEngine")
  SyncManager_442475("SyncManager")
  app_d915b7("app")
  %% entitys
  LocalSummarizer_09b727[["LocalSummarizer"]]
  PeerPresence_c6c9f9[["PeerPresence"]]
  PresenceTracker_a46939[["PresenceTracker"]]
  AppConfig_b22c6c[["AppConfig"]]
  SignalApp_54528b[["SignalApp"]]
  Document_0d03cf[["Document"]]
  DeprecatedDocumentChange_6de131[["DeprecatedDocumentChange"]]
  DocumentSnapshot_21ee77[["DocumentSnapshot"]]
  DocumentLink_9bc575[["DocumentLink"]]
  LinkKind_727c57[["LinkKind"]]
  SearchQuery_ea3031[["SearchQuery"]]
  SearchResult_e4013a[["SearchResult"]]
  SearchResultSnapshot_5bb302[["SearchResultSnapshot"]]
  DocumentChange_158fb8[["DocumentChange"]]
  SearchHit_614e52[["SearchHit"]]
  InvertedIndexSearchHit_014a83[["InvertedIndexSearchHit"]]
  IndexStats_1c14d1[["IndexStats"]]
  Summarizer_4f4a23[["Summarizer"]]
  GraphNode_83d82c[["GraphNode"]]
  AdjacencyList_6a4cda[["AdjacencyList"]]
  GraphAdjacencyList_f6be24[["GraphAdjacencyList"]]
  GraphBuilder_e80dfa[["GraphBuilder"]]
  Indexer_be9b71[["Indexer"]]
  WorkerPool_c10321[["WorkerPool"]]
  InvertedIndex_2c6b96[["InvertedIndex"]]
  ExportPlugin_81ae6d[["ExportPlugin"]]
  Plugin_4fe137[["Plugin"]]
  PluginContext_088971[["PluginContext"]]
  PluginHost_66dea5[["PluginHost"]]
  SearchPlugin_11ba01[["SearchPlugin"]]
  StorageEventType_dcc798[["StorageEventType"]]
  StorageEventCreated_bac376[["StorageEventCreated"]]
  StorageEventUpdated_6e3969[["StorageEventUpdated"]]
  StorageEventDeleted_18955e[["StorageEventDeleted"]]
  StorageEventLinked_163d9f[["StorageEventLinked"]]
  StorageEvent_78c6ea[["StorageEvent"]]
  DocumentValidatorAsync_39d79d[["DocumentValidatorAsync"]]
  DocumentValidatorSync_b6f76a[["DocumentValidatorSync"]]
  StorageEventBusContract_667ac6[["StorageEventBusContract"]]
  StorageEventBus_398dc1[["StorageEventBus"]]
  DocumentSnapshotServiceOptions_d37e33[["DocumentSnapshotServiceOpti…"]]
  ConflictCandidate_4f0410[["ConflictCandidate"]]
  ConflictCandidateRecord_3e144a[["ConflictCandidateRecord"]]
  TransportSend_971170[["TransportSend"]]
  SyncManagerOptions_fc1c99[["SyncManagerOptions"]]
  OfflineEntry_c24a7e[["OfflineEntry"]]
  OfflineSyncQueueOptions_1af812[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_8c1289[["OfflineSyncQueue"]]
  SyncState_99c9c5[["SyncState"]]
  ConflictStrategy_c3e1e9[["ConflictStrategy"]]
  PeerInfo_e0db8a[["PeerInfo"]]
  SyncAck_dc0d28[["SyncAck"]]
  ConflictRecord_587ca4[["ConflictRecord"]]
  VectorClock_740dc2[["VectorClock"]]
  SyncMessage_d28f49[["SyncMessage"]]
  QueueEntry_1b8ad6[["QueueEntry"]]
  SyncQueueOptions_c74393[["SyncQueueOptions"]]
  SyncQueue_c5d093[["SyncQueue"]]
  SyncSessionState_f6829a[["SyncSessionState"]]
  SyncSessionEvent_49cfa4[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_7bd484[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_596c90[["SyncSessionTracker"]]
  PeerSession_4231e6[["PeerSession"]]
  TelemetryEvent_71286e[["TelemetryEvent"]]
  DocumentVersion_c2d685[["DocumentVersion"]]
  VersionDiff_5fc7e0[["VersionDiff"]]
  VersionHistory_8fe19b[["VersionHistory"]]

  %% relationships
  PresenceTracker_a46939 -->|"imports"| PluginHost_66dea5
  SignalApp_54528b -->|"imports"| DocumentStore_5e4462
  SignalApp_54528b -->|"imports"| StorageEventBus_398dc1
  SignalApp_54528b -->|"imports"| GraphBuilder_e80dfa
  SignalApp_54528b -->|"imports"| Indexer_be9b71
  SignalApp_54528b -->|"imports"| PluginHost_66dea5
  SignalApp_54528b -->|"imports"| SyncEngine_2e62cb
  SignalApp_54528b -->|"imports"| PresenceTracker_a46939
  Indexer_be9b71 -->|"imports"| WorkerPool_c10321
  ExportPlugin_81ae6d -->|"imports"| PluginHost_66dea5
  PluginHost_66dea5 -->|"imports"| StorageEventBus_398dc1
  SearchPlugin_11ba01 -->|"imports"| PluginHost_66dea5
  FileSnapshotStore_43f2a4 -->|"imports"| DocumentSnapshotService_5b75fa
  DocumentStore_5e4462 -->|"imports"| StorageEventBus_398dc1
  SyncEngine_2e62cb -->|"imports"| StorageEventBus_398dc1
  SyncManager_442475 -->|"imports"| DocumentStore_5e4462
  SyncManager_442475 -->|"imports"| StorageEventBus_398dc1
  SyncManager_442475 -->|"imports"| SyncEngine_2e62cb
  SyncManager_442475 -->|"imports"| SyncQueue_c5d093
  SyncManager_442475 -->|"imports"| PeerSession_4231e6
  signal_app_f0e748 --o|"owns"| FileSnapshotStore_50fa4a
  signal_app_f0e748 --o|"owns"| DocumentSnapshotService_94736d
  signal_app_f0e748 --o|"owns"| DiskDocumentSnapshotStore_9e3d14
  signal_app_f0e748 --o|"owns"| DocumentStore_4cfa4a
  signal_app_f0e748 --o|"owns"| SyncEngine_f4ae37
  signal_app_f0e748 --o|"owns"| SyncManager_4d968f
  signal_app_f0e748 --o|"owns"| FileSnapshotStore_43f2a4
  signal_app_f0e748 --o|"owns"| DocumentSnapshotService_5b75fa
  signal_app_f0e748 --o|"owns"| DiskDocumentSnapshotStore_29b397
  signal_app_f0e748 --o|"owns"| DocumentStore_5e4462
  signal_app_f0e748 --o|"owns"| SyncEngine_2e62cb
  signal_app_f0e748 --o|"owns"| SyncManager_442475
  signal_app_f0e748 --o|"owns"| LocalSummarizer_09b727
  signal_app_f0e748 --o|"owns"| PresenceTracker_a46939
  signal_app_f0e748 --o|"owns"| SignalApp_54528b
  signal_app_f0e748 --o|"owns"| GraphBuilder_e80dfa
  signal_app_f0e748 --o|"owns"| Indexer_be9b71
  signal_app_f0e748 --o|"owns"| WorkerPool_c10321
  signal_app_f0e748 --o|"owns"| InvertedIndex_2c6b96
  signal_app_f0e748 --o|"owns"| ExportPlugin_81ae6d
  signal_app_f0e748 --o|"owns"| PluginHost_66dea5
  signal_app_f0e748 --o|"owns"| SearchPlugin_11ba01
  signal_app_f0e748 --o|"owns"| StorageEventBus_398dc1
  signal_app_f0e748 --o|"owns"| OfflineSyncQueue_8c1289
  signal_app_f0e748 --o|"owns"| SyncQueue_c5d093
  signal_app_f0e748 --o|"owns"| SyncSessionTracker_596c90
  signal_app_f0e748 --o|"owns"| PeerSession_4231e6
  signal_app_f0e748 --o|"owns"| VersionHistory_8fe19b

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_f0e748 moduleStyle
  class DeprecatedDocumentStore_a56d38,FileSnapshotStore_50fa4a,SnapshotStore_155c4c,DocumentSnapshotService_94736d,DiskDocumentSnapshotStore_9e3d14,DocumentStore_4cfa4a,SyncEngine_f4ae37,SyncManager_4d968f,DeprecatedDocumentStore_c80777,FileSnapshotStore_43f2a4,SnapshotStore_f0229c,DocumentSnapshotService_5b75fa,DiskDocumentSnapshotStore_29b397,DocumentStore_5e4462,SyncEngine_2e62cb,SyncManager_442475,app_d915b7 serviceStyle
  class LocalSummarizer_09b727,PeerPresence_c6c9f9,PresenceTracker_a46939,AppConfig_b22c6c,SignalApp_54528b,Document_0d03cf,DeprecatedDocumentChange_6de131,DocumentSnapshot_21ee77,DocumentLink_9bc575,LinkKind_727c57,SearchQuery_ea3031,SearchResult_e4013a,SearchResultSnapshot_5bb302,DocumentChange_158fb8,SearchHit_614e52,InvertedIndexSearchHit_014a83,IndexStats_1c14d1,Summarizer_4f4a23,GraphNode_83d82c,AdjacencyList_6a4cda,GraphAdjacencyList_f6be24,GraphBuilder_e80dfa,Indexer_be9b71,WorkerPool_c10321,InvertedIndex_2c6b96,ExportPlugin_81ae6d,Plugin_4fe137,PluginContext_088971,PluginHost_66dea5,SearchPlugin_11ba01,StorageEventType_dcc798,StorageEventCreated_bac376,StorageEventUpdated_6e3969,StorageEventDeleted_18955e,StorageEventLinked_163d9f,StorageEvent_78c6ea,DocumentValidatorAsync_39d79d,DocumentValidatorSync_b6f76a,StorageEventBusContract_667ac6,StorageEventBus_398dc1,DocumentSnapshotServiceOptions_d37e33,ConflictCandidate_4f0410,ConflictCandidateRecord_3e144a,TransportSend_971170,SyncManagerOptions_fc1c99,OfflineEntry_c24a7e,OfflineSyncQueueOptions_1af812,OfflineSyncQueue_8c1289,SyncState_99c9c5,ConflictStrategy_c3e1e9,PeerInfo_e0db8a,SyncAck_dc0d28,ConflictRecord_587ca4,VectorClock_740dc2,SyncMessage_d28f49,QueueEntry_1b8ad6,SyncQueueOptions_c74393,SyncQueue_c5d093,SyncSessionState_f6829a,SyncSessionEvent_49cfa4,SyncSessionTrackerOptions_7bd484,SyncSessionTracker_596c90,PeerSession_4231e6,TelemetryEvent_71286e,DocumentVersion_c2d685,VersionDiff_5fc7e0,VersionHistory_8fe19b entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 28 | 28 |
| SignalApp | entity | 1 | 7 | 8 |
| SyncManager | service | 1 | 5 | 6 |
| PluginHost | entity | 5 | 1 | 6 |
| StorageEventBus | entity | 6 | 0 | 6 |
| DocumentStore | service | 3 | 1 | 4 |
| SyncEngine | service | 3 | 1 | 4 |
| PresenceTracker | entity | 2 | 1 | 3 |
| Indexer | entity | 2 | 1 | 3 |
| FileSnapshotStore | service | 1 | 1 | 2 |
| DocumentSnapshotService | service | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| WorkerPool | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| FileSnapshotStore | service | 1 | 0 | 1 |
| DocumentSnapshotService | service | 1 | 0 | 1 |
| DiskDocumentSnapshotStore | service | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
