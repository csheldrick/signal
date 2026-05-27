# signal — Architectural Topology
> Generated 2026-05-27 · Graph b16fbb87

85 nodes · 46 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_5a14bb["signal-app"]
  %% services
  SyncEngine_66a8db("SyncEngine")
  ClockProvider_8448cb("ClockProvider")
  SnapshotStore_5d26c5("SnapshotStore")
  DocumentSnapshotService_c1dbc3("DocumentSnapshotService")
  DocumentStore_b520a2("DocumentStore")
  SyncManager_c598d7("SyncManager")
  SyncEngine_bb800a("SyncEngine")
  ClockProvider_5fa5c7("ClockProvider")
  SnapshotStore_d9df48("SnapshotStore")
  DocumentSnapshotService_e5be4b("DocumentSnapshotService")
  DocumentStore_7727d2("DocumentStore")
  SyncManager_17fadb("SyncManager")
  app_760484("app")
  %% entitys
  Summarizer_1d0d5a[["Summarizer"]]
  LocalSummarizer_2a31e5[["LocalSummarizer"]]
  RemoteSummarizer_2278fa[["RemoteSummarizer"]]
  DocumentReader_77e130[["DocumentReader"]]
  PresenceStatus_109589[["PresenceStatus"]]
  PeerPresence_45ec3a[["PeerPresence"]]
  PresenceTracker_93b391[["PresenceTracker"]]
  AppConfig_8f5092[["AppConfig"]]
  SignalApp_0b5e54[["SignalApp"]]
  Document_545476[["Document"]]
  DocumentSnapshot_0cdd6a[["DocumentSnapshot"]]
  DocumentLink_d726ea[["DocumentLink"]]
  LinkKind_f5b5b3[["LinkKind"]]
  SearchQuery_10e848[["SearchQuery"]]
  SearchResult_882294[["SearchResult"]]
  SearchResultSnapshot_27e2ad[["SearchResultSnapshot"]]
  DocumentChange_2dcf65[["DocumentChange"]]
  SearchHit_fca5a6[["SearchHit"]]
  InvertedIndexSearchHit_6ab3df[["InvertedIndexSearchHit"]]
  IndexStats_72e446[["IndexStats"]]
  InvertedIndex_1377ce[["InvertedIndex"]]
  GraphNode_71bfe1[["GraphNode"]]
  AdjacencyList_819ed8[["AdjacencyList"]]
  GraphAdjacencyList_89af50[["GraphAdjacencyList"]]
  GraphBuilder_4c71ca[["GraphBuilder"]]
  IndexerContract_e09fb1[["IndexerContract"]]
  Indexer_c8fe8e[["Indexer"]]
  IndexWorker_001b98[["IndexWorker"]]
  WorkerPoolOptions_df251e[["WorkerPoolOptions"]]
  WorkerPool_744aea[["WorkerPool"]]
  ExportPlugin_cf09f7[["ExportPlugin"]]
  Plugin_28be42[["Plugin"]]
  PluginContext_49e114[["PluginContext"]]
  PluginHost_8256cb[["PluginHost"]]
  SearchPlugin_fd004c[["SearchPlugin"]]
  StorageEventType_96f992[["StorageEventType"]]
  StorageEventCreated_25172e[["StorageEventCreated"]]
  StorageEventUpdated_621f98[["StorageEventUpdated"]]
  StorageEventDeleted_2fdd3c[["StorageEventDeleted"]]
  StorageEventLinked_ae347f[["StorageEventLinked"]]
  StorageEvent_cbf192[["StorageEvent"]]
  StorageEventBusContract_00e3f3[["StorageEventBusContract"]]
  StorageEventBus_0689d3[["StorageEventBus"]]
  DocumentSnapshotServiceOptions_cfbfc5[["DocumentSnapshotServiceOpti…"]]
  ConflictCandidate_960502[["ConflictCandidate"]]
  ConflictResolution_4df994[["ConflictResolution"]]
  ConflictCandidateRecord_167b42[["ConflictCandidateRecord"]]
  TransportSend_feaad6[["TransportSend"]]
  SyncManagerOptions_f4949f[["SyncManagerOptions"]]
  OfflineEntry_e9ae92[["OfflineEntry"]]
  OfflineSyncQueueOptions_c0b022[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_f961a3[["OfflineSyncQueue"]]
  SyncState_45df58[["SyncState"]]
  ConflictStrategy_2bf439[["ConflictStrategy"]]
  PeerInfo_e4ac04[["PeerInfo"]]
  SyncAck_9c93b1[["SyncAck"]]
  ConflictRecord_831548[["ConflictRecord"]]
  VectorClock_6331d6[["VectorClock"]]
  SyncMessage_6fe770[["SyncMessage"]]
  QueueEntry_84605a[["QueueEntry"]]
  SyncQueueOptions_c07580[["SyncQueueOptions"]]
  SyncQueue_2a6e8c[["SyncQueue"]]
  SyncSessionState_21113e[["SyncSessionState"]]
  SyncSessionEvent_dbe46b[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_b532f7[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_dd1fb6[["SyncSessionTracker"]]
  PeerSession_85b183[["PeerSession"]]
  TelemetryEvent_a24e2e[["TelemetryEvent"]]
  DocumentVersion_440c6a[["DocumentVersion"]]
  VersionDiff_b0a1df[["VersionDiff"]]
  VersionHistory_f56512[["VersionHistory"]]

  %% relationships
  PresenceTracker_93b391 -->|"imports"| PluginHost_8256cb
  SignalApp_0b5e54 -->|"imports"| DocumentStore_7727d2
  SignalApp_0b5e54 -->|"imports"| StorageEventBus_0689d3
  SignalApp_0b5e54 -->|"imports"| GraphBuilder_4c71ca
  SignalApp_0b5e54 -->|"imports"| Indexer_c8fe8e
  SignalApp_0b5e54 -->|"imports"| PluginHost_8256cb
  SignalApp_0b5e54 -->|"imports"| SyncEngine_bb800a
  SignalApp_0b5e54 -->|"imports"| PresenceTracker_93b391
  SignalApp_0b5e54 -->|"imports"| RemoteSummarizer_2278fa
  Indexer_c8fe8e -->|"imports"| WorkerPool_744aea
  ExportPlugin_cf09f7 -->|"imports"| PluginHost_8256cb
  PluginHost_8256cb -->|"imports"| StorageEventBus_0689d3
  SearchPlugin_fd004c -->|"imports"| PluginHost_8256cb
  DocumentStore_7727d2 -->|"imports"| StorageEventBus_0689d3
  SyncEngine_bb800a -->|"imports"| StorageEventBus_0689d3
  SyncManager_17fadb -->|"imports"| DocumentStore_7727d2
  SyncManager_17fadb -->|"imports"| StorageEventBus_0689d3
  SyncManager_17fadb -->|"imports"| SyncEngine_bb800a
  SyncManager_17fadb -->|"imports"| SyncQueue_2a6e8c
  SyncManager_17fadb -->|"imports"| OfflineSyncQueue_f961a3
  SyncManager_17fadb -->|"imports"| PeerSession_85b183
  signal_app_5a14bb --o|"owns"| SyncEngine_66a8db
  signal_app_5a14bb --o|"owns"| DocumentSnapshotService_c1dbc3
  signal_app_5a14bb --o|"owns"| DocumentStore_b520a2
  signal_app_5a14bb --o|"owns"| SyncManager_c598d7
  signal_app_5a14bb --o|"owns"| SyncEngine_bb800a
  signal_app_5a14bb --o|"owns"| DocumentSnapshotService_e5be4b
  signal_app_5a14bb --o|"owns"| DocumentStore_7727d2
  signal_app_5a14bb --o|"owns"| SyncManager_17fadb
  signal_app_5a14bb --o|"owns"| LocalSummarizer_2a31e5
  signal_app_5a14bb --o|"owns"| RemoteSummarizer_2278fa
  signal_app_5a14bb --o|"owns"| PresenceTracker_93b391
  signal_app_5a14bb --o|"owns"| SignalApp_0b5e54
  signal_app_5a14bb --o|"owns"| InvertedIndex_1377ce
  signal_app_5a14bb --o|"owns"| GraphBuilder_4c71ca
  signal_app_5a14bb --o|"owns"| Indexer_c8fe8e
  signal_app_5a14bb --o|"owns"| WorkerPool_744aea
  signal_app_5a14bb --o|"owns"| ExportPlugin_cf09f7
  signal_app_5a14bb --o|"owns"| PluginHost_8256cb
  signal_app_5a14bb --o|"owns"| SearchPlugin_fd004c
  signal_app_5a14bb --o|"owns"| StorageEventBus_0689d3
  signal_app_5a14bb --o|"owns"| OfflineSyncQueue_f961a3
  signal_app_5a14bb --o|"owns"| SyncQueue_2a6e8c
  signal_app_5a14bb --o|"owns"| SyncSessionTracker_dd1fb6
  signal_app_5a14bb --o|"owns"| PeerSession_85b183
  signal_app_5a14bb --o|"owns"| VersionHistory_f56512

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_5a14bb moduleStyle
  class SyncEngine_66a8db,ClockProvider_8448cb,SnapshotStore_5d26c5,DocumentSnapshotService_c1dbc3,DocumentStore_b520a2,SyncManager_c598d7,SyncEngine_bb800a,ClockProvider_5fa5c7,SnapshotStore_d9df48,DocumentSnapshotService_e5be4b,DocumentStore_7727d2,SyncManager_17fadb,app_760484 serviceStyle
  class Summarizer_1d0d5a,LocalSummarizer_2a31e5,RemoteSummarizer_2278fa,DocumentReader_77e130,PresenceStatus_109589,PeerPresence_45ec3a,PresenceTracker_93b391,AppConfig_8f5092,SignalApp_0b5e54,Document_545476,DocumentSnapshot_0cdd6a,DocumentLink_d726ea,LinkKind_f5b5b3,SearchQuery_10e848,SearchResult_882294,SearchResultSnapshot_27e2ad,DocumentChange_2dcf65,SearchHit_fca5a6,InvertedIndexSearchHit_6ab3df,IndexStats_72e446,InvertedIndex_1377ce,GraphNode_71bfe1,AdjacencyList_819ed8,GraphAdjacencyList_89af50,GraphBuilder_4c71ca,IndexerContract_e09fb1,Indexer_c8fe8e,IndexWorker_001b98,WorkerPoolOptions_df251e,WorkerPool_744aea,ExportPlugin_cf09f7,Plugin_28be42,PluginContext_49e114,PluginHost_8256cb,SearchPlugin_fd004c,StorageEventType_96f992,StorageEventCreated_25172e,StorageEventUpdated_621f98,StorageEventDeleted_2fdd3c,StorageEventLinked_ae347f,StorageEvent_cbf192,StorageEventBusContract_00e3f3,StorageEventBus_0689d3,DocumentSnapshotServiceOptions_cfbfc5,ConflictCandidate_960502,ConflictResolution_4df994,ConflictCandidateRecord_167b42,TransportSend_feaad6,SyncManagerOptions_f4949f,OfflineEntry_e9ae92,OfflineSyncQueueOptions_c0b022,OfflineSyncQueue_f961a3,SyncState_45df58,ConflictStrategy_2bf439,PeerInfo_e4ac04,SyncAck_9c93b1,ConflictRecord_831548,VectorClock_6331d6,SyncMessage_6fe770,QueueEntry_84605a,SyncQueueOptions_c07580,SyncQueue_2a6e8c,SyncSessionState_21113e,SyncSessionEvent_dbe46b,SyncSessionTrackerOptions_b532f7,SyncSessionTracker_dd1fb6,PeerSession_85b183,TelemetryEvent_a24e2e,DocumentVersion_440c6a,VersionDiff_b0a1df,VersionHistory_f56512 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 25 | 25 |
| SignalApp | entity | 1 | 8 | 9 |
| SyncManager | service | 1 | 6 | 7 |
| PluginHost | entity | 5 | 1 | 6 |
| StorageEventBus | entity | 6 | 0 | 6 |
| SyncEngine | service | 3 | 1 | 4 |
| DocumentStore | service | 3 | 1 | 4 |
| PresenceTracker | entity | 2 | 1 | 3 |
| Indexer | entity | 2 | 1 | 3 |
| RemoteSummarizer | entity | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| WorkerPool | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| OfflineSyncQueue | entity | 2 | 0 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| SyncEngine | service | 1 | 0 | 1 |
| DocumentSnapshotService | service | 1 | 0 | 1 |
| DocumentStore | service | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
