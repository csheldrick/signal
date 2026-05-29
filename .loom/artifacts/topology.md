# signal — Architectural Topology
> Generated 2026-05-29 · Graph 06781852

75 nodes · 43 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_3a2552["signal-app"]
  %% services
  SnapshotStore_f66120("SnapshotStore")
  FileSnapshotStore_86491c("FileSnapshotStore")
  DocumentSnapshotService_bb9987("DocumentSnapshotService")
  DiskDocumentSnapshotStore_cf04bd("DiskDocumentSnapshotStore")
  DocumentStore_29683f("DocumentStore")
  SyncEngine_c8a5a5("SyncEngine")
  SyncManager_31272d("SyncManager")
  SnapshotStore_5401ac("SnapshotStore")
  FileSnapshotStore_7012fa("FileSnapshotStore")
  DocumentSnapshotService_eb1839("DocumentSnapshotService")
  DiskDocumentSnapshotStore_4c6a2f("DiskDocumentSnapshotStore")
  DocumentStore_99b406("DocumentStore")
  SyncEngine_f4517c("SyncEngine")
  SyncManager_2c9156("SyncManager")
  app_49bb4d("app")
  %% entitys
  LocalSummarizer_b1d1b0[["LocalSummarizer"]]
  PeerPresence_471fc6[["PeerPresence"]]
  PresenceTracker_175ba0[["PresenceTracker"]]
  SignalApp_bda9d8[["SignalApp"]]
  Document_738978[["Document"]]
  AppConfig_0f17b6[["AppConfig"]]
  DocumentSnapshot_55c462[["DocumentSnapshot"]]
  DocumentLink_7d55ea[["DocumentLink"]]
  LinkKind_b354b4[["LinkKind"]]
  SearchQuery_fb4b80[["SearchQuery"]]
  SearchResult_30be48[["SearchResult"]]
  SearchResultSnapshot_36cf49[["SearchResultSnapshot"]]
  DocumentChange_dee269[["DocumentChange"]]
  GraphBuilder_5506b2[["GraphBuilder"]]
  Indexer_608f2e[["Indexer"]]
  WorkerPool_d29112[["WorkerPool"]]
  InvertedIndex_ea2226[["InvertedIndex"]]
  ExportPlugin_2736fb[["ExportPlugin"]]
  HealthPlugin_74199b[["HealthPlugin"]]
  StorageEventType_cf0601[["StorageEventType"]]
  Plugin_1419d9[["Plugin"]]
  PluginContext_04bd25[["PluginContext"]]
  PluginHost_ba8c41[["PluginHost"]]
  SearchPlugin_e7c352[["SearchPlugin"]]
  StorageEventCreated_57ffb5[["StorageEventCreated"]]
  StorageEventUpdated_657db3[["StorageEventUpdated"]]
  StorageEventDeleted_9bba65[["StorageEventDeleted"]]
  StorageEventLinked_312224[["StorageEventLinked"]]
  StorageEvent_6e3221[["StorageEvent"]]
  StorageEventListener_6a5e00[["StorageEventListener"]]
  StorageEventBusContract_c36f06[["StorageEventBusContract"]]
  DocumentSnapshotServiceOptions_5b0475[["DocumentSnapshotServiceOpti…"]]
  StorageEventBus_78d6bf[["StorageEventBus"]]
  TransportSend_c1e086[["TransportSend"]]
  OfflineSyncQueue_a7d770[["OfflineSyncQueue"]]
  VectorClock_a81543[["VectorClock"]]
  SyncState_77309f[["SyncState"]]
  ConflictStrategy_4af562[["ConflictStrategy"]]
  PeerInfo_6b1010[["PeerInfo"]]
  SyncAck_5bf600[["SyncAck"]]
  ConflictRecord_46a931[["ConflictRecord"]]
  SyncMessage_22e656[["SyncMessage"]]
  OfflineEntry_bd713e[["OfflineEntry"]]
  OfflineSyncQueueOptions_f33c2c[["OfflineSyncQueueOptions"]]
  SyncManagerOptions_a84a47[["SyncManagerOptions"]]
  ConflictCandidate_099f26[["ConflictCandidate"]]
  ConflictCandidateRecord_865ab6[["ConflictCandidateRecord"]]
  QueueEntry_45c891[["QueueEntry"]]
  SyncQueueOptions_c33580[["SyncQueueOptions"]]
  SyncQueue_636807[["SyncQueue"]]
  SyncSessionState_92a254[["SyncSessionState"]]
  SyncSessionEvent_a1e17a[["SyncSessionEvent"]]
  SyncSessionTrackerOptions_458f54[["SyncSessionTrackerOptions"]]
  SyncSessionTracker_7c7af5[["SyncSessionTracker"]]
  PeerSession_ce33da[["PeerSession"]]
  TelemetryEvent_ec423c[["TelemetryEvent"]]
  DocumentVersion_efcdaf[["DocumentVersion"]]
  VersionDiff_bc76bc[["VersionDiff"]]
  VersionHistory_b169e0[["VersionHistory"]]

  %% relationships
  SignalApp_bda9d8 -->|"imports"| StorageEventBus_78d6bf
  SignalApp_bda9d8 -->|"imports"| DocumentStore_99b406
  SignalApp_bda9d8 -->|"imports"| GraphBuilder_5506b2
  SignalApp_bda9d8 -->|"imports"| SyncEngine_f4517c
  Indexer_608f2e -->|"imports"| WorkerPool_d29112
  ExportPlugin_2736fb -->|"imports"| PluginHost_ba8c41
  HealthPlugin_74199b -->|"imports"| PluginHost_ba8c41
  SearchPlugin_e7c352 -->|"imports"| PluginHost_ba8c41
  DocumentSnapshotService_eb1839 -->|"imports"| DiskDocumentSnapshotStore_4c6a2f
  DocumentStore_99b406 -->|"imports"| StorageEventBus_78d6bf
  SyncManager_2c9156 -->|"imports"| DocumentStore_99b406
  SyncManager_2c9156 -->|"imports"| SyncEngine_f4517c
  SyncManager_2c9156 -->|"imports"| SyncQueue_636807
  SyncManager_2c9156 -->|"imports"| PeerSession_ce33da
  signal_app_3a2552 --o|"owns"| FileSnapshotStore_86491c
  signal_app_3a2552 --o|"owns"| DocumentSnapshotService_bb9987
  signal_app_3a2552 --o|"owns"| DiskDocumentSnapshotStore_cf04bd
  signal_app_3a2552 --o|"owns"| DocumentStore_29683f
  signal_app_3a2552 --o|"owns"| SyncEngine_c8a5a5
  signal_app_3a2552 --o|"owns"| SyncManager_31272d
  signal_app_3a2552 --o|"owns"| FileSnapshotStore_7012fa
  signal_app_3a2552 --o|"owns"| DocumentSnapshotService_eb1839
  signal_app_3a2552 --o|"owns"| DiskDocumentSnapshotStore_4c6a2f
  signal_app_3a2552 --o|"owns"| DocumentStore_99b406
  signal_app_3a2552 --o|"owns"| SyncEngine_f4517c
  signal_app_3a2552 --o|"owns"| SyncManager_2c9156
  signal_app_3a2552 --o|"owns"| LocalSummarizer_b1d1b0
  signal_app_3a2552 --o|"owns"| PresenceTracker_175ba0
  signal_app_3a2552 --o|"owns"| SignalApp_bda9d8
  signal_app_3a2552 --o|"owns"| GraphBuilder_5506b2
  signal_app_3a2552 --o|"owns"| Indexer_608f2e
  signal_app_3a2552 --o|"owns"| WorkerPool_d29112
  signal_app_3a2552 --o|"owns"| InvertedIndex_ea2226
  signal_app_3a2552 --o|"owns"| ExportPlugin_2736fb
  signal_app_3a2552 --o|"owns"| HealthPlugin_74199b
  signal_app_3a2552 --o|"owns"| PluginHost_ba8c41
  signal_app_3a2552 --o|"owns"| SearchPlugin_e7c352
  signal_app_3a2552 --o|"owns"| StorageEventBus_78d6bf
  signal_app_3a2552 --o|"owns"| OfflineSyncQueue_a7d770
  signal_app_3a2552 --o|"owns"| SyncQueue_636807
  signal_app_3a2552 --o|"owns"| SyncSessionTracker_7c7af5
  signal_app_3a2552 --o|"owns"| PeerSession_ce33da
  signal_app_3a2552 --o|"owns"| VersionHistory_b169e0

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_3a2552 moduleStyle
  class SnapshotStore_f66120,FileSnapshotStore_86491c,DocumentSnapshotService_bb9987,DiskDocumentSnapshotStore_cf04bd,DocumentStore_29683f,SyncEngine_c8a5a5,SyncManager_31272d,SnapshotStore_5401ac,FileSnapshotStore_7012fa,DocumentSnapshotService_eb1839,DiskDocumentSnapshotStore_4c6a2f,DocumentStore_99b406,SyncEngine_f4517c,SyncManager_2c9156,app_49bb4d serviceStyle
  class LocalSummarizer_b1d1b0,PeerPresence_471fc6,PresenceTracker_175ba0,SignalApp_bda9d8,Document_738978,AppConfig_0f17b6,DocumentSnapshot_55c462,DocumentLink_7d55ea,LinkKind_b354b4,SearchQuery_fb4b80,SearchResult_30be48,SearchResultSnapshot_36cf49,DocumentChange_dee269,GraphBuilder_5506b2,Indexer_608f2e,WorkerPool_d29112,InvertedIndex_ea2226,ExportPlugin_2736fb,HealthPlugin_74199b,StorageEventType_cf0601,Plugin_1419d9,PluginContext_04bd25,PluginHost_ba8c41,SearchPlugin_e7c352,StorageEventCreated_57ffb5,StorageEventUpdated_657db3,StorageEventDeleted_9bba65,StorageEventLinked_312224,StorageEvent_6e3221,StorageEventListener_6a5e00,StorageEventBusContract_c36f06,DocumentSnapshotServiceOptions_5b0475,StorageEventBus_78d6bf,TransportSend_c1e086,OfflineSyncQueue_a7d770,VectorClock_a81543,SyncState_77309f,ConflictStrategy_4af562,PeerInfo_6b1010,SyncAck_5bf600,ConflictRecord_46a931,SyncMessage_22e656,OfflineEntry_bd713e,OfflineSyncQueueOptions_f33c2c,SyncManagerOptions_a84a47,ConflictCandidate_099f26,ConflictCandidateRecord_865ab6,QueueEntry_45c891,SyncQueueOptions_c33580,SyncQueue_636807,SyncSessionState_92a254,SyncSessionEvent_a1e17a,SyncSessionTrackerOptions_458f54,SyncSessionTracker_7c7af5,PeerSession_ce33da,TelemetryEvent_ec423c,DocumentVersion_efcdaf,VersionDiff_bc76bc,VersionHistory_b169e0 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 29 | 29 |
| SyncManager | service | 1 | 4 | 5 |
| SignalApp | entity | 1 | 4 | 5 |
| DocumentStore | service | 3 | 1 | 4 |
| PluginHost | entity | 4 | 0 | 4 |
| SyncEngine | service | 3 | 0 | 3 |
| StorageEventBus | entity | 3 | 0 | 3 |
| DocumentSnapshotService | service | 1 | 1 | 2 |
| DiskDocumentSnapshotStore | service | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| Indexer | entity | 1 | 1 | 2 |
| WorkerPool | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| HealthPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| FileSnapshotStore | service | 1 | 0 | 1 |
| DocumentSnapshotService | service | 1 | 0 | 1 |
| DiskDocumentSnapshotStore | service | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
