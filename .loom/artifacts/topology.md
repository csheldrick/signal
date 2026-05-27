# signal — Architectural Topology
> Generated 2026-05-27 · Graph 05438491

87 nodes · 45 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_03c15a["signal-app"]
  %% services
  DocumentStore_74e2b0("DocumentStore")
  SyncEngine_4b3eb2("SyncEngine")
  DeprecatedDocumentStore_5ee165("DeprecatedDocumentStore")
  ClockProvider_5ab2d3("ClockProvider")
  SnapshotStore_378112("SnapshotStore")
  DocumentSnapshotService_e8a910("DocumentSnapshotService")
  SyncManager_c38f45("SyncManager")
  DocumentStore_3c0a23("DocumentStore")
  SyncEngine_a58759("SyncEngine")
  DeprecatedDocumentStore_6c844e("DeprecatedDocumentStore")
  ClockProvider_d18b18("ClockProvider")
  SnapshotStore_2e1112("SnapshotStore")
  DocumentSnapshotService_be3478("DocumentSnapshotService")
  SyncManager_93ab2d("SyncManager")
  app_862131("app")
  %% entitys
  Summarizer_e7653a[["Summarizer"]]
  LocalSummarizer_4cd002[["LocalSummarizer"]]
  RemoteSummarizer_72c88d[["RemoteSummarizer"]]
  DocumentReader_a41c2a[["DocumentReader"]]
  PresenceStatus_07973e[["PresenceStatus"]]
  PeerPresence_9b656f[["PeerPresence"]]
  PresenceTracker_2d8042[["PresenceTracker"]]
  AppConfig_dddcf9[["AppConfig"]]
  SignalApp_b83ba3[["SignalApp"]]
  Document_19f329[["Document"]]
  DocumentSnapshot_39ca26[["DocumentSnapshot"]]
  DocumentLink_b39867[["DocumentLink"]]
  LinkKind_515ce9[["LinkKind"]]
  SearchQuery_8d1e7a[["SearchQuery"]]
  SearchResult_13a202[["SearchResult"]]
  SearchResultSnapshot_a0b648[["SearchResultSnapshot"]]
  DocumentChange_7fa5c0[["DocumentChange"]]
  DeprecatedDocumentChange_49b2a8[["DeprecatedDocumentChange"]]
  SearchHit_68fc76[["SearchHit"]]
  InvertedIndexSearchHit_623ebd[["InvertedIndexSearchHit"]]
  IndexStats_c95d80[["IndexStats"]]
  InvertedIndex_ac47a2[["InvertedIndex"]]
  GraphNode_ecb26c[["GraphNode"]]
  AdjacencyList_3401f1[["AdjacencyList"]]
  GraphAdjacencyList_63a94c[["GraphAdjacencyList"]]
  GraphBuilder_e87947[["GraphBuilder"]]
  IndexerContract_228776[["IndexerContract"]]
  Indexer_eab952[["Indexer"]]
  IndexWorker_56ca7d[["IndexWorker"]]
  WorkerPoolOptions_3b99eb[["WorkerPoolOptions"]]
  WorkerPool_84f0ac[["WorkerPool"]]
  ExportPlugin_eb2d6a[["ExportPlugin"]]
  Plugin_9ad393[["Plugin"]]
  PluginContext_e411b1[["PluginContext"]]
  PluginHost_a5e260[["PluginHost"]]
  SearchPlugin_ddf79e[["SearchPlugin"]]
  StorageEventType_907225[["StorageEventType"]]
  StorageEventCreated_a3295e[["StorageEventCreated"]]
  StorageEventUpdated_ccaf84[["StorageEventUpdated"]]
  StorageEventDeleted_2ce2e0[["StorageEventDeleted"]]
  StorageEventLinked_5678c0[["StorageEventLinked"]]
  StorageEvent_e9b25f[["StorageEvent"]]
  StorageEventBusContract_d01960[["StorageEventBusContract"]]
  StorageEventBus_3fb225[["StorageEventBus"]]
  DocumentSnapshotServiceOptions_09e6be[["DocumentSnapshotServiceOpti…"]]
  ConflictCandidate_95c5a0[["ConflictCandidate"]]
  ConflictResolution_344c1e[["ConflictResolution"]]
  ConflictCandidateRecord_12e398[["ConflictCandidateRecord"]]
  TransportSend_865fe7[["TransportSend"]]
  SyncManagerOptions_6f7319[["SyncManagerOptions"]]
  OfflineEntry_523258[["OfflineEntry"]]
  OfflineSyncQueueOptions_6ba040[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_2ff52d[["OfflineSyncQueue"]]
  SyncState_ad1913[["SyncState"]]
  ConflictStrategy_886c32[["ConflictStrategy"]]
  PeerInfo_4239f2[["PeerInfo"]]
  SyncAck_9406a6[["SyncAck"]]
  ConflictRecord_4b6c0c[["ConflictRecord"]]
  VectorClock_b0cd27[["VectorClock"]]
  SyncMessage_087402[["SyncMessage"]]
  QueueEntry_97140d[["QueueEntry"]]
  SyncQueueOptions_8fecb1[["SyncQueueOptions"]]
  SyncQueue_52fbda[["SyncQueue"]]
  SyncSessionState_46a71c[["SyncSessionState"]]
  SyncSessionEvent_cbeb6a[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_965b69[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_48dc89[["SyncSessionTracker"]]
  PeerSession_00b53b[["PeerSession"]]
  DocumentVersion_2a0149[["DocumentVersion"]]
  VersionDiff_bb606b[["VersionDiff"]]
  VersionHistory_5b68aa[["VersionHistory"]]

  %% relationships
  PresenceTracker_2d8042 -->|"imports"| PluginHost_a5e260
  SignalApp_b83ba3 -->|"imports"| DocumentStore_3c0a23
  SignalApp_b83ba3 -->|"imports"| StorageEventBus_3fb225
  SignalApp_b83ba3 -->|"imports"| GraphBuilder_e87947
  SignalApp_b83ba3 -->|"imports"| Indexer_eab952
  SignalApp_b83ba3 -->|"imports"| PluginHost_a5e260
  SignalApp_b83ba3 -->|"imports"| SyncEngine_a58759
  SignalApp_b83ba3 -->|"imports"| PresenceTracker_2d8042
  SignalApp_b83ba3 -->|"imports"| RemoteSummarizer_72c88d
  Indexer_eab952 -->|"imports"| WorkerPool_84f0ac
  ExportPlugin_eb2d6a -->|"imports"| PluginHost_a5e260
  PluginHost_a5e260 -->|"imports"| StorageEventBus_3fb225
  SearchPlugin_ddf79e -->|"imports"| PluginHost_a5e260
  DocumentStore_3c0a23 -->|"imports"| StorageEventBus_3fb225
  SyncEngine_a58759 -->|"imports"| StorageEventBus_3fb225
  SyncManager_93ab2d -->|"imports"| DocumentStore_3c0a23
  SyncManager_93ab2d -->|"imports"| StorageEventBus_3fb225
  SyncManager_93ab2d -->|"imports"| SyncEngine_a58759
  SyncManager_93ab2d -->|"imports"| SyncQueue_52fbda
  SyncManager_93ab2d -->|"imports"| PeerSession_00b53b
  signal_app_03c15a --o|"owns"| DocumentStore_74e2b0
  signal_app_03c15a --o|"owns"| SyncEngine_4b3eb2
  signal_app_03c15a --o|"owns"| DocumentSnapshotService_e8a910
  signal_app_03c15a --o|"owns"| SyncManager_c38f45
  signal_app_03c15a --o|"owns"| DocumentStore_3c0a23
  signal_app_03c15a --o|"owns"| SyncEngine_a58759
  signal_app_03c15a --o|"owns"| DocumentSnapshotService_be3478
  signal_app_03c15a --o|"owns"| SyncManager_93ab2d
  signal_app_03c15a --o|"owns"| LocalSummarizer_4cd002
  signal_app_03c15a --o|"owns"| RemoteSummarizer_72c88d
  signal_app_03c15a --o|"owns"| PresenceTracker_2d8042
  signal_app_03c15a --o|"owns"| SignalApp_b83ba3
  signal_app_03c15a --o|"owns"| InvertedIndex_ac47a2
  signal_app_03c15a --o|"owns"| GraphBuilder_e87947
  signal_app_03c15a --o|"owns"| Indexer_eab952
  signal_app_03c15a --o|"owns"| WorkerPool_84f0ac
  signal_app_03c15a --o|"owns"| ExportPlugin_eb2d6a
  signal_app_03c15a --o|"owns"| PluginHost_a5e260
  signal_app_03c15a --o|"owns"| SearchPlugin_ddf79e
  signal_app_03c15a --o|"owns"| StorageEventBus_3fb225
  signal_app_03c15a --o|"owns"| OfflineSyncQueue_2ff52d
  signal_app_03c15a --o|"owns"| SyncQueue_52fbda
  signal_app_03c15a --o|"owns"| SyncSessionTracker_48dc89
  signal_app_03c15a --o|"owns"| PeerSession_00b53b
  signal_app_03c15a --o|"owns"| VersionHistory_5b68aa

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_03c15a moduleStyle
  class DocumentStore_74e2b0,SyncEngine_4b3eb2,DeprecatedDocumentStore_5ee165,ClockProvider_5ab2d3,SnapshotStore_378112,DocumentSnapshotService_e8a910,SyncManager_c38f45,DocumentStore_3c0a23,SyncEngine_a58759,DeprecatedDocumentStore_6c844e,ClockProvider_d18b18,SnapshotStore_2e1112,DocumentSnapshotService_be3478,SyncManager_93ab2d,app_862131 serviceStyle
  class Summarizer_e7653a,LocalSummarizer_4cd002,RemoteSummarizer_72c88d,DocumentReader_a41c2a,PresenceStatus_07973e,PeerPresence_9b656f,PresenceTracker_2d8042,AppConfig_dddcf9,SignalApp_b83ba3,Document_19f329,DocumentSnapshot_39ca26,DocumentLink_b39867,LinkKind_515ce9,SearchQuery_8d1e7a,SearchResult_13a202,SearchResultSnapshot_a0b648,DocumentChange_7fa5c0,DeprecatedDocumentChange_49b2a8,SearchHit_68fc76,InvertedIndexSearchHit_623ebd,IndexStats_c95d80,InvertedIndex_ac47a2,GraphNode_ecb26c,AdjacencyList_3401f1,GraphAdjacencyList_63a94c,GraphBuilder_e87947,IndexerContract_228776,Indexer_eab952,IndexWorker_56ca7d,WorkerPoolOptions_3b99eb,WorkerPool_84f0ac,ExportPlugin_eb2d6a,Plugin_9ad393,PluginContext_e411b1,PluginHost_a5e260,SearchPlugin_ddf79e,StorageEventType_907225,StorageEventCreated_a3295e,StorageEventUpdated_ccaf84,StorageEventDeleted_2ce2e0,StorageEventLinked_5678c0,StorageEvent_e9b25f,StorageEventBusContract_d01960,StorageEventBus_3fb225,DocumentSnapshotServiceOptions_09e6be,ConflictCandidate_95c5a0,ConflictResolution_344c1e,ConflictCandidateRecord_12e398,TransportSend_865fe7,SyncManagerOptions_6f7319,OfflineEntry_523258,OfflineSyncQueueOptions_6ba040,OfflineSyncQueue_2ff52d,SyncState_ad1913,ConflictStrategy_886c32,PeerInfo_4239f2,SyncAck_9406a6,ConflictRecord_4b6c0c,VectorClock_b0cd27,SyncMessage_087402,QueueEntry_97140d,SyncQueueOptions_8fecb1,SyncQueue_52fbda,SyncSessionState_46a71c,SyncSessionEvent_cbeb6a,SyncSessionTrackerOptions_965b69,SyncSessionTracker_48dc89,PeerSession_00b53b,DocumentVersion_2a0149,VersionDiff_bb606b,VersionHistory_5b68aa entityStyle
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
