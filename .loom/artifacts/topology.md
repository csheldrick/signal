# signal — Architectural Topology
> Generated 2026-05-30 · Graph a12c74f0

71 nodes · 41 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_bb07bf["signal-app"]
  %% services
  SnapshotStore_012a18("SnapshotStore")
  FileSnapshotStore_e5bddb("FileSnapshotStore")
  DocumentSnapshotService_80e8c0("DocumentSnapshotService")
  DiskDocumentSnapshotStore_807e73("DiskDocumentSnapshotStore")
  DocumentStore_4052f6("DocumentStore")
  SyncEngine_a9e4c1("SyncEngine")
  SyncManager_c035c7("SyncManager")
  SnapshotStore_212707("SnapshotStore")
  FileSnapshotStore_53ba08("FileSnapshotStore")
  DocumentSnapshotService_643320("DocumentSnapshotService")
  DiskDocumentSnapshotStore_23eb28("DiskDocumentSnapshotStore")
  DocumentStore_dfb2c6("DocumentStore")
  SyncEngine_11ed44("SyncEngine")
  SyncManager_36122d("SyncManager")
  app_9990f9("app")
  %% entitys
  LocalSummarizer_f7d6de[["LocalSummarizer"]]
  PeerPresence_82d563[["PeerPresence"]]
  PresenceTracker_71f677[["PresenceTracker"]]
  SignalApp_730d09[["SignalApp"]]
  Document_b21771[["Document"]]
  AppConfig_353e15[["AppConfig"]]
  VectorClock_7f01a9[["VectorClock"]]
  SyncState_1fdab2[["SyncState"]]
  ConflictStrategy_4f8daa[["ConflictStrategy"]]
  PeerInfo_16591a[["PeerInfo"]]
  SyncAck_2042c5[["SyncAck"]]
  ConflictRecord_bfb7cc[["ConflictRecord"]]
  SyncMessage_171de1[["SyncMessage"]]
  OfflineEntry_75ca3d[["OfflineEntry"]]
  OfflineSyncQueueOptions_e15e9e[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_28d282[["OfflineSyncQueue"]]
  SyncManagerOptions_85389e[["SyncManagerOptions"]]
  ConflictCandidate_326b28[["ConflictCandidate"]]
  ConflictCandidateRecord_6ae943[["ConflictCandidateRecord"]]
  DocumentSnapshot_3aaa45[["DocumentSnapshot"]]
  DocumentLink_01600a[["DocumentLink"]]
  LinkKind_891664[["LinkKind"]]
  SearchQuery_58a68c[["SearchQuery"]]
  SearchResult_d643c4[["SearchResult"]]
  SearchResultSnapshot_285ab0[["SearchResultSnapshot"]]
  DocumentChange_765696[["DocumentChange"]]
  GraphBuilder_fb6ecd[["GraphBuilder"]]
  Indexer_72fb9b[["Indexer"]]
  WorkerPool_b44a75[["WorkerPool"]]
  ExportPlugin_ac0f6e[["ExportPlugin"]]
  HealthPlugin_47b37d[["HealthPlugin"]]
  StorageEventType_b13c39[["StorageEventType"]]
  Plugin_8109e3[["Plugin"]]
  PluginContext_167f1e[["PluginContext"]]
  PluginHost_f6dbdb[["PluginHost"]]
  SearchPlugin_1abb9b[["SearchPlugin"]]
  StorageEvent_e37250[["StorageEvent"]]
  Listener_552491[["Listener"]]
  StorageEventBusContract_a67fa3[["StorageEventBusContract"]]
  StorageEventBus_8c0cd1[["StorageEventBus"]]
  ScopedStorageEventBusContract_dfff65[["ScopedStorageEventBusContra…"]]
  ScopedStorageEventBus_a8305a[["ScopedStorageEventBus"]]
  TransportSend_efd7b8[["TransportSend"]]
  QueueEntry_f483ef[["QueueEntry"]]
  SyncQueueOptions_b6835c[["SyncQueueOptions"]]
  SyncQueue_1ab9d0[["SyncQueue"]]
  SyncSessionState_5d05e7[["SyncSessionState"]]
  SyncSessionEvent_5c5089[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_b0adc7[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_6da3dd[["SyncSessionTracker"]]
  PeerSession_aa5023[["PeerSession"]]
  TelemetryEvent_b3a998[["TelemetryEvent"]]
  DocumentVersion_919bd3[["DocumentVersion"]]
  VersionDiff_5b516b[["VersionDiff"]]
  VersionHistory_9298e7[["VersionHistory"]]

  %% relationships
  SignalApp_730d09 -->|"imports"| StorageEventBus_8c0cd1
  SignalApp_730d09 -->|"imports"| DocumentStore_dfb2c6
  SignalApp_730d09 -->|"imports"| GraphBuilder_fb6ecd
  SignalApp_730d09 -->|"imports"| SyncEngine_11ed44
  Indexer_72fb9b -->|"imports"| WorkerPool_b44a75
  ScopedStorageEventBus_a8305a -->|"imports"| StorageEventBus_8c0cd1
  DocumentSnapshotService_643320 -->|"imports"| DiskDocumentSnapshotStore_23eb28
  DocumentStore_dfb2c6 -->|"imports"| StorageEventBus_8c0cd1
  SyncManager_36122d -->|"imports"| DocumentStore_dfb2c6
  SyncManager_36122d -->|"imports"| SyncEngine_11ed44
  SyncManager_36122d -->|"imports"| SyncQueue_1ab9d0
  SyncManager_36122d -->|"imports"| PeerSession_aa5023
  signal_app_bb07bf --o|"owns"| FileSnapshotStore_e5bddb
  signal_app_bb07bf --o|"owns"| DocumentSnapshotService_80e8c0
  signal_app_bb07bf --o|"owns"| DiskDocumentSnapshotStore_807e73
  signal_app_bb07bf --o|"owns"| DocumentStore_4052f6
  signal_app_bb07bf --o|"owns"| SyncEngine_a9e4c1
  signal_app_bb07bf --o|"owns"| SyncManager_c035c7
  signal_app_bb07bf --o|"owns"| FileSnapshotStore_53ba08
  signal_app_bb07bf --o|"owns"| DocumentSnapshotService_643320
  signal_app_bb07bf --o|"owns"| DiskDocumentSnapshotStore_23eb28
  signal_app_bb07bf --o|"owns"| DocumentStore_dfb2c6
  signal_app_bb07bf --o|"owns"| SyncEngine_11ed44
  signal_app_bb07bf --o|"owns"| SyncManager_36122d
  signal_app_bb07bf --o|"owns"| LocalSummarizer_f7d6de
  signal_app_bb07bf --o|"owns"| PresenceTracker_71f677
  signal_app_bb07bf --o|"owns"| SignalApp_730d09
  signal_app_bb07bf --o|"owns"| OfflineSyncQueue_28d282
  signal_app_bb07bf --o|"owns"| GraphBuilder_fb6ecd
  signal_app_bb07bf --o|"owns"| Indexer_72fb9b
  signal_app_bb07bf --o|"owns"| WorkerPool_b44a75
  signal_app_bb07bf --o|"owns"| ExportPlugin_ac0f6e
  signal_app_bb07bf --o|"owns"| HealthPlugin_47b37d
  signal_app_bb07bf --o|"owns"| PluginHost_f6dbdb
  signal_app_bb07bf --o|"owns"| SearchPlugin_1abb9b
  signal_app_bb07bf --o|"owns"| StorageEventBus_8c0cd1
  signal_app_bb07bf --o|"owns"| ScopedStorageEventBus_a8305a
  signal_app_bb07bf --o|"owns"| SyncQueue_1ab9d0
  signal_app_bb07bf --o|"owns"| SyncSessionTracker_6da3dd
  signal_app_bb07bf --o|"owns"| PeerSession_aa5023
  signal_app_bb07bf --o|"owns"| VersionHistory_9298e7

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_bb07bf moduleStyle
  class SnapshotStore_012a18,FileSnapshotStore_e5bddb,DocumentSnapshotService_80e8c0,DiskDocumentSnapshotStore_807e73,DocumentStore_4052f6,SyncEngine_a9e4c1,SyncManager_c035c7,SnapshotStore_212707,FileSnapshotStore_53ba08,DocumentSnapshotService_643320,DiskDocumentSnapshotStore_23eb28,DocumentStore_dfb2c6,SyncEngine_11ed44,SyncManager_36122d,app_9990f9 serviceStyle
  class LocalSummarizer_f7d6de,PeerPresence_82d563,PresenceTracker_71f677,SignalApp_730d09,Document_b21771,AppConfig_353e15,VectorClock_7f01a9,SyncState_1fdab2,ConflictStrategy_4f8daa,PeerInfo_16591a,SyncAck_2042c5,ConflictRecord_bfb7cc,SyncMessage_171de1,OfflineEntry_75ca3d,OfflineSyncQueueOptions_e15e9e,OfflineSyncQueue_28d282,SyncManagerOptions_85389e,ConflictCandidate_326b28,ConflictCandidateRecord_6ae943,DocumentSnapshot_3aaa45,DocumentLink_01600a,LinkKind_891664,SearchQuery_58a68c,SearchResult_d643c4,SearchResultSnapshot_285ab0,DocumentChange_765696,GraphBuilder_fb6ecd,Indexer_72fb9b,WorkerPool_b44a75,ExportPlugin_ac0f6e,HealthPlugin_47b37d,StorageEventType_b13c39,Plugin_8109e3,PluginContext_167f1e,PluginHost_f6dbdb,SearchPlugin_1abb9b,StorageEvent_e37250,Listener_552491,StorageEventBusContract_a67fa3,StorageEventBus_8c0cd1,ScopedStorageEventBusContract_dfff65,ScopedStorageEventBus_a8305a,TransportSend_efd7b8,QueueEntry_f483ef,SyncQueueOptions_b6835c,SyncQueue_1ab9d0,SyncSessionState_5d05e7,SyncSessionEvent_5c5089,SyncSessionTrackerOptions_b0adc7,SyncSessionTracker_6da3dd,PeerSession_aa5023,TelemetryEvent_b3a998,DocumentVersion_919bd3,VersionDiff_5b516b,VersionHistory_9298e7 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 29 | 29 |
| SyncManager | service | 1 | 4 | 5 |
| SignalApp | entity | 1 | 4 | 5 |
| DocumentStore | service | 3 | 1 | 4 |
| StorageEventBus | entity | 4 | 0 | 4 |
| SyncEngine | service | 3 | 0 | 3 |
| DocumentSnapshotService | service | 1 | 1 | 2 |
| DiskDocumentSnapshotStore | service | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| Indexer | entity | 1 | 1 | 2 |
| WorkerPool | entity | 2 | 0 | 2 |
| ScopedStorageEventBus | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| FileSnapshotStore | service | 1 | 0 | 1 |
| DocumentSnapshotService | service | 1 | 0 | 1 |
| DiskDocumentSnapshotStore | service | 1 | 0 | 1 |
| DocumentStore | service | 1 | 0 | 1 |
| SyncEngine | service | 1 | 0 | 1 |
| SyncManager | service | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
