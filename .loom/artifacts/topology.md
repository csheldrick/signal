# signal — Architectural Topology
> Generated 2026-05-28 · Graph d7ac495c

85 nodes · 46 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_26e3fd["signal-app"]
  %% services
  SyncEngine_43a466("SyncEngine")
  ClockProvider_2fbc34("ClockProvider")
  SnapshotStore_5f48c1("SnapshotStore")
  DocumentSnapshotService_4897a5("DocumentSnapshotService")
  DocumentStore_8c77eb("DocumentStore")
  SyncManager_d977bb("SyncManager")
  SyncEngine_9f454e("SyncEngine")
  ClockProvider_fb2a9a("ClockProvider")
  SnapshotStore_9f2459("SnapshotStore")
  DocumentSnapshotService_c177d1("DocumentSnapshotService")
  DocumentStore_c6bb2d("DocumentStore")
  SyncManager_e60fce("SyncManager")
  app_69c460("app")
  %% entitys
  Summarizer_af52c4[["Summarizer"]]
  LocalSummarizer_448cc4[["LocalSummarizer"]]
  RemoteSummarizer_73c0ca[["RemoteSummarizer"]]
  DocumentReader_e8a789[["DocumentReader"]]
  PresenceStatus_ea6aa8[["PresenceStatus"]]
  PeerPresence_b92a22[["PeerPresence"]]
  PresenceTracker_651408[["PresenceTracker"]]
  AppConfig_049e29[["AppConfig"]]
  SignalApp_cfe515[["SignalApp"]]
  Document_40ef3a[["Document"]]
  DocumentSnapshot_bbae5e[["DocumentSnapshot"]]
  DocumentLink_906817[["DocumentLink"]]
  LinkKind_f0216b[["LinkKind"]]
  SearchQuery_9edb70[["SearchQuery"]]
  SearchResult_fa6572[["SearchResult"]]
  SearchResultSnapshot_f4dfa5[["SearchResultSnapshot"]]
  DocumentChange_8dfa78[["DocumentChange"]]
  SearchHit_6fef0e[["SearchHit"]]
  InvertedIndexSearchHit_d43596[["InvertedIndexSearchHit"]]
  IndexStats_d9260b[["IndexStats"]]
  InvertedIndex_835910[["InvertedIndex"]]
  GraphNode_229e74[["GraphNode"]]
  AdjacencyList_16d987[["AdjacencyList"]]
  GraphAdjacencyList_cf2aa3[["GraphAdjacencyList"]]
  GraphBuilder_0d1a47[["GraphBuilder"]]
  IndexerContract_a902f2[["IndexerContract"]]
  Indexer_04e4ce[["Indexer"]]
  IndexWorker_b241b2[["IndexWorker"]]
  WorkerPoolOptions_573783[["WorkerPoolOptions"]]
  WorkerPool_b6cba9[["WorkerPool"]]
  ExportPlugin_fe3c71[["ExportPlugin"]]
  Plugin_de5dea[["Plugin"]]
  PluginContext_028ad6[["PluginContext"]]
  PluginHost_bf20fc[["PluginHost"]]
  SearchPlugin_3fdc98[["SearchPlugin"]]
  StorageEventType_f82e76[["StorageEventType"]]
  StorageEventCreated_5c65d5[["StorageEventCreated"]]
  StorageEventUpdated_70e165[["StorageEventUpdated"]]
  StorageEventDeleted_95eda0[["StorageEventDeleted"]]
  StorageEventLinked_684fd3[["StorageEventLinked"]]
  StorageEvent_d121be[["StorageEvent"]]
  StorageEventBusContract_9e2bd7[["StorageEventBusContract"]]
  StorageEventBus_856c82[["StorageEventBus"]]
  DocumentSnapshotServiceOptions_d00e9d[["DocumentSnapshotServiceOpti…"]]
  ConflictCandidate_d0ef77[["ConflictCandidate"]]
  ConflictResolution_c61c47[["ConflictResolution"]]
  ConflictCandidateRecord_8484d2[["ConflictCandidateRecord"]]
  TransportSend_bbaebb[["TransportSend"]]
  SyncManagerOptions_7cbab3[["SyncManagerOptions"]]
  OfflineEntry_e40cd9[["OfflineEntry"]]
  OfflineSyncQueueOptions_0b18b0[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_212eeb[["OfflineSyncQueue"]]
  SyncState_b7c168[["SyncState"]]
  ConflictStrategy_f4737c[["ConflictStrategy"]]
  PeerInfo_844ead[["PeerInfo"]]
  SyncAck_2b552f[["SyncAck"]]
  ConflictRecord_647f1e[["ConflictRecord"]]
  VectorClock_1d74a3[["VectorClock"]]
  SyncMessage_60811b[["SyncMessage"]]
  QueueEntry_65b5a3[["QueueEntry"]]
  SyncQueueOptions_20d1a8[["SyncQueueOptions"]]
  SyncQueue_1c332d[["SyncQueue"]]
  SyncSessionState_d406de[["SyncSessionState"]]
  SyncSessionEvent_7ff498[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_4108e8[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_123c43[["SyncSessionTracker"]]
  PeerSession_54f6bc[["PeerSession"]]
  TelemetryEvent_fa2488[["TelemetryEvent"]]
  DocumentVersion_969d6b[["DocumentVersion"]]
  VersionDiff_50b60e[["VersionDiff"]]
  VersionHistory_262ec9[["VersionHistory"]]

  %% relationships
  PresenceTracker_651408 -->|"imports"| PluginHost_bf20fc
  SignalApp_cfe515 -->|"imports"| DocumentStore_c6bb2d
  SignalApp_cfe515 -->|"imports"| StorageEventBus_856c82
  SignalApp_cfe515 -->|"imports"| GraphBuilder_0d1a47
  SignalApp_cfe515 -->|"imports"| Indexer_04e4ce
  SignalApp_cfe515 -->|"imports"| PluginHost_bf20fc
  SignalApp_cfe515 -->|"imports"| SyncEngine_9f454e
  SignalApp_cfe515 -->|"imports"| PresenceTracker_651408
  SignalApp_cfe515 -->|"imports"| RemoteSummarizer_73c0ca
  Indexer_04e4ce -->|"imports"| WorkerPool_b6cba9
  ExportPlugin_fe3c71 -->|"imports"| PluginHost_bf20fc
  PluginHost_bf20fc -->|"imports"| StorageEventBus_856c82
  SearchPlugin_3fdc98 -->|"imports"| PluginHost_bf20fc
  DocumentStore_c6bb2d -->|"imports"| StorageEventBus_856c82
  SyncEngine_9f454e -->|"imports"| StorageEventBus_856c82
  SyncManager_e60fce -->|"imports"| DocumentStore_c6bb2d
  SyncManager_e60fce -->|"imports"| StorageEventBus_856c82
  SyncManager_e60fce -->|"imports"| SyncEngine_9f454e
  SyncManager_e60fce -->|"imports"| SyncQueue_1c332d
  SyncManager_e60fce -->|"imports"| OfflineSyncQueue_212eeb
  SyncManager_e60fce -->|"imports"| PeerSession_54f6bc
  signal_app_26e3fd --o|"owns"| SyncEngine_43a466
  signal_app_26e3fd --o|"owns"| DocumentSnapshotService_4897a5
  signal_app_26e3fd --o|"owns"| DocumentStore_8c77eb
  signal_app_26e3fd --o|"owns"| SyncManager_d977bb
  signal_app_26e3fd --o|"owns"| SyncEngine_9f454e
  signal_app_26e3fd --o|"owns"| DocumentSnapshotService_c177d1
  signal_app_26e3fd --o|"owns"| DocumentStore_c6bb2d
  signal_app_26e3fd --o|"owns"| SyncManager_e60fce
  signal_app_26e3fd --o|"owns"| LocalSummarizer_448cc4
  signal_app_26e3fd --o|"owns"| RemoteSummarizer_73c0ca
  signal_app_26e3fd --o|"owns"| PresenceTracker_651408
  signal_app_26e3fd --o|"owns"| SignalApp_cfe515
  signal_app_26e3fd --o|"owns"| InvertedIndex_835910
  signal_app_26e3fd --o|"owns"| GraphBuilder_0d1a47
  signal_app_26e3fd --o|"owns"| Indexer_04e4ce
  signal_app_26e3fd --o|"owns"| WorkerPool_b6cba9
  signal_app_26e3fd --o|"owns"| ExportPlugin_fe3c71
  signal_app_26e3fd --o|"owns"| PluginHost_bf20fc
  signal_app_26e3fd --o|"owns"| SearchPlugin_3fdc98
  signal_app_26e3fd --o|"owns"| StorageEventBus_856c82
  signal_app_26e3fd --o|"owns"| OfflineSyncQueue_212eeb
  signal_app_26e3fd --o|"owns"| SyncQueue_1c332d
  signal_app_26e3fd --o|"owns"| SyncSessionTracker_123c43
  signal_app_26e3fd --o|"owns"| PeerSession_54f6bc
  signal_app_26e3fd --o|"owns"| VersionHistory_262ec9

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_26e3fd moduleStyle
  class SyncEngine_43a466,ClockProvider_2fbc34,SnapshotStore_5f48c1,DocumentSnapshotService_4897a5,DocumentStore_8c77eb,SyncManager_d977bb,SyncEngine_9f454e,ClockProvider_fb2a9a,SnapshotStore_9f2459,DocumentSnapshotService_c177d1,DocumentStore_c6bb2d,SyncManager_e60fce,app_69c460 serviceStyle
  class Summarizer_af52c4,LocalSummarizer_448cc4,RemoteSummarizer_73c0ca,DocumentReader_e8a789,PresenceStatus_ea6aa8,PeerPresence_b92a22,PresenceTracker_651408,AppConfig_049e29,SignalApp_cfe515,Document_40ef3a,DocumentSnapshot_bbae5e,DocumentLink_906817,LinkKind_f0216b,SearchQuery_9edb70,SearchResult_fa6572,SearchResultSnapshot_f4dfa5,DocumentChange_8dfa78,SearchHit_6fef0e,InvertedIndexSearchHit_d43596,IndexStats_d9260b,InvertedIndex_835910,GraphNode_229e74,AdjacencyList_16d987,GraphAdjacencyList_cf2aa3,GraphBuilder_0d1a47,IndexerContract_a902f2,Indexer_04e4ce,IndexWorker_b241b2,WorkerPoolOptions_573783,WorkerPool_b6cba9,ExportPlugin_fe3c71,Plugin_de5dea,PluginContext_028ad6,PluginHost_bf20fc,SearchPlugin_3fdc98,StorageEventType_f82e76,StorageEventCreated_5c65d5,StorageEventUpdated_70e165,StorageEventDeleted_95eda0,StorageEventLinked_684fd3,StorageEvent_d121be,StorageEventBusContract_9e2bd7,StorageEventBus_856c82,DocumentSnapshotServiceOptions_d00e9d,ConflictCandidate_d0ef77,ConflictResolution_c61c47,ConflictCandidateRecord_8484d2,TransportSend_bbaebb,SyncManagerOptions_7cbab3,OfflineEntry_e40cd9,OfflineSyncQueueOptions_0b18b0,OfflineSyncQueue_212eeb,SyncState_b7c168,ConflictStrategy_f4737c,PeerInfo_844ead,SyncAck_2b552f,ConflictRecord_647f1e,VectorClock_1d74a3,SyncMessage_60811b,QueueEntry_65b5a3,SyncQueueOptions_20d1a8,SyncQueue_1c332d,SyncSessionState_d406de,SyncSessionEvent_7ff498,SyncSessionTrackerOptions_4108e8,SyncSessionTracker_123c43,PeerSession_54f6bc,TelemetryEvent_fa2488,DocumentVersion_969d6b,VersionDiff_50b60e,VersionHistory_262ec9 entityStyle
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
