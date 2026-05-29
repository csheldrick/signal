# loom + weave + utilis: Framework

Full framework use cases, including integration with Utilis for intent handling and execution.

**Generative-first (2026-05-29):** Signal now bootstraps **generatively** by default —
`weave bootstrap --utilis` re-derives context from the live graph + `workspace/` docs
instead of replaying a curated inject list. The loop runs `weave run --generative` →
`weave evolve` (generation + fitness selection against the app test suite), with `weave
resolve` reserved for pure tension repair. The curated inject list below is retained as a
**regression baseline** at `scripts/baselines/signal_bootstrap.curated.json`; the headline
metric is the *rediscovery rate* reported by `scripts/check_bootstrap_drift.sh`, not the
patch count. See ADR-004 and EXP-006 / EXP-007 in `workspace/architecture/`. The block
below documents the curated baseline and the inject vocabulary it uses.

**Key behaviour (2026-05-22):** `weave inject --type` auto-wires observations to Loom-imported
structural nodes via fuzzy label matching. Each injection type creates a typed edge:
`goal→supports`, `architecture/observation→related_to`, `constraint→blocks`, `hypothesis→predicts`,
`tension→contradicts`. Without this wiring, injected nodes are islands and activation cannot
propagate to the structural graph.

The execution trigger fires for `concept`, `observation`, and `subsystem` nodes with
activation ≥ 0.3. The trigger handler is async — `evaluate()` awaits the handler so
`dispatchIntent()` completes before `runtime.shutdown()`.

```plaintext
weave — Continuity Runtime CLI

Usage:
  weave inject --type <type> "<description>"   Inject an observation (auto-wires to structural nodes)
  weave inject <nodeId> <amount>               Inject activation directly at a node (legacy)
  weave bootstrap --utilis [--dry-run] [--save <f>]  DERIVE seed context from the graph + workspace/ docs
  weave bootstrap --from <file>                Replay a curated inject list (regression baseline)
  weave observe activation                     Show activation field — nodes sorted by activation
  weave observe tensions                       Show inferred and manual tensions by pressure (with IDs)
  weave observe clusters                       Show detected subsystem clusters and their members
  weave status                                 Show runtime state summary
  weave run [--ticks <n>] [--utilis] [--generative]  Run N ticks; operators derive tensions / emit goals
  weave evolve [--variants <k>] [--dir <path>] Spawn K variants per goal, score by tests, retain fittest
  weave resolve [--loop]                       Repair tensions (pure tension repair, no generation)
  weave import [source]                        Import Loom graph (default: .loom/ database, or JSON file)
  weave tension <kind> <node1,node2> <pressure>  Manually author a tension (use when inference is insufficient)
  weave delete tension <id>                    Hard-delete a tension by ID
  weave edit tension <id> [options]            Edit a tension's kind, sources, and/or pressure
  weave snapshot <label>                       Save a named snapshot
  weave restore <snapshotId>                   Restore from a snapshot
  weave inspect nodes                          List nodes (alias for: observe activation)
  weave inspect tensions                       List tensions (alias for: observe tensions)

Edit options:
  --kind <kind>          New tension kind
  --sources <n1,n2,...>  New comma-separated source node IDs
  --pressure <float>     New pressure value

Options:
  --db <path>      SQLite database path (default: .weave/substrate.db)
  --config <path>  Config JSON file     (default: .weave/config.json)

Injection types:
  tension  architecture  observation  constraint  goal  hypothesis

Tension kinds (manual):
  failing_test  contradiction  architectural_instability  unresolved_todo
  cyclic_dependency  boundary_erosion  subsystem_overload  semantic_duplication
  uncertainty  execution_failure  pressure_accumulation  activation_attractor

Inferred automatically by operators during `weave run`:
  cyclic_dependency   — mutual dependency cycles in depends_on/imports edges
  boundary_erosion    — high cross-subsystem coupling between cluster pairs
  subsystem_overload  — high-degree nodes under sustained activation
```

