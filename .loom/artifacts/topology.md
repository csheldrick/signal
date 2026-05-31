# signal — Architectural Topology
> Generated 2026-05-31 · Graph 4bb62575

71 nodes · 41 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_f43b74["signal-app"]
  %% services
  SnapshotStore_cdc7aa("SnapshotStore")
  FileSnapshotStore_bb736c("FileSnapshotStore")
  DocumentSnapshotService_24b7b1("DocumentSnapshotService")
  DiskDocumentSnapshotStore_7a2148("DiskDocumentSnapshotStore")
  DocumentStore_7247de("DocumentStore")
  SyncEngine_8dfb84("SyncEngine")
  SyncManager_59ca9d("SyncManager")
  SnapshotStore_9b2201("SnapshotStore")
  FileSnapshotStore_117606("FileSnapshotStore")
  DocumentSnapshotService_74d304("DocumentSnapshotService")
  DiskDocumentSnapshotStore_346bb4("DiskDocumentSnapshotStore")
  DocumentStore_3af06b("DocumentStore")
  SyncEngine_a74d9d("SyncEngine")
  SyncManager_8aaf4e("SyncManager")
  app_e4639e("app")
  %% entitys
  LocalSummarizer_4157fd[["LocalSummarizer"]]
  PeerPresence_5185b2[["PeerPresence"]]
  PresenceTracker_51e3eb[["PresenceTracker"]]
  SignalApp_c47978[["SignalApp"]]
  Document_e29ec4[["Document"]]
  AppConfig_b2a992[["AppConfig"]]
  VectorClock_e3b64d[["VectorClock"]]
  SyncState_5f85d0[["SyncState"]]
  ConflictStrategy_bb482c[["ConflictStrategy"]]
  PeerInfo_25ecdd[["PeerInfo"]]
  SyncAck_db8efe[["SyncAck"]]
  ConflictRecord_3cfdaa[["ConflictRecord"]]
  SyncMessage_91f095[["SyncMessage"]]
  OfflineEntry_5b17ca[["OfflineEntry"]]
  OfflineSyncQueueOptions_751398[["OfflineSyncQueueOptions"]]
  OfflineSyncQueue_7e8fc4[["OfflineSyncQueue"]]
  SyncManagerOptions_6428aa[["SyncManagerOptions"]]
  ConflictCandidate_748e46[["ConflictCandidate"]]
  ConflictCandidateRecord_a7180a[["ConflictCandidateRecord"]]
  DocumentSnapshot_fd5acb[["DocumentSnapshot"]]
  DocumentLink_65932f[["DocumentLink"]]
  LinkKind_9e41c4[["LinkKind"]]
  SearchQuery_16a8e0[["SearchQuery"]]
  SearchResult_c75107[["SearchResult"]]
  SearchResultSnapshot_5eb9c1[["SearchResultSnapshot"]]
  DocumentChange_9fc6b9[["DocumentChange"]]
  GraphBuilder_bc8dc9[["GraphBuilder"]]
  Indexer_4c8983[["Indexer"]]
  WorkerPool_1bcadf[["WorkerPool"]]
  ExportPlugin_0d0800[["ExportPlugin"]]
  HealthPlugin_1417fc[["HealthPlugin"]]
  StorageEventType_01914e[["StorageEventType"]]
  Plugin_afe9fe[["Plugin"]]
  PluginContext_d352e0[["PluginContext"]]
  PluginHost_8b70f5[["PluginHost"]]
  SearchPlugin_1f49f7[["SearchPlugin"]]
  StorageEvent_9ec90c[["StorageEvent"]]
  Listener_0e5222[["Listener"]]
  StorageEventBusContract_3f49d8[["StorageEventBusContract"]]
  StorageEventBus_76b751[["StorageEventBus"]]
  ScopedStorageEventBusContract_e365ff[["ScopedStorageEventBusContra…"]]
  ScopedStorageEventBus_bf26ac[["ScopedStorageEventBus"]]
  TransportSend_4facb1[["TransportSend"]]
  QueueEntry_e74733[["QueueEntry"]]
  SyncQueueOptions_5d2609[["SyncQueueOptions"]]
  SyncQueue_3ea182[["SyncQueue"]]
  SyncSessionState_c1e673[["SyncSessionState"]]
  SyncSessionEvent_3bd861[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_850666[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_915ab5[["SyncSessionTracker"]]
  PeerSession_c48db0[["PeerSession"]]
  TelemetryEvent_8840d7[["TelemetryEvent"]]
  DocumentVersion_b96a00[["DocumentVersion"]]
  VersionDiff_30daa2[["VersionDiff"]]
  VersionHistory_01cd52[["VersionHistory"]]

  %% relationships
  SignalApp_c47978 -->|"imports"| StorageEventBus_76b751
  SignalApp_c47978 -->|"imports"| DocumentStore_3af06b
  SignalApp_c47978 -->|"imports"| GraphBuilder_bc8dc9
  SignalApp_c47978 -->|"imports"| SyncEngine_a74d9d
  Indexer_4c8983 -->|"imports"| WorkerPool_1bcadf
  ScopedStorageEventBus_bf26ac -->|"imports"| StorageEventBus_76b751
  DocumentSnapshotService_74d304 -->|"imports"| DiskDocumentSnapshotStore_346bb4
  DocumentStore_3af06b -->|"imports"| StorageEventBus_76b751
  SyncManager_8aaf4e -->|"imports"| DocumentStore_3af06b
  SyncManager_8aaf4e -->|"imports"| SyncEngine_a74d9d
  SyncManager_8aaf4e -->|"imports"| SyncQueue_3ea182
  SyncManager_8aaf4e -->|"imports"| PeerSession_c48db0
  signal_app_f43b74 --o|"owns"| FileSnapshotStore_bb736c
  signal_app_f43b74 --o|"owns"| DocumentSnapshotService_24b7b1
  signal_app_f43b74 --o|"owns"| DiskDocumentSnapshotStore_7a2148
  signal_app_f43b74 --o|"owns"| DocumentStore_7247de
  signal_app_f43b74 --o|"owns"| SyncEngine_8dfb84
  signal_app_f43b74 --o|"owns"| SyncManager_59ca9d
  signal_app_f43b74 --o|"owns"| FileSnapshotStore_117606
  signal_app_f43b74 --o|"owns"| DocumentSnapshotService_74d304
  signal_app_f43b74 --o|"owns"| DiskDocumentSnapshotStore_346bb4
  signal_app_f43b74 --o|"owns"| DocumentStore_3af06b
  signal_app_f43b74 --o|"owns"| SyncEngine_a74d9d
  signal_app_f43b74 --o|"owns"| SyncManager_8aaf4e
  signal_app_f43b74 --o|"owns"| LocalSummarizer_4157fd
  signal_app_f43b74 --o|"owns"| PresenceTracker_51e3eb
  signal_app_f43b74 --o|"owns"| SignalApp_c47978
  signal_app_f43b74 --o|"owns"| OfflineSyncQueue_7e8fc4
  signal_app_f43b74 --o|"owns"| GraphBuilder_bc8dc9
  signal_app_f43b74 --o|"owns"| Indexer_4c8983
  signal_app_f43b74 --o|"owns"| WorkerPool_1bcadf
  signal_app_f43b74 --o|"owns"| ExportPlugin_0d0800
  signal_app_f43b74 --o|"owns"| HealthPlugin_1417fc
  signal_app_f43b74 --o|"owns"| PluginHost_8b70f5
  signal_app_f43b74 --o|"owns"| SearchPlugin_1f49f7
  signal_app_f43b74 --o|"owns"| StorageEventBus_76b751
  signal_app_f43b74 --o|"owns"| ScopedStorageEventBus_bf26ac
  signal_app_f43b74 --o|"owns"| SyncQueue_3ea182
  signal_app_f43b74 --o|"owns"| SyncSessionTracker_915ab5
  signal_app_f43b74 --o|"owns"| PeerSession_c48db0
  signal_app_f43b74 --o|"owns"| VersionHistory_01cd52

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_f43b74 moduleStyle
  class SnapshotStore_cdc7aa,FileSnapshotStore_bb736c,DocumentSnapshotService_24b7b1,DiskDocumentSnapshotStore_7a2148,DocumentStore_7247de,SyncEngine_8dfb84,SyncManager_59ca9d,SnapshotStore_9b2201,FileSnapshotStore_117606,DocumentSnapshotService_74d304,DiskDocumentSnapshotStore_346bb4,DocumentStore_3af06b,SyncEngine_a74d9d,SyncManager_8aaf4e,app_e4639e serviceStyle
  class LocalSummarizer_4157fd,PeerPresence_5185b2,PresenceTracker_51e3eb,SignalApp_c47978,Document_e29ec4,AppConfig_b2a992,VectorClock_e3b64d,SyncState_5f85d0,ConflictStrategy_bb482c,PeerInfo_25ecdd,SyncAck_db8efe,ConflictRecord_3cfdaa,SyncMessage_91f095,OfflineEntry_5b17ca,OfflineSyncQueueOptions_751398,OfflineSyncQueue_7e8fc4,SyncManagerOptions_6428aa,ConflictCandidate_748e46,ConflictCandidateRecord_a7180a,DocumentSnapshot_fd5acb,DocumentLink_65932f,LinkKind_9e41c4,SearchQuery_16a8e0,SearchResult_c75107,SearchResultSnapshot_5eb9c1,DocumentChange_9fc6b9,GraphBuilder_bc8dc9,Indexer_4c8983,WorkerPool_1bcadf,ExportPlugin_0d0800,HealthPlugin_1417fc,StorageEventType_01914e,Plugin_afe9fe,PluginContext_d352e0,PluginHost_8b70f5,SearchPlugin_1f49f7,StorageEvent_9ec90c,Listener_0e5222,StorageEventBusContract_3f49d8,StorageEventBus_76b751,ScopedStorageEventBusContract_e365ff,ScopedStorageEventBus_bf26ac,TransportSend_4facb1,QueueEntry_e74733,SyncQueueOptions_5d2609,SyncQueue_3ea182,SyncSessionState_c1e673,SyncSessionEvent_3bd861,SyncSessionTrackerOptions_850666,SyncSessionTracker_915ab5,PeerSession_c48db0,TelemetryEvent_8840d7,DocumentVersion_b96a00,VersionDiff_30daa2,VersionHistory_01cd52 entityStyle
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
