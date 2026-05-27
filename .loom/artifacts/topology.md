# signal — Architectural Topology
> Generated 2026-05-27 · Graph 82bd076e

87 nodes · 45 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_719878["signal-app"]
  %% services
  DocumentStore_fb6a2a("DocumentStore")
  SyncEngine_7a69a2("SyncEngine")
  DeprecatedDocumentStore_5dc194("DeprecatedDocumentStore")
  ClockProvider_bc83d5("ClockProvider")
  SnapshotStore_1c185c("SnapshotStore")
  DocumentSnapshotService_a89f19("DocumentSnapshotService")
  SyncManager_e8457a("SyncManager")
  DocumentStore_2c062c("DocumentStore")
  SyncEngine_c512fa("SyncEngine")
  DeprecatedDocumentStore_6bd37f("DeprecatedDocumentStore")
  ClockProvider_d7dc6c("ClockProvider")
  SnapshotStore_f1b869("SnapshotStore")
  DocumentSnapshotService_676e64("DocumentSnapshotService")
  SyncManager_c9707b("SyncManager")
  app_8edb22("app")
  %% entitys
  Summarizer_4294db[["Summarizer"]]
  LocalSummarizer_4e2b17[["LocalSummarizer"]]
  RemoteSummarizer_d105e2[["RemoteSummarizer"]]
  DocumentReader_91935d[["DocumentReader"]]
  PresenceStatus_d0da38[["PresenceStatus"]]
  PeerPresence_14fc0d[["PeerPresence"]]
  PresenceTracker_1e9d0b[["PresenceTracker"]]
  AppConfig_0318ac[["AppConfig"]]
  SignalApp_ca5a00[["SignalApp"]]
  Document_e210c3[["Document"]]
  DocumentSnapshot_0fbfdb[["DocumentSnapshot"]]
  DocumentLink_6690ff[["DocumentLink"]]
  LinkKind_da7a42[["LinkKind"]]
  SearchQuery_1c5afb[["SearchQuery"]]
  SearchResult_a8684b[["SearchResult"]]
  SearchResultSnapshot_49a595[["SearchResultSnapshot"]]
  DocumentChange_a268f7[["DocumentChange"]]
  DeprecatedDocumentChange_c40766[["DeprecatedDocumentChange"]]
  SearchHit_8fc37b[["SearchHit"]]
  InvertedIndexSearchHit_50f387[["InvertedIndexSearchHit"]]
  IndexStats_7d26b6[["IndexStats"]]
  InvertedIndex_84389a[["InvertedIndex"]]
  GraphNode_97058e[["GraphNode"]]
  AdjacencyList_745e39[["AdjacencyList"]]
  GraphAdjacencyList_c9273f[["GraphAdjacencyList"]]
  GraphBuilder_ed778e[["GraphBuilder"]]
  IndexerContract_df0275[["IndexerContract"]]
  Indexer_919444[["Indexer"]]
  IndexWorker_203210[["IndexWorker"]]
  WorkerPoolOptions_8045af[["WorkerPoolOptions"]]
  WorkerPool_be4261[["WorkerPool"]]
  ExportPlugin_e4c4ca[["ExportPlugin"]]
  Plugin_28811c[["Plugin"]]
  PluginContext_a5fb57[["PluginContext"]]
  PluginHost_0a75eb[["PluginHost"]]
  SearchPlugin_001dee[["SearchPlugin"]]
  StorageEventType_9e746e[["StorageEventType"]]
  StorageEventCreated_609379[["StorageEventCreated"]]
  StorageEventUpdated_c94911[["StorageEventUpdated"]]
  StorageEventDeleted_0f10fd[["StorageEventDeleted"]]
  StorageEventLinked_3f9a04[["StorageEventLinked"]]
  StorageEvent_255655[["StorageEvent"]]
  StorageEventBusContract_b07668[["StorageEventBusContract"]]
  StorageEventBus_b477ce[["StorageEventBus"]]
  DocumentSnapshotServiceOptions_58f91e[["DocumentSnapshotServiceOpti…"]]
  ConflictCandidate_2b2663[["ConflictCandidate"]]
  ConflictResolution_b438b5[["ConflictResolution"]]
  ConflictCandidateRecord_d73bdc[["ConflictCandidateRecord"]]
  TransportSend_8bb8f1[["TransportSend"]]
  SyncManagerOptions_636585[["SyncManagerOptions"]]
  OfflineEntry_9332a9[["OfflineEntry"]]
  OfflineSyncQueueOptions_cf5a01[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_21e678[["OfflineSyncQueue"]]
  SyncState_ceeb00[["SyncState"]]
  ConflictStrategy_d42ad0[["ConflictStrategy"]]
  PeerInfo_95613c[["PeerInfo"]]
  SyncAck_376fc3[["SyncAck"]]
  ConflictRecord_a083d8[["ConflictRecord"]]
  VectorClock_9e787b[["VectorClock"]]
  SyncMessage_9e76aa[["SyncMessage"]]
  QueueEntry_df105d[["QueueEntry"]]
  SyncQueueOptions_16deef[["SyncQueueOptions"]]
  SyncQueue_7dfff5[["SyncQueue"]]
  SyncSessionState_ad330b[["SyncSessionState"]]
  SyncSessionEvent_5bc748[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_e45a51[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_6e60b8[["SyncSessionTracker"]]
  PeerSession_6c3e13[["PeerSession"]]
  DocumentVersion_e51496[["DocumentVersion"]]
  VersionDiff_19a940[["VersionDiff"]]
  VersionHistory_7e9f3d[["VersionHistory"]]

  %% relationships
  PresenceTracker_1e9d0b -->|"imports"| PluginHost_0a75eb
  SignalApp_ca5a00 -->|"imports"| DocumentStore_2c062c
  SignalApp_ca5a00 -->|"imports"| StorageEventBus_b477ce
  SignalApp_ca5a00 -->|"imports"| GraphBuilder_ed778e
  SignalApp_ca5a00 -->|"imports"| Indexer_919444
  SignalApp_ca5a00 -->|"imports"| PluginHost_0a75eb
  SignalApp_ca5a00 -->|"imports"| SyncEngine_c512fa
  SignalApp_ca5a00 -->|"imports"| PresenceTracker_1e9d0b
  SignalApp_ca5a00 -->|"imports"| RemoteSummarizer_d105e2
  Indexer_919444 -->|"imports"| WorkerPool_be4261
  ExportPlugin_e4c4ca -->|"imports"| PluginHost_0a75eb
  PluginHost_0a75eb -->|"imports"| StorageEventBus_b477ce
  SearchPlugin_001dee -->|"imports"| PluginHost_0a75eb
  DocumentStore_2c062c -->|"imports"| StorageEventBus_b477ce
  SyncEngine_c512fa -->|"imports"| StorageEventBus_b477ce
  SyncManager_c9707b -->|"imports"| DocumentStore_2c062c
  SyncManager_c9707b -->|"imports"| StorageEventBus_b477ce
  SyncManager_c9707b -->|"imports"| SyncEngine_c512fa
  SyncManager_c9707b -->|"imports"| SyncQueue_7dfff5
  SyncManager_c9707b -->|"imports"| PeerSession_6c3e13
  signal_app_719878 --o|"owns"| DocumentStore_fb6a2a
  signal_app_719878 --o|"owns"| SyncEngine_7a69a2
  signal_app_719878 --o|"owns"| DocumentSnapshotService_a89f19
  signal_app_719878 --o|"owns"| SyncManager_e8457a
  signal_app_719878 --o|"owns"| DocumentStore_2c062c
  signal_app_719878 --o|"owns"| SyncEngine_c512fa
  signal_app_719878 --o|"owns"| DocumentSnapshotService_676e64
  signal_app_719878 --o|"owns"| SyncManager_c9707b
  signal_app_719878 --o|"owns"| LocalSummarizer_4e2b17
  signal_app_719878 --o|"owns"| RemoteSummarizer_d105e2
  signal_app_719878 --o|"owns"| PresenceTracker_1e9d0b
  signal_app_719878 --o|"owns"| SignalApp_ca5a00
  signal_app_719878 --o|"owns"| InvertedIndex_84389a
  signal_app_719878 --o|"owns"| GraphBuilder_ed778e
  signal_app_719878 --o|"owns"| Indexer_919444
  signal_app_719878 --o|"owns"| WorkerPool_be4261
  signal_app_719878 --o|"owns"| ExportPlugin_e4c4ca
  signal_app_719878 --o|"owns"| PluginHost_0a75eb
  signal_app_719878 --o|"owns"| SearchPlugin_001dee
  signal_app_719878 --o|"owns"| StorageEventBus_b477ce
  signal_app_719878 --o|"owns"| OfflineSyncQueue_21e678
  signal_app_719878 --o|"owns"| SyncQueue_7dfff5
  signal_app_719878 --o|"owns"| SyncSessionTracker_6e60b8
  signal_app_719878 --o|"owns"| PeerSession_6c3e13
  signal_app_719878 --o|"owns"| VersionHistory_7e9f3d

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_719878 moduleStyle
  class DocumentStore_fb6a2a,SyncEngine_7a69a2,DeprecatedDocumentStore_5dc194,ClockProvider_bc83d5,SnapshotStore_1c185c,DocumentSnapshotService_a89f19,SyncManager_e8457a,DocumentStore_2c062c,SyncEngine_c512fa,DeprecatedDocumentStore_6bd37f,ClockProvider_d7dc6c,SnapshotStore_f1b869,DocumentSnapshotService_676e64,SyncManager_c9707b,app_8edb22 serviceStyle
  class Summarizer_4294db,LocalSummarizer_4e2b17,RemoteSummarizer_d105e2,DocumentReader_91935d,PresenceStatus_d0da38,PeerPresence_14fc0d,PresenceTracker_1e9d0b,AppConfig_0318ac,SignalApp_ca5a00,Document_e210c3,DocumentSnapshot_0fbfdb,DocumentLink_6690ff,LinkKind_da7a42,SearchQuery_1c5afb,SearchResult_a8684b,SearchResultSnapshot_49a595,DocumentChange_a268f7,DeprecatedDocumentChange_c40766,SearchHit_8fc37b,InvertedIndexSearchHit_50f387,IndexStats_7d26b6,InvertedIndex_84389a,GraphNode_97058e,AdjacencyList_745e39,GraphAdjacencyList_c9273f,GraphBuilder_ed778e,IndexerContract_df0275,Indexer_919444,IndexWorker_203210,WorkerPoolOptions_8045af,WorkerPool_be4261,ExportPlugin_e4c4ca,Plugin_28811c,PluginContext_a5fb57,PluginHost_0a75eb,SearchPlugin_001dee,StorageEventType_9e746e,StorageEventCreated_609379,StorageEventUpdated_c94911,StorageEventDeleted_0f10fd,StorageEventLinked_3f9a04,StorageEvent_255655,StorageEventBusContract_b07668,StorageEventBus_b477ce,DocumentSnapshotServiceOptions_58f91e,ConflictCandidate_2b2663,ConflictResolution_b438b5,ConflictCandidateRecord_d73bdc,TransportSend_8bb8f1,SyncManagerOptions_636585,OfflineEntry_9332a9,OfflineSyncQueueOptions_cf5a01,OfflineSyncQueue_21e678,SyncState_ceeb00,ConflictStrategy_d42ad0,PeerInfo_95613c,SyncAck_376fc3,ConflictRecord_a083d8,VectorClock_9e787b,SyncMessage_9e76aa,QueueEntry_df105d,SyncQueueOptions_16deef,SyncQueue_7dfff5,SyncSessionState_ad330b,SyncSessionEvent_5bc748,SyncSessionTrackerOptions_e45a51,SyncSessionTracker_6e60b8,PeerSession_6c3e13,DocumentVersion_e51496,VersionDiff_19a940,VersionHistory_7e9f3d entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 25 | 25 |
| SignalApp | entity | 1 | 8 | 9 |
| SyncManager | service | 1 | 5 | 6 |
| PluginHost | entity | 5 | 1 | 6 |
| StorageEventBus | entity | 6 | 0 | 6 |
| DocumentStore | service | 3 | 1 | 4 |
| SyncEngine | service | 3 | 1 | 4 |
| PresenceTracker | entity | 2 | 1 | 3 |
| Indexer | entity | 2 | 1 | 3 |
| RemoteSummarizer | entity | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| WorkerPool | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| DocumentStore | service | 1 | 0 | 1 |
| SyncEngine | service | 1 | 0 | 1 |
| DocumentSnapshotService | service | 1 | 0 | 1 |
| SyncManager | service | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
