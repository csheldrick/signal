# Local-First

Signal must support offline-first collaboration and retain local ownership of data.

## Requirements

- All reads and writes work without network connectivity
- Data is stored locally before any sync occurs
- Users maintain ownership and control of their data
- No server dependency for single-user operation
- Sync is additive — local state is never overwritten by remote state without merge

## Loom/Weave implications

- Loom's `.loom/loom.db` is local-only — no sync needed for structural analysis
- Weave's `.weave/substrate.db` is local-only — cognitive state stays on-device
- Signal's own storage must use a local-first database (SQLite, IndexedDB, or similar)
