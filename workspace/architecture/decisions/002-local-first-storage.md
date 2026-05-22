# ADR-002: Local-First Storage Architecture

## Status

Proposed

## Context

Signal's primary goal is offline-first collaboration with local data ownership.
This requires a storage layer that works without network connectivity and can
sync when peers reconnect.

## Decision

Use a local-first storage model:

- All data persists locally first (IndexedDB, SQLite, or filesystem)
- Sync is eventually consistent via CRDTs or OT
- No server is required for single-user operation
- Multi-peer sync uses a conflict-free merge strategy

## Consequences

- Storage layer must support offline reads and writes
- Sync engine must handle merge conflicts deterministically
- Editor state must be serializable for sync transport
