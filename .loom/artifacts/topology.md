# signal — Architectural Topology
> Generated 2026-05-29 · Graph 7b0249bf

76 nodes · 41 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_57c47a["signal-app"]
  %% services
  DeprecatedDocumentStore_5856f1("DeprecatedDocumentStore")
  SnapshotStore_a3bc2f("SnapshotStore")
  FileSnapshotStore_58b351("FileSnapshotStore")
  DocumentSnapshotService_f65aa6("DocumentSnapshotService")
  DiskDocumentSnapshotStore_1ebca8("DiskDocumentSnapshotStore")
  DocumentStore_c4f11f("DocumentStore")
  SyncEngine_17f225("SyncEngine")
  SyncManager_7b7d0d("SyncManager")
  DeprecatedDocumentStore_e51fbe("DeprecatedDocumentStore")
  SnapshotStore_fd6b87("SnapshotStore")
  FileSnapshotStore_c5c9f1("FileSnapshotStore")
  DocumentSnapshotService_766a16("DocumentSnapshotService")
  DiskDocumentSnapshotStore_55856e("DiskDocumentSnapshotStore")
  DocumentStore_d3dfa7("DocumentStore")
  SyncEngine_85a6fb("SyncEngine")
  SyncManager_de926e("SyncManager")
  app_e1d8d1("app")
  %% entitys
  LocalSummarizer_f4ec2c[["LocalSummarizer"]]
  PeerPresence_107c56[["PeerPresence"]]
  PresenceTracker_304ada[["PresenceTracker"]]
  SignalApp_c005c5[["SignalApp"]]
  Document_531c8d[["Document"]]
  AppConfig_d4a3b8[["AppConfig"]]
  DocumentSnapshot_29a7a7[["DocumentSnapshot"]]
  DocumentLink_00c8a7[["DocumentLink"]]
  LinkKind_4cea04[["LinkKind"]]
  SearchQuery_bdacad[["SearchQuery"]]
  SearchResult_db218a[["SearchResult"]]
  SearchResultSnapshot_b4773a[["SearchResultSnapshot"]]
  DocumentChange_9a9acb[["DocumentChange"]]
  GraphBuilder_89955a[["GraphBuilder"]]
  Indexer_4e3098[["Indexer"]]
  WorkerPool_b81215[["WorkerPool"]]
  InvertedIndex_d371c0[["InvertedIndex"]]
  ExportPlugin_0a6913[["ExportPlugin"]]
  StorageEventType_6a0fa1[["StorageEventType"]]
  Plugin_b7e701[["Plugin"]]
  PluginContext_136690[["PluginContext"]]
  PluginHost_b847be[["PluginHost"]]
  SearchPlugin_fe17b4[["SearchPlugin"]]
  StorageEventCreated_449502[["StorageEventCreated"]]
  StorageEventUpdated_5f6119[["StorageEventUpdated"]]
  StorageEventDeleted_aae4f8[["StorageEventDeleted"]]
  StorageEventLinked_efc020[["StorageEventLinked"]]
  StorageEvent_e567cf[["StorageEvent"]]
  StorageEventListener_f2b654[["StorageEventListener"]]
  StorageEventBusContract_b3715a[["StorageEventBusContract"]]
  DocumentSnapshotServiceOptions_3a4e8b[["DocumentSnapshotServiceOpti…"]]
  StorageEventBus_e9884f[["StorageEventBus"]]
  TransportSend_78cc5e[["TransportSend"]]
  OfflineSyncQueue_542755[["OfflineSyncQueue"]]
  VectorClock_943ef6[["VectorClock"]]
  SyncState_39721c[["SyncState"]]
  ConflictStrategy_756ced[["ConflictStrategy"]]
  PeerInfo_ca2d0f[["PeerInfo"]]
  SyncAck_cb5f16[["SyncAck"]]
  ConflictRecord_03b2da[["ConflictRecord"]]
  SyncMessage_f0ac0a[["SyncMessage"]]
  OfflineEntry_180006[["OfflineEntry"]]
  OfflineSyncQueueOptions_3b6c96[["OfflineSyncQueueOptions"]]
  SyncManagerOptions_aa1df2[["SyncManagerOptions"]]
  ConflictCandidate_9714d8[["ConflictCandidate"]]
  ConflictCandidateRecord_5c8d2b[["ConflictCandidateRecord"]]
  QueueEntry_0f29ac[["QueueEntry"]]
  SyncQueueOptions_858f0f[["SyncQueueOptions"]]
  SyncQueue_a78215[["SyncQueue"]]
  SyncSessionState_e70b9c[["SyncSessionState"]]
  SyncSessionEvent_3f83ec[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_cff607[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_2cd810[["SyncSessionTracker"]]
  PeerSession_061b0f[["PeerSession"]]
  TelemetryEvent_7bd138[["TelemetryEvent"]]
  DocumentVersion_3d0ebd[["DocumentVersion"]]
  VersionDiff_23c010[["VersionDiff"]]
  VersionHistory_7ddcff[["VersionHistory"]]

  %% relationships
  SignalApp_c005c5 -->|"imports"| StorageEventBus_e9884f
  SignalApp_c005c5 -->|"imports"| DocumentStore_d3dfa7
  SignalApp_c005c5 -->|"imports"| GraphBuilder_89955a
  SignalApp_c005c5 -->|"imports"| SyncEngine_85a6fb
  Indexer_4e3098 -->|"imports"| WorkerPool_b81215
  ExportPlugin_0a6913 -->|"imports"| PluginHost_b847be
  SearchPlugin_fe17b4 -->|"imports"| PluginHost_b847be
  DocumentSnapshotService_766a16 -->|"imports"| DiskDocumentSnapshotStore_55856e
  DocumentStore_d3dfa7 -->|"imports"| StorageEventBus_e9884f
  SyncManager_de926e -->|"imports"| DocumentStore_d3dfa7
  SyncManager_de926e -->|"imports"| SyncEngine_85a6fb
  SyncManager_de926e -->|"imports"| SyncQueue_a78215
  SyncManager_de926e -->|"imports"| PeerSession_061b0f
  signal_app_57c47a --o|"owns"| FileSnapshotStore_58b351
  signal_app_57c47a --o|"owns"| DocumentSnapshotService_f65aa6
  signal_app_57c47a --o|"owns"| DiskDocumentSnapshotStore_1ebca8
  signal_app_57c47a --o|"owns"| DocumentStore_c4f11f
  signal_app_57c47a --o|"owns"| SyncEngine_17f225
  signal_app_57c47a --o|"owns"| SyncManager_7b7d0d
  signal_app_57c47a --o|"owns"| FileSnapshotStore_c5c9f1
  signal_app_57c47a --o|"owns"| DocumentSnapshotService_766a16
  signal_app_57c47a --o|"owns"| DiskDocumentSnapshotStore_55856e
  signal_app_57c47a --o|"owns"| DocumentStore_d3dfa7
  signal_app_57c47a --o|"owns"| SyncEngine_85a6fb
  signal_app_57c47a --o|"owns"| SyncManager_de926e
  signal_app_57c47a --o|"owns"| LocalSummarizer_f4ec2c
  signal_app_57c47a --o|"owns"| PresenceTracker_304ada
  signal_app_57c47a --o|"owns"| SignalApp_c005c5
  signal_app_57c47a --o|"owns"| GraphBuilder_89955a
  signal_app_57c47a --o|"owns"| Indexer_4e3098
  signal_app_57c47a --o|"owns"| WorkerPool_b81215
  signal_app_57c47a --o|"owns"| InvertedIndex_d371c0
  signal_app_57c47a --o|"owns"| ExportPlugin_0a6913
  signal_app_57c47a --o|"owns"| PluginHost_b847be
  signal_app_57c47a --o|"owns"| SearchPlugin_fe17b4
  signal_app_57c47a --o|"owns"| StorageEventBus_e9884f
  signal_app_57c47a --o|"owns"| OfflineSyncQueue_542755
  signal_app_57c47a --o|"owns"| SyncQueue_a78215
  signal_app_57c47a --o|"owns"| SyncSessionTracker_2cd810
  signal_app_57c47a --o|"owns"| PeerSession_061b0f
  signal_app_57c47a --o|"owns"| VersionHistory_7ddcff

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_57c47a moduleStyle
  class DeprecatedDocumentStore_5856f1,SnapshotStore_a3bc2f,FileSnapshotStore_58b351,DocumentSnapshotService_f65aa6,DiskDocumentSnapshotStore_1ebca8,DocumentStore_c4f11f,SyncEngine_17f225,SyncManager_7b7d0d,DeprecatedDocumentStore_e51fbe,SnapshotStore_fd6b87,FileSnapshotStore_c5c9f1,DocumentSnapshotService_766a16,DiskDocumentSnapshotStore_55856e,DocumentStore_d3dfa7,SyncEngine_85a6fb,SyncManager_de926e,app_e1d8d1 serviceStyle
  class LocalSummarizer_f4ec2c,PeerPresence_107c56,PresenceTracker_304ada,SignalApp_c005c5,Document_531c8d,AppConfig_d4a3b8,DocumentSnapshot_29a7a7,DocumentLink_00c8a7,LinkKind_4cea04,SearchQuery_bdacad,SearchResult_db218a,SearchResultSnapshot_b4773a,DocumentChange_9a9acb,GraphBuilder_89955a,Indexer_4e3098,WorkerPool_b81215,InvertedIndex_d371c0,ExportPlugin_0a6913,StorageEventType_6a0fa1,Plugin_b7e701,PluginContext_136690,PluginHost_b847be,SearchPlugin_fe17b4,StorageEventCreated_449502,StorageEventUpdated_5f6119,StorageEventDeleted_aae4f8,StorageEventLinked_efc020,StorageEvent_e567cf,StorageEventListener_f2b654,StorageEventBusContract_b3715a,DocumentSnapshotServiceOptions_3a4e8b,StorageEventBus_e9884f,TransportSend_78cc5e,OfflineSyncQueue_542755,VectorClock_943ef6,SyncState_39721c,ConflictStrategy_756ced,PeerInfo_ca2d0f,SyncAck_cb5f16,ConflictRecord_03b2da,SyncMessage_f0ac0a,OfflineEntry_180006,OfflineSyncQueueOptions_3b6c96,SyncManagerOptions_aa1df2,ConflictCandidate_9714d8,ConflictCandidateRecord_5c8d2b,QueueEntry_0f29ac,SyncQueueOptions_858f0f,SyncQueue_a78215,SyncSessionState_e70b9c,SyncSessionEvent_3f83ec,SyncSessionTrackerOptions_cff607,SyncSessionTracker_2cd810,PeerSession_061b0f,TelemetryEvent_7bd138,DocumentVersion_3d0ebd,VersionDiff_23c010,VersionHistory_7ddcff entityStyle
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