```bash
loom onboard 
weave import
weave inspect nodes
# COPILOT INSERT HERE

# ── Goals ─────────────────────────────────────────────────────────────────────
# What Signal should achieve — drives activation toward capability gaps

weave inject --type goal "Offline-first operation: all document CRUD, search, and graph traversal must work without network connectivity"
weave inject --type goal "CRDT-based collaborative editing: concurrent edits on the same document merge without user-facing conflicts"
weave inject --type goal "Persistent full-text index: InvertedIndex must survive process restart without full reindex from document store"
weave inject --type goal "LLM-powered summarization: replace LocalSummarizer stub with provider-backed implementation via Utilis"
weave inject --type goal "Plugin isolation enforcement: runtime validation that plugins cannot import outside PluginContext"
weave inject --type goal "Version branching and merge: support non-linear version histories with three-way merge on convergence"
weave inject --type goal "Graph-driven navigation: traverse document link topology visually with cluster-aware layout"
weave inject --type goal "Sync message durability: outbound messages that exhaust retry budget must persist to disk for later delivery"

# ── Architecture ──────────────────────────────────────────────────────────────
# Structural observations about how Signal is built — seeds subsystem nodes

weave inject --type architecture "Hub-and-spoke: DocumentStore is the highest fan-in node — storage, sync, graph, versioning, indexing, and plugins all depend on it"
weave inject --type architecture "Event-driven decoupling: StorageEventBus mediates all mutation side-effects; consumers subscribe via wildcard or typed events"
weave inject --type architecture "Plugin sandbox boundary: PluginHost exposes PluginContext (read-only) to isolate third-party code from direct store access"
weave inject --type architecture "Dual graph topology: spatial edges (DocumentLink via reference/related/derived_from/blocks) and temporal edges (VersionHistory parentVersionId chains) coexist"
weave inject --type architecture "Vector clock causality: SyncEngine uses per-peer monotonic clocks with entrywise-max merge for conflict detection"
weave inject --type architecture "Sync transport abstraction: SyncManager accepts any async send function — WebSocket, WebRTC, or direct call — no protocol lock-in"
weave inject --type architecture "Immutable version snapshots: VersionHistory freezes every snapshot with Object.freeze; lineage chains are append-only"
weave inject --type architecture "Separation of editing from storage: editor/operations.ts wraps store methods with ID generation but adds no business logic"

# ── Observations ──────────────────────────────────────────────────────────────
# What has been noticed in the codebase — high-activation signals for drift

weave inject --type observation "SearchPlugin bypasses PluginContext and imports DocumentStore directly — violates the plugin sandbox contract"
weave inject --type observation "PresenceTracker imports both DocumentStore and SyncEngine, creating a compound boundary violation across two subsystems"
weave inject --type observation "LocalSummarizer is a sentence-extraction heuristic stub with no LLM integration — the Summarizer interface is unfulfilled"
weave inject --type observation "InvertedIndex stores all posting lists in memory with no serialization — every cold start requires full reindex"
weave inject --type observation "SyncQueue drops messages permanently after 5 retry attempts with no dead-letter persistence"
weave inject --type observation "VersionHistory diffs are line-based string comparison — no awareness of CRDT operations or semantic merge"
weave inject --type observation "DocumentStore.delete cascades link removal but does not cascade to VersionHistory — orphaned version chains persist"
weave inject --type observation "GraphBuilder.findClusters uses BFS connected components but has no feedback path to SyncManager for prioritizing cluster-local sync"
weave inject --type observation "StorageEventBus has no backpressure mechanism — a burst of mutations can flood subscribers synchronously"
weave inject --type observation "SyncEngine generates outbound messages for every storage event but applies no batching or coalescing for rapid edit sequences"

# ── Constraints ───────────────────────────────────────────────────────────────
# Rules the system must obey — violations create tensions

weave inject --type constraint "Every document mutation (create, update, delete, link) must emit a StorageEvent before returning"
weave inject --type constraint "Plugins must access documents exclusively through PluginContext — no direct store imports"
weave inject --type constraint "Vector clocks must be monotonically non-decreasing per peer across all sync operations"
weave inject --type constraint "Version snapshots are immutable after creation — no retroactive edits to historical versions"
weave inject --type constraint "Document IDs must be globally unique across all peers in a sync group"
weave inject --type constraint "Conflict resolution must produce an auditable ConflictRecord for every merge decision"
weave inject --type constraint "Storage serialization format must remain JSON-compatible for local-first portability"
weave inject --type constraint "Sync messages must be idempotent — replaying a message produces the same state as applying it once"

# ── Hypotheses ────────────────────────────────────────────────────────────────
# Predictions about system behavior — validated or contradicted during weave run

weave inject --type hypothesis "SearchPlugin direct store access will cause stale search results when documents are modified through sync (bypasses event pipeline)"
weave inject --type hypothesis "PresenceTracker importing SyncEngine creates a hidden circular dependency path: App→Sync→Store←Presence→Sync"
weave inject --type hypothesis "Without index persistence, startup latency grows linearly with document count — unacceptable at 10k+ documents"
weave inject --type hypothesis "SyncQueue message drops after 5 retries will cause permanent data divergence between peers in unreliable networks"
weave inject --type hypothesis "Deleting a document without cascading to VersionHistory will cause getLineage to return orphaned chains with dangling references"
weave inject --type hypothesis "Concurrent rapid edits without SyncEngine batching will generate O(n) sync messages where O(1) coalesced message suffices"
weave inject --type hypothesis "The StorageEventBus wildcard subscriber pattern will become a bottleneck when plugin count exceeds 10 active subscribers"
weave inject --type hypothesis "Line-based version diffs will produce false conflicts when two peers edit non-overlapping sections of the same document"

# ── Tensions ──────────────────────────────────────────────────────────────────
# Unresolved pressures in the system — sustain activation until addressed

weave inject --type tension "Plugin sandbox claims isolation but SearchPlugin proves it is unenforced — architectural intent contradicts implementation"
weave inject --type tension "Local-first goal requires offline persistence but InvertedIndex and SyncQueue are memory-only with no disk fallback"
weave inject --type tension "SyncEngine has conflict resolution strategies but VersionHistory has no merge capability — sync and versioning are disconnected"
weave inject --type tension "StorageEventBus enables decoupling but PresenceTracker bypasses it entirely by importing subsystems directly"
weave inject --type tension "Summarizer interface declares an AI capability boundary but the only implementation is a non-AI heuristic stub"
weave inject --type tension "GraphBuilder detects document clusters but no component consumes cluster data for sync prioritization or UI grouping"
weave inject --type tension "Version snapshots are immutable but document content is mutable — the versioning layer has no trigger to auto-snapshot on edit"
weave inject --type tension "SyncManager supports pluggable transport but no concrete transport adapter exists — the abstraction is untested"

weave run --ticks 30 --utilis
weave observe tensions
weave observe activation
weave observe clusters


```
