# signal — Architectural Topology
> Generated 2026-05-31 · Graph a306cbd3

75 nodes · 41 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_d9382c["signal-app"]
  src_3f7669["src"]
  %% services
  SnapshotStore_90e193("SnapshotStore")
  FileSnapshotStore_5d8a64("FileSnapshotStore")
  DocumentSnapshotService_93091e("DocumentSnapshotService")
  DiskDocumentSnapshotStore_b7746d("DiskDocumentSnapshotStore")
  DocumentStore_5f0356("DocumentStore")
  SyncEngine_3d2033("SyncEngine")
  SyncManager_aebe64("SyncManager")
  SnapshotStore_d66d53("SnapshotStore")
  FileSnapshotStore_9f6d11("FileSnapshotStore")
  DocumentSnapshotService_278237("DocumentSnapshotService")
  DiskDocumentSnapshotStore_130635("DiskDocumentSnapshotStore")
  DocumentStore_61bffd("DocumentStore")
  SyncEngine_59ed8c("SyncEngine")
  SyncManager_ae0bff("SyncManager")
  app_e572dd("app")
  %% entitys
  LocalSummarizer_9603f6[["LocalSummarizer"]]
  PeerPresence_f6173e[["PeerPresence"]]
  PresenceTracker_f9bf2c[["PresenceTracker"]]
  SignalApp_20e5b3[["SignalApp"]]
  Document_051666[["Document"]]
  AppConfig_027d30[["AppConfig"]]
  VectorClock_f9725c[["VectorClock"]]
  SyncState_d07b69[["SyncState"]]
  ConflictStrategy_d7a965[["ConflictStrategy"]]
  PeerInfo_caa638[["PeerInfo"]]
  SyncAck_ec5635[["SyncAck"]]
  ConflictRecord_5c4e10[["ConflictRecord"]]
  SyncMessage_89cc65[["SyncMessage"]]
  OfflineEntry_db6e63[["OfflineEntry"]]
  OfflineSyncQueueOptions_40ea5f[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_475862[["OfflineSyncQueue"]]
  SyncManagerOptions_095991[["SyncManagerOptions"]]
  ConflictCandidate_edec0d[["ConflictCandidate"]]
  ConflictCandidateRecord_f25126[["ConflictCandidateRecord"]]
  DocumentSnapshot_d57026[["DocumentSnapshot"]]
  DocumentLink_ad2530[["DocumentLink"]]
  LinkKind_849616[["LinkKind"]]
  SearchQuery_e06acd[["SearchQuery"]]
  SearchResult_e3d060[["SearchResult"]]
  SearchResultSnapshot_1649ee[["SearchResultSnapshot"]]
  DocumentChange_6f01bc[["DocumentChange"]]
  GraphBuilder_c40764[["GraphBuilder"]]
  Indexer_1a2343[["Indexer"]]
  WorkerPool_a00390[["WorkerPool"]]
  ExportPlugin_c89b40[["ExportPlugin"]]
  HealthPlugin_64a87d[["HealthPlugin"]]
  StorageEventType_0667db[["StorageEventType"]]
  Plugin_7d868d[["Plugin"]]
  PluginContext_8dcc7a[["PluginContext"]]
  PluginHost_e60c07[["PluginHost"]]
  SearchPlugin_f82f85[["SearchPlugin"]]
  StorageEvent_1c3c22[["StorageEvent"]]
  Listener_d181d3[["Listener"]]
  StorageEventBusContract_e3428a[["StorageEventBusContract"]]
  StorageEventBus_407c6f[["StorageEventBus"]]
  ScopedStorageEventBusContract_a80dff[["ScopedStorageEventBusContra…"]]
  ScopedStorageEventBus_cb833c[["ScopedStorageEventBus"]]
  TransportSend_ad7471[["TransportSend"]]
  QueueEntry_01d8cb[["QueueEntry"]]
  SyncQueueOptions_c1180f[["SyncQueueOptions"]]
  SyncQueue_81c99e[["SyncQueue"]]
  SyncSessionState_834a32[["SyncSessionState"]]
  SyncSessionEvent_6a9f9e[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_93e026[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_a365a0[["SyncSessionTracker"]]
  PeerSession_f52647[["PeerSession"]]
  TelemetryEvent_cc606c[["TelemetryEvent"]]
  DocumentVersion_bad28c[["DocumentVersion"]]
  VersionDiff_3c106c[["VersionDiff"]]
  VersionHistory_52e72a[["VersionHistory"]]
  InvertedIndex_cd62c4[["InvertedIndex"]]
  IndexStats_ff7dc5[["IndexStats"]]
  SearchHit_1e4442[["SearchHit"]]

  %% relationships
  SignalApp_20e5b3 -->|"imports"| StorageEventBus_407c6f
  SignalApp_20e5b3 -->|"imports"| DocumentStore_61bffd
  SignalApp_20e5b3 -->|"imports"| GraphBuilder_c40764
  SignalApp_20e5b3 -->|"imports"| SyncEngine_59ed8c
  Indexer_1a2343 -->|"imports"| WorkerPool_a00390
  ScopedStorageEventBus_cb833c -->|"imports"| StorageEventBus_407c6f
  DocumentSnapshotService_278237 -->|"imports"| DiskDocumentSnapshotStore_130635
  DocumentStore_61bffd -->|"imports"| StorageEventBus_407c6f
  SyncManager_ae0bff -->|"imports"| DocumentStore_61bffd
  SyncManager_ae0bff -->|"imports"| SyncEngine_59ed8c
  SyncManager_ae0bff -->|"imports"| SyncQueue_81c99e
  SyncManager_ae0bff -->|"imports"| PeerSession_f52647
  signal_app_d9382c --o|"owns"| FileSnapshotStore_5d8a64
  signal_app_d9382c --o|"owns"| DocumentSnapshotService_93091e
  signal_app_d9382c --o|"owns"| DiskDocumentSnapshotStore_b7746d
  signal_app_d9382c --o|"owns"| DocumentStore_5f0356
  signal_app_d9382c --o|"owns"| SyncEngine_3d2033
  signal_app_d9382c --o|"owns"| SyncManager_aebe64
  signal_app_d9382c --o|"owns"| FileSnapshotStore_9f6d11
  signal_app_d9382c --o|"owns"| DocumentSnapshotService_278237
  signal_app_d9382c --o|"owns"| DiskDocumentSnapshotStore_130635
  signal_app_d9382c --o|"owns"| DocumentStore_61bffd
  signal_app_d9382c --o|"owns"| SyncEngine_59ed8c
  signal_app_d9382c --o|"owns"| SyncManager_ae0bff
  signal_app_d9382c --o|"owns"| LocalSummarizer_9603f6
  signal_app_d9382c --o|"owns"| PresenceTracker_f9bf2c
  signal_app_d9382c --o|"owns"| SignalApp_20e5b3
  signal_app_d9382c --o|"owns"| OfflineSyncQueue_475862
  signal_app_d9382c --o|"owns"| GraphBuilder_c40764
  signal_app_d9382c --o|"owns"| Indexer_1a2343
  signal_app_d9382c --o|"owns"| WorkerPool_a00390
  signal_app_d9382c --o|"owns"| ExportPlugin_c89b40
  signal_app_d9382c --o|"owns"| HealthPlugin_64a87d
  signal_app_d9382c --o|"owns"| PluginHost_e60c07
  signal_app_d9382c --o|"owns"| SearchPlugin_f82f85
  signal_app_d9382c --o|"owns"| StorageEventBus_407c6f
  signal_app_d9382c --o|"owns"| ScopedStorageEventBus_cb833c
  signal_app_d9382c --o|"owns"| SyncQueue_81c99e
  signal_app_d9382c --o|"owns"| SyncSessionTracker_a365a0
  signal_app_d9382c --o|"owns"| PeerSession_f52647
  signal_app_d9382c --o|"owns"| VersionHistory_52e72a

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_d9382c,src_3f7669 moduleStyle
  class SnapshotStore_90e193,FileSnapshotStore_5d8a64,DocumentSnapshotService_93091e,DiskDocumentSnapshotStore_b7746d,DocumentStore_5f0356,SyncEngine_3d2033,SyncManager_aebe64,SnapshotStore_d66d53,FileSnapshotStore_9f6d11,DocumentSnapshotService_278237,DiskDocumentSnapshotStore_130635,DocumentStore_61bffd,SyncEngine_59ed8c,SyncManager_ae0bff,app_e572dd serviceStyle
  class LocalSummarizer_9603f6,PeerPresence_f6173e,PresenceTracker_f9bf2c,SignalApp_20e5b3,Document_051666,AppConfig_027d30,VectorClock_f9725c,SyncState_d07b69,ConflictStrategy_d7a965,PeerInfo_caa638,SyncAck_ec5635,ConflictRecord_5c4e10,SyncMessage_89cc65,OfflineEntry_db6e63,OfflineSyncQueueOptions_40ea5f,OfflineSyncQueue_475862,SyncManagerOptions_095991,ConflictCandidate_edec0d,ConflictCandidateRecord_f25126,DocumentSnapshot_d57026,DocumentLink_ad2530,LinkKind_849616,SearchQuery_e06acd,SearchResult_e3d060,SearchResultSnapshot_1649ee,DocumentChange_6f01bc,GraphBuilder_c40764,Indexer_1a2343,WorkerPool_a00390,ExportPlugin_c89b40,HealthPlugin_64a87d,StorageEventType_0667db,Plugin_7d868d,PluginContext_8dcc7a,PluginHost_e60c07,SearchPlugin_f82f85,StorageEvent_1c3c22,Listener_d181d3,StorageEventBusContract_e3428a,StorageEventBus_407c6f,ScopedStorageEventBusContract_a80dff,ScopedStorageEventBus_cb833c,TransportSend_ad7471,QueueEntry_01d8cb,SyncQueueOptions_c1180f,SyncQueue_81c99e,SyncSessionState_834a32,SyncSessionEvent_6a9f9e,SyncSessionTrackerOptions_93e026,SyncSessionTracker_a365a0,PeerSession_f52647,TelemetryEvent_cc606c,DocumentVersion_bad28c,VersionDiff_3c106c,VersionHistory_52e72a,InvertedIndex_cd62c4,IndexStats_ff7dc5,SearchHit_1e4442 entityStyle
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
