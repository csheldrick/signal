# signal — Architectural Topology
> Generated 2026-05-30 · Graph ef337590

71 nodes · 41 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_cda6c9["signal-app"]
  %% services
  SnapshotStore_62c67e("SnapshotStore")
  FileSnapshotStore_ec6bd8("FileSnapshotStore")
  DocumentSnapshotService_088169("DocumentSnapshotService")
  DiskDocumentSnapshotStore_26a2fc("DiskDocumentSnapshotStore")
  DocumentStore_1ce03c("DocumentStore")
  SyncEngine_0d00f8("SyncEngine")
  SyncManager_1b8bb4("SyncManager")
  SnapshotStore_06bfe1("SnapshotStore")
  FileSnapshotStore_27d92e("FileSnapshotStore")
  DocumentSnapshotService_c61388("DocumentSnapshotService")
  DiskDocumentSnapshotStore_d74105("DiskDocumentSnapshotStore")
  DocumentStore_a99d60("DocumentStore")
  SyncEngine_eb40d9("SyncEngine")
  SyncManager_57d722("SyncManager")
  app_f67d06("app")
  %% entitys
  LocalSummarizer_e1a26f[["LocalSummarizer"]]
  PeerPresence_e5d9cf[["PeerPresence"]]
  PresenceTracker_c3417b[["PresenceTracker"]]
  SignalApp_ade512[["SignalApp"]]
  Document_dfba1b[["Document"]]
  AppConfig_ca3553[["AppConfig"]]
  VectorClock_179028[["VectorClock"]]
  SyncState_84287c[["SyncState"]]
  ConflictStrategy_9a57ed[["ConflictStrategy"]]
  PeerInfo_7404f5[["PeerInfo"]]
  SyncAck_f47a71[["SyncAck"]]
  ConflictRecord_cce323[["ConflictRecord"]]
  SyncMessage_90a418[["SyncMessage"]]
  OfflineEntry_9943b4[["OfflineEntry"]]
  OfflineSyncQueueOptions_ebe834[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_80bc73[["OfflineSyncQueue"]]
  SyncManagerOptions_7c0708[["SyncManagerOptions"]]
  ConflictCandidate_d8d28a[["ConflictCandidate"]]
  ConflictCandidateRecord_e325bb[["ConflictCandidateRecord"]]
  DocumentSnapshot_7613e9[["DocumentSnapshot"]]
  DocumentLink_1abbc0[["DocumentLink"]]
  LinkKind_515a0b[["LinkKind"]]
  SearchQuery_6b2f94[["SearchQuery"]]
  SearchResult_dbbf03[["SearchResult"]]
  SearchResultSnapshot_19103c[["SearchResultSnapshot"]]
  DocumentChange_aa754a[["DocumentChange"]]
  GraphBuilder_99d268[["GraphBuilder"]]
  Indexer_498eb2[["Indexer"]]
  WorkerPool_ee2cb0[["WorkerPool"]]
  ExportPlugin_f042bb[["ExportPlugin"]]
  HealthPlugin_9a508e[["HealthPlugin"]]
  StorageEventType_7a923f[["StorageEventType"]]
  Plugin_09bd1a[["Plugin"]]
  PluginContext_61033d[["PluginContext"]]
  PluginHost_ea0236[["PluginHost"]]
  SearchPlugin_edd7bf[["SearchPlugin"]]
  StorageEvent_3e399a[["StorageEvent"]]
  Listener_c374c5[["Listener"]]
  StorageEventBusContract_4ae018[["StorageEventBusContract"]]
  StorageEventBus_a3ca00[["StorageEventBus"]]
  ScopedStorageEventBusContract_fd459a[["ScopedStorageEventBusContra…"]]
  ScopedStorageEventBus_a1284e[["ScopedStorageEventBus"]]
  TransportSend_ff2dc5[["TransportSend"]]
  QueueEntry_8c781e[["QueueEntry"]]
  SyncQueueOptions_0bc908[["SyncQueueOptions"]]
  SyncQueue_b3bdfe[["SyncQueue"]]
  SyncSessionState_ad9334[["SyncSessionState"]]
  SyncSessionEvent_dbc0d9[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_3c300a[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_bb4829[["SyncSessionTracker"]]
  PeerSession_05c625[["PeerSession"]]
  TelemetryEvent_6c497f[["TelemetryEvent"]]
  DocumentVersion_32a44b[["DocumentVersion"]]
  VersionDiff_401577[["VersionDiff"]]
  VersionHistory_9f9801[["VersionHistory"]]

  %% relationships
  SignalApp_ade512 -->|"imports"| StorageEventBus_a3ca00
  SignalApp_ade512 -->|"imports"| DocumentStore_a99d60
  SignalApp_ade512 -->|"imports"| GraphBuilder_99d268
  SignalApp_ade512 -->|"imports"| SyncEngine_eb40d9
  Indexer_498eb2 -->|"imports"| WorkerPool_ee2cb0
  ScopedStorageEventBus_a1284e -->|"imports"| StorageEventBus_a3ca00
  DocumentSnapshotService_c61388 -->|"imports"| DiskDocumentSnapshotStore_d74105
  DocumentStore_a99d60 -->|"imports"| StorageEventBus_a3ca00
  SyncManager_57d722 -->|"imports"| DocumentStore_a99d60
  SyncManager_57d722 -->|"imports"| SyncEngine_eb40d9
  SyncManager_57d722 -->|"imports"| SyncQueue_b3bdfe
  SyncManager_57d722 -->|"imports"| PeerSession_05c625
  signal_app_cda6c9 --o|"owns"| FileSnapshotStore_ec6bd8
  signal_app_cda6c9 --o|"owns"| DocumentSnapshotService_088169
  signal_app_cda6c9 --o|"owns"| DiskDocumentSnapshotStore_26a2fc
  signal_app_cda6c9 --o|"owns"| DocumentStore_1ce03c
  signal_app_cda6c9 --o|"owns"| SyncEngine_0d00f8
  signal_app_cda6c9 --o|"owns"| SyncManager_1b8bb4
  signal_app_cda6c9 --o|"owns"| FileSnapshotStore_27d92e
  signal_app_cda6c9 --o|"owns"| DocumentSnapshotService_c61388
  signal_app_cda6c9 --o|"owns"| DiskDocumentSnapshotStore_d74105
  signal_app_cda6c9 --o|"owns"| DocumentStore_a99d60
  signal_app_cda6c9 --o|"owns"| SyncEngine_eb40d9
  signal_app_cda6c9 --o|"owns"| SyncManager_57d722
  signal_app_cda6c9 --o|"owns"| LocalSummarizer_e1a26f
  signal_app_cda6c9 --o|"owns"| PresenceTracker_c3417b
  signal_app_cda6c9 --o|"owns"| SignalApp_ade512
  signal_app_cda6c9 --o|"owns"| OfflineSyncQueue_80bc73
  signal_app_cda6c9 --o|"owns"| GraphBuilder_99d268
  signal_app_cda6c9 --o|"owns"| Indexer_498eb2
  signal_app_cda6c9 --o|"owns"| WorkerPool_ee2cb0
  signal_app_cda6c9 --o|"owns"| ExportPlugin_f042bb
  signal_app_cda6c9 --o|"owns"| HealthPlugin_9a508e
  signal_app_cda6c9 --o|"owns"| PluginHost_ea0236
  signal_app_cda6c9 --o|"owns"| SearchPlugin_edd7bf
  signal_app_cda6c9 --o|"owns"| StorageEventBus_a3ca00
  signal_app_cda6c9 --o|"owns"| ScopedStorageEventBus_a1284e
  signal_app_cda6c9 --o|"owns"| SyncQueue_b3bdfe
  signal_app_cda6c9 --o|"owns"| SyncSessionTracker_bb4829
  signal_app_cda6c9 --o|"owns"| PeerSession_05c625
  signal_app_cda6c9 --o|"owns"| VersionHistory_9f9801

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_cda6c9 moduleStyle
  class SnapshotStore_62c67e,FileSnapshotStore_ec6bd8,DocumentSnapshotService_088169,DiskDocumentSnapshotStore_26a2fc,DocumentStore_1ce03c,SyncEngine_0d00f8,SyncManager_1b8bb4,SnapshotStore_06bfe1,FileSnapshotStore_27d92e,DocumentSnapshotService_c61388,DiskDocumentSnapshotStore_d74105,DocumentStore_a99d60,SyncEngine_eb40d9,SyncManager_57d722,app_f67d06 serviceStyle
  class LocalSummarizer_e1a26f,PeerPresence_e5d9cf,PresenceTracker_c3417b,SignalApp_ade512,Document_dfba1b,AppConfig_ca3553,VectorClock_179028,SyncState_84287c,ConflictStrategy_9a57ed,PeerInfo_7404f5,SyncAck_f47a71,ConflictRecord_cce323,SyncMessage_90a418,OfflineEntry_9943b4,OfflineSyncQueueOptions_ebe834,OfflineSyncQueue_80bc73,SyncManagerOptions_7c0708,ConflictCandidate_d8d28a,ConflictCandidateRecord_e325bb,DocumentSnapshot_7613e9,DocumentLink_1abbc0,LinkKind_515a0b,SearchQuery_6b2f94,SearchResult_dbbf03,SearchResultSnapshot_19103c,DocumentChange_aa754a,GraphBuilder_99d268,Indexer_498eb2,WorkerPool_ee2cb0,ExportPlugin_f042bb,HealthPlugin_9a508e,StorageEventType_7a923f,Plugin_09bd1a,PluginContext_61033d,PluginHost_ea0236,SearchPlugin_edd7bf,StorageEvent_3e399a,Listener_c374c5,StorageEventBusContract_4ae018,StorageEventBus_a3ca00,ScopedStorageEventBusContract_fd459a,ScopedStorageEventBus_a1284e,TransportSend_ff2dc5,QueueEntry_8c781e,SyncQueueOptions_0bc908,SyncQueue_b3bdfe,SyncSessionState_ad9334,SyncSessionEvent_dbc0d9,SyncSessionTrackerOptions_3c300a,SyncSessionTracker_bb4829,PeerSession_05c625,TelemetryEvent_6c497f,DocumentVersion_32a44b,VersionDiff_401577,VersionHistory_9f9801 entityStyle
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
