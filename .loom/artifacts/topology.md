# signal — Architectural Topology
> Generated 2026-05-25 · Graph cfd95a7b

61 nodes · 36 edges

## Dependency Graph

```mermaid
graph TD
  %% modules
  signal_app_38793f["signal-app"]
  %% services
  DocumentStore_15cbc6("DocumentStore")
  SyncEngine_2fa275("SyncEngine")
  ClockProvider_58defb("ClockProvider")
  SyncManager_b6cc61("SyncManager")
  DocumentStore_330bdb("DocumentStore")
  SyncEngine_8eb6ae("SyncEngine")
  ClockProvider_a99b7b("ClockProvider")
  SyncManager_d8b34b("SyncManager")
  app_681d36("app")
  %% entitys
  Summarizer_5cc1c7[["Summarizer"]]
  LocalSummarizer_5e7729[["LocalSummarizer"]]
  RemoteSummarizer_c45847[["RemoteSummarizer"]]
  DocumentReader_f82bbe[["DocumentReader"]]
  PresenceStatus_e7218b[["PresenceStatus"]]
  PeerPresence_978ac6[["PeerPresence"]]
  PresenceTracker_7511b3[["PresenceTracker"]]
  AppConfig_b64cae[["AppConfig"]]
  SignalApp_cd03bd[["SignalApp"]]
  Document_463d21[["Document"]]
  DocumentLink_97a0b9[["DocumentLink"]]
  LinkKind_1521cc[["LinkKind"]]
  SearchQuery_f44774[["SearchQuery"]]
  SearchResult_8f5020[["SearchResult"]]
  DocumentChange_3cdf05[["DocumentChange"]]
  GraphNode_b0f68b[["GraphNode"]]
  AdjacencyList_459abb[["AdjacencyList"]]
  GraphBuilder_35e792[["GraphBuilder"]]
  IndexStats_391638[["IndexStats"]]
  SearchHit_0bdc14[["SearchHit"]]
  InvertedIndex_60c710[["InvertedIndex"]]
  ExportPlugin_55d95f[["ExportPlugin"]]
  Plugin_d373a0[["Plugin"]]
  PluginContext_b79750[["PluginContext"]]
  PluginHost_4815d5[["PluginHost"]]
  SearchPlugin_8efbd5[["SearchPlugin"]]
  StorageEventType_4456f9[["StorageEventType"]]
  StorageEventCreated_ae0513[["StorageEventCreated"]]
  StorageEventUpdated_dfbbd4[["StorageEventUpdated"]]
  StorageEventDeleted_c067ec[["StorageEventDeleted"]]
  StorageEventLinked_b767ad[["StorageEventLinked"]]
  StorageEvent_7b01ee[["StorageEvent"]]
  StorageEventBus_4e0c61[["StorageEventBus"]]
  ConflictCandidate_58d52e[["ConflictCandidate"]]
  ConflictResolution_6701de[["ConflictResolution"]]
  TransportSend_1c057c[["TransportSend"]]
  SyncManagerOptions_fb62f3[["SyncManagerOptions"]]
  SyncState_011b53[["SyncState"]]
  ConflictStrategy_68b67f[["ConflictStrategy"]]
  PeerInfo_b54fa7[["PeerInfo"]]
  SyncAck_2e1f1f[["SyncAck"]]
  ConflictRecord_9d0590[["ConflictRecord"]]
  VectorClock_6a63df[["VectorClock"]]
  SyncMessage_e5a2fc[["SyncMessage"]]
  QueueEntry_959bf9[["QueueEntry"]]
  SyncQueueOptions_8bf68e[["SyncQueueOptions"]]
  SyncQueue_aefe2f[["SyncQueue"]]
  PeerSession_182ca4[["PeerSession"]]
  DocumentVersion_0c5af5[["DocumentVersion"]]
  VersionDiff_ec5210[["VersionDiff"]]
  VersionHistory_22c357[["VersionHistory"]]

  %% relationships
  PresenceTracker_7511b3 -->|"imports"| PluginHost_4815d5
  SignalApp_cd03bd -->|"imports"| DocumentStore_330bdb
  SignalApp_cd03bd -->|"imports"| StorageEventBus_4e0c61
  SignalApp_cd03bd -->|"imports"| GraphBuilder_35e792
  SignalApp_cd03bd -->|"imports"| PluginHost_4815d5
  SignalApp_cd03bd -->|"imports"| SyncEngine_8eb6ae
  SignalApp_cd03bd -->|"imports"| PresenceTracker_7511b3
  SignalApp_cd03bd -->|"imports"| RemoteSummarizer_c45847
  ExportPlugin_55d95f -->|"imports"| PluginHost_4815d5
  SearchPlugin_8efbd5 -->|"imports"| PluginHost_4815d5
  DocumentStore_330bdb -->|"imports"| StorageEventBus_4e0c61
  SyncEngine_8eb6ae -->|"imports"| StorageEventBus_4e0c61
  SyncManager_d8b34b -->|"imports"| DocumentStore_330bdb
  SyncManager_d8b34b -->|"imports"| StorageEventBus_4e0c61
  SyncManager_d8b34b -->|"imports"| SyncEngine_8eb6ae
  SyncManager_d8b34b -->|"imports"| SyncQueue_aefe2f
  SyncManager_d8b34b -->|"imports"| PeerSession_182ca4
  signal_app_38793f --o|"owns"| DocumentStore_15cbc6
  signal_app_38793f --o|"owns"| SyncEngine_2fa275
  signal_app_38793f --o|"owns"| SyncManager_b6cc61
  signal_app_38793f --o|"owns"| DocumentStore_330bdb
  signal_app_38793f --o|"owns"| SyncEngine_8eb6ae
  signal_app_38793f --o|"owns"| SyncManager_d8b34b
  signal_app_38793f --o|"owns"| LocalSummarizer_5e7729
  signal_app_38793f --o|"owns"| RemoteSummarizer_c45847
  signal_app_38793f --o|"owns"| PresenceTracker_7511b3
  signal_app_38793f --o|"owns"| SignalApp_cd03bd
  signal_app_38793f --o|"owns"| GraphBuilder_35e792
  signal_app_38793f --o|"owns"| InvertedIndex_60c710
  signal_app_38793f --o|"owns"| ExportPlugin_55d95f
  signal_app_38793f --o|"owns"| PluginHost_4815d5
  signal_app_38793f --o|"owns"| SearchPlugin_8efbd5
  signal_app_38793f --o|"owns"| StorageEventBus_4e0c61
  signal_app_38793f --o|"owns"| SyncQueue_aefe2f
  signal_app_38793f --o|"owns"| PeerSession_182ca4
  signal_app_38793f --o|"owns"| VersionHistory_22c357

  %% styles
  classDef moduleStyle fill:#1e3a5f,stroke:#4a9eff,color:#e8f4fd
  classDef serviceStyle fill:#1e3d2f,stroke:#4aff8e,color:#e8fdf0
  classDef workflowStyle fill:#3d2f1e,stroke:#ffa54a,color:#fdf0e8
  classDef entityStyle fill:#2f1e3d,stroke:#c54aff,color:#f0e8fd
  class signal_app_38793f moduleStyle
  class DocumentStore_15cbc6,SyncEngine_2fa275,ClockProvider_58defb,SyncManager_b6cc61,DocumentStore_330bdb,SyncEngine_8eb6ae,ClockProvider_a99b7b,SyncManager_d8b34b,app_681d36 serviceStyle
  class Summarizer_5cc1c7,LocalSummarizer_5e7729,RemoteSummarizer_c45847,DocumentReader_f82bbe,PresenceStatus_e7218b,PeerPresence_978ac6,PresenceTracker_7511b3,AppConfig_b64cae,SignalApp_cd03bd,Document_463d21,DocumentLink_97a0b9,LinkKind_1521cc,SearchQuery_f44774,SearchResult_8f5020,DocumentChange_3cdf05,GraphNode_b0f68b,AdjacencyList_459abb,GraphBuilder_35e792,IndexStats_391638,SearchHit_0bdc14,InvertedIndex_60c710,ExportPlugin_55d95f,Plugin_d373a0,PluginContext_b79750,PluginHost_4815d5,SearchPlugin_8efbd5,StorageEventType_4456f9,StorageEventCreated_ae0513,StorageEventUpdated_dfbbd4,StorageEventDeleted_c067ec,StorageEventLinked_b767ad,StorageEvent_7b01ee,StorageEventBus_4e0c61,ConflictCandidate_58d52e,ConflictResolution_6701de,TransportSend_1c057c,SyncManagerOptions_fb62f3,SyncState_011b53,ConflictStrategy_68b67f,PeerInfo_b54fa7,SyncAck_2e1f1f,ConflictRecord_9d0590,VectorClock_6a63df,SyncMessage_e5a2fc,QueueEntry_959bf9,SyncQueueOptions_8bf68e,SyncQueue_aefe2f,PeerSession_182ca4,DocumentVersion_0c5af5,VersionDiff_ec5210,VersionHistory_22c357 entityStyle
```

