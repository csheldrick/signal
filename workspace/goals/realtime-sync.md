# Realtime Sync

Sync operations should be eventually consistent across collaborating peers.

## Requirements

- Changes propagate to connected peers in real time when online
- Disconnected peers merge cleanly when they reconnect
- Conflict resolution is deterministic and automatic (CRDTs or OT)
- No data loss during concurrent edits
- Sync protocol handles network partitions gracefully

## Loom/Weave implications

- Structural changes detected by Loom (via `LoomExporter.diff()`) could trigger
  Weave activation at changed nodes to surface sync-related tensions
- Weave tension accumulation can detect architectural instability from frequent
  sync conflicts (e.g., `semantic_duplication`, `contradiction` tensions)
