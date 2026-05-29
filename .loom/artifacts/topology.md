# signal — Architectural Topology
> Generated 2026-05-29 · Graph 2022bf81

76 nodes · 41 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_4f5e01["signal-app"]
  %% services
  DeprecatedDocumentStore_336d91("DeprecatedDocumentStore")
  SnapshotStore_b0463b("SnapshotStore")
  FileSnapshotStore_90dd20("FileSnapshotStore")
  DocumentSnapshotService_ea19d4("DocumentSnapshotService")
  DiskDocumentSnapshotStore_6d8b4e("DiskDocumentSnapshotStore")
  DocumentStore_a51364("DocumentStore")
  SyncEngine_090f28("SyncEngine")
  SyncManager_9a4332("SyncManager")
  DeprecatedDocumentStore_b05033("DeprecatedDocumentStore")
  SnapshotStore_1d5b66("SnapshotStore")
  FileSnapshotStore_53c308("FileSnapshotStore")
  DocumentSnapshotService_9f99e8("DocumentSnapshotService")
  DiskDocumentSnapshotStore_4fc725("DiskDocumentSnapshotStore")
  DocumentStore_465ac4("DocumentStore")
  SyncEngine_d9cb9a("SyncEngine")
  SyncManager_96ea59("SyncManager")
  app_56405b("app")
  %% entitys
  LocalSummarizer_f33283[["LocalSummarizer"]]
  PeerPresence_e1eb5b[["PeerPresence"]]
  PresenceTracker_5a3a14[["PresenceTracker"]]
  SignalApp_d8efaa[["SignalApp"]]
  Document_184de0[["Document"]]
  AppConfig_68b2fb[["AppConfig"]]
  DocumentSnapshot_ed5ef8[["DocumentSnapshot"]]
  DocumentLink_f468ef[["DocumentLink"]]
  LinkKind_058ce4[["LinkKind"]]
  SearchQuery_62b92d[["SearchQuery"]]
  SearchResult_53f5e1[["SearchResult"]]
  SearchResultSnapshot_dd93d8[["SearchResultSnapshot"]]
  DocumentChange_d4ae69[["DocumentChange"]]
  GraphBuilder_c62705[["GraphBuilder"]]
  Indexer_7e1190[["Indexer"]]
  WorkerPool_a87143[["WorkerPool"]]
  InvertedIndex_f6464d[["InvertedIndex"]]
  ExportPlugin_ff8842[["ExportPlugin"]]
  StorageEventType_c60437[["StorageEventType"]]
  Plugin_9e2776[["Plugin"]]
  PluginContext_ce2bdd[["PluginContext"]]
  PluginHost_2f31c8[["PluginHost"]]
  SearchPlugin_3f0c9f[["SearchPlugin"]]
  StorageEventCreated_43e562[["StorageEventCreated"]]
  StorageEventUpdated_12a7ad[["StorageEventUpdated"]]
  StorageEventDeleted_729586[["StorageEventDeleted"]]
  StorageEventLinked_6bd715[["StorageEventLinked"]]
  StorageEvent_131a72[["StorageEvent"]]
  StorageEventListener_8b0fc9[["StorageEventListener"]]
  StorageEventBusContract_f34d58[["StorageEventBusContract"]]
  DocumentSnapshotServiceOptions_bd2c70[["DocumentSnapshotServiceOpti…"]]
  StorageEventBus_230ae7[["StorageEventBus"]]
  TransportSend_36c167[["TransportSend"]]
  OfflineSyncQueue_aacc1b[["OfflineSyncQueue"]]
  VectorClock_079630[["VectorClock"]]
  SyncState_ae1ed0[["SyncState"]]
  ConflictStrategy_0c4951[["ConflictStrategy"]]
  PeerInfo_c5244c[["PeerInfo"]]
  SyncAck_539b39[["SyncAck"]]
  ConflictRecord_81c0d6[["ConflictRecord"]]
  SyncMessage_fef0db[["SyncMessage"]]
  OfflineEntry_fbcf8d[["OfflineEntry"]]
  OfflineSyncQueueOptions_e894c2[["OfflineSyncQueueOptions"]]
  SyncManagerOptions_255a69[["SyncManagerOptions"]]
  ConflictCandidate_411208[["ConflictCandidate"]]
  ConflictCandidateRecord_fa6ba0[["ConflictCandidateRecord"]]
  QueueEntry_4452f5[["QueueEntry"]]
  SyncQueueOptions_4f8171[["SyncQueueOptions"]]
  SyncQueue_1b25e2[["SyncQueue"]]
  SyncSessionState_06d300[["SyncSessionState"]]
  SyncSessionEvent_a7f08e[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_5ede9e[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_ee1b11[["SyncSessionTracker"]]
  PeerSession_bed62d[["PeerSession"]]
  TelemetryEvent_ba2f67[["TelemetryEvent"]]
  DocumentVersion_b72c60[["DocumentVersion"]]
  VersionDiff_d9bb19[["VersionDiff"]]
  VersionHistory_2199e9[["VersionHistory"]]

  %% relationships
  SignalApp_d8efaa -->|"imports"| StorageEventBus_230ae7
  SignalApp_d8efaa -->|"imports"| DocumentStore_465ac4
  SignalApp_d8efaa -->|"imports"| GraphBuilder_c62705
  SignalApp_d8efaa -->|"imports"| SyncEngine_d9cb9a
  Indexer_7e1190 -->|"imports"| WorkerPool_a87143
  ExportPlugin_ff8842 -->|"imports"| PluginHost_2f31c8
  SearchPlugin_3f0c9f -->|"imports"| PluginHost_2f31c8
  DocumentSnapshotService_9f99e8 -->|"imports"| DiskDocumentSnapshotStore_4fc725
  DocumentStore_465ac4 -->|"imports"| StorageEventBus_230ae7
  SyncManager_96ea59 -->|"imports"| DocumentStore_465ac4
  SyncManager_96ea59 -->|"imports"| SyncEngine_d9cb9a
  SyncManager_96ea59 -->|"imports"| SyncQueue_1b25e2
  SyncManager_96ea59 -->|"imports"| PeerSession_bed62d
  signal_app_4f5e01 --o|"owns"| FileSnapshotStore_90dd20
  signal_app_4f5e01 --o|"owns"| DocumentSnapshotService_ea19d4
  signal_app_4f5e01 --o|"owns"| DiskDocumentSnapshotStore_6d8b4e
  signal_app_4f5e01 --o|"owns"| DocumentStore_a51364
  signal_app_4f5e01 --o|"owns"| SyncEngine_090f28
  signal_app_4f5e01 --o|"owns"| SyncManager_9a4332
  signal_app_4f5e01 --o|"owns"| FileSnapshotStore_53c308
  signal_app_4f5e01 --o|"owns"| DocumentSnapshotService_9f99e8
  signal_app_4f5e01 --o|"owns"| DiskDocumentSnapshotStore_4fc725
  signal_app_4f5e01 --o|"owns"| DocumentStore_465ac4
  signal_app_4f5e01 --o|"owns"| SyncEngine_d9cb9a
  signal_app_4f5e01 --o|"owns"| SyncManager_96ea59
  signal_app_4f5e01 --o|"owns"| LocalSummarizer_f33283
  signal_app_4f5e01 --o|"owns"| PresenceTracker_5a3a14
  signal_app_4f5e01 --o|"owns"| SignalApp_d8efaa
  signal_app_4f5e01 --o|"owns"| GraphBuilder_c62705
  signal_app_4f5e01 --o|"owns"| Indexer_7e1190
  signal_app_4f5e01 --o|"owns"| WorkerPool_a87143
  signal_app_4f5e01 --o|"owns"| InvertedIndex_f6464d
  signal_app_4f5e01 --o|"owns"| ExportPlugin_ff8842
  signal_app_4f5e01 --o|"owns"| PluginHost_2f31c8
  signal_app_4f5e01 --o|"owns"| SearchPlugin_3f0c9f
  signal_app_4f5e01 --o|"owns"| StorageEventBus_230ae7
  signal_app_4f5e01 --o|"owns"| OfflineSyncQueue_aacc1b
  signal_app_4f5e01 --o|"owns"| SyncQueue_1b25e2
  signal_app_4f5e01 --o|"owns"| SyncSessionTracker_ee1b11
  signal_app_4f5e01 --o|"owns"| PeerSession_bed62d
  signal_app_4f5e01 --o|"owns"| VersionHistory_2199e9

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_4f5e01 moduleStyle
  class DeprecatedDocumentStore_336d91,SnapshotStore_b0463b,FileSnapshotStore_90dd20,DocumentSnapshotService_ea19d4,DiskDocumentSnapshotStore_6d8b4e,DocumentStore_a51364,SyncEngine_090f28,SyncManager_9a4332,DeprecatedDocumentStore_b05033,SnapshotStore_1d5b66,FileSnapshotStore_53c308,DocumentSnapshotService_9f99e8,DiskDocumentSnapshotStore_4fc725,DocumentStore_465ac4,SyncEngine_d9cb9a,SyncManager_96ea59,app_56405b serviceStyle
  class LocalSummarizer_f33283,PeerPresence_e1eb5b,PresenceTracker_5a3a14,SignalApp_d8efaa,Document_184de0,AppConfig_68b2fb,DocumentSnapshot_ed5ef8,DocumentLink_f468ef,LinkKind_058ce4,SearchQuery_62b92d,SearchResult_53f5e1,SearchResultSnapshot_dd93d8,DocumentChange_d4ae69,GraphBuilder_c62705,Indexer_7e1190,WorkerPool_a87143,InvertedIndex_f6464d,ExportPlugin_ff8842,StorageEventType_c60437,Plugin_9e2776,PluginContext_ce2bdd,PluginHost_2f31c8,SearchPlugin_3f0c9f,StorageEventCreated_43e562,StorageEventUpdated_12a7ad,StorageEventDeleted_729586,StorageEventLinked_6bd715,StorageEvent_131a72,StorageEventListener_8b0fc9,StorageEventBusContract_f34d58,DocumentSnapshotServiceOptions_bd2c70,StorageEventBus_230ae7,TransportSend_36c167,OfflineSyncQueue_aacc1b,VectorClock_079630,SyncState_ae1ed0,ConflictStrategy_0c4951,PeerInfo_c5244c,SyncAck_539b39,ConflictRecord_81c0d6,SyncMessage_fef0db,OfflineEntry_fbcf8d,OfflineSyncQueueOptions_e894c2,SyncManagerOptions_255a69,ConflictCandidate_411208,ConflictCandidateRecord_fa6ba0,QueueEntry_4452f5,SyncQueueOptions_4f8171,SyncQueue_1b25e2,SyncSessionState_06d300,SyncSessionEvent_a7f08e,SyncSessionTrackerOptions_5ede9e,SyncSessionTracker_ee1b11,PeerSession_bed62d,TelemetryEvent_ba2f67,DocumentVersion_b72c60,VersionDiff_d9bb19,VersionHistory_2199e9 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 28 | 28 |
| SyncManager | service | 1 | 4 | 5 |
| SignalApp | entity | 1 | 4 | 5 |
| DocumentStore | service | 3 | 1 | 4 |
| SyncEngine | service | 3 | 0 | 3 |
| PluginHost | entity | 3 | 0 | 3 |
| StorageEventBus | entity | 3 | 0 | 3 |
| DocumentSnapshotService | service | 1 | 1 | 2 |
| DiskDocumentSnapshotStore | service | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| Indexer | entity | 1 | 1 | 2 |
| WorkerPool | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| FileSnapshotStore | service | 1 | 0 | 1 |
| DocumentSnapshotService | service | 1 | 0 | 1 |
| DiskDocumentSnapshotStore | service | 1 | 0 | 1 |
| DocumentStore | service | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