## Coupling Table

| Label | Kind | Fan-In | Fan-Out | Total |
|---|---|---|---|---|
| signal-app | module | 0 | 19 | 19 |
| SignalApp | entity | 1 | 7 | 8 |
| SyncManager | service | 1 | 5 | 6 |
| PluginHost | entity | 5 | 0 | 5 |
| StorageEventBus | entity | 5 | 0 | 5 |
| DocumentStore | service | 3 | 1 | 4 |
| SyncEngine | service | 3 | 1 | 4 |
| PresenceTracker | entity | 2 | 1 | 3 |
| RemoteSummarizer | entity | 2 | 0 | 2 |
| GraphBuilder | entity | 2 | 0 | 2 |
| ExportPlugin | entity | 1 | 1 | 2 |
| SearchPlugin | entity | 1 | 1 | 2 |
| SyncQueue | entity | 2 | 0 | 2 |
| PeerSession | entity | 2 | 0 | 2 |
| DocumentStore | service | 1 | 0 | 1 |
| SyncEngine | service | 1 | 0 | 1 |
| SyncManager | service | 1 | 0 | 1 |
| LocalSummarizer | entity | 1 | 0 | 1 |
| InvertedIndex | entity | 1 | 0 | 1 |
| VersionHistory | entity | 1 | 0 | 1 |

## Next Steps

- `loom invariants [module]` — list formalized invariants for a module
- `loom derive` — generate artifacts from current graph state
- `loom drift [dir]` — detect code drift from crystallized evidence
- `loom topology --adapt` — run adaptive topology cycle
