# Signal

A local-first collaborative knowledge workspace with evolving architecture.

## Recommended Greenfield Layout

```text
signal/
├─ app/
├─ workspace/
├─ .loom/
├─ .weave/
└─ docs/
```

## Application Code (`app/`)

```text
app/
├─ src/
│  ├─ core/
│  ├─ sync/
│  ├─ storage/
│  ├─ editor/
│  ├─ graph/
│  ├─ ai/
│  ├─ plugins/
│  └─ ui/
├─ tests/
├─ package.json
└─ tsconfig.json
```

## Workspace Cognition Inputs (`workspace/`)

```text
workspace/
├─ goals/
│  ├─ local-first.md
│  ├─ realtime-sync.md
│  └─ plugin-runtime.md
├─ architecture/
│  ├─ decisions/
│  ├─ experiments/
│  └─ constraints/
├─ tasks/
├─ observations/
└─ history/
```

## Loom / Weave Runtime State

Loom persists its semantic graph in a single SQLite database. The `.loom/` directory
is created by `loom init` and contains:

```text
.loom/
├─ config.json          # workspace metadata: graphId, name, type, dbPath, LLM config
├─ loom.db              # SQLite semantic graph (nodes, edges, mutations, evidence)
├─ snapshots/           # timestamped backups created by loom snapshot
└─ artifacts/           # generated output files (weave exports, agent rules)
```

Weave persists its substrate in a single SQLite database. The `.weave/` directory
contains:

```text
.weave/
├─ config.json          # RuntimeConfig: decay, propagation, tick interval, thresholds
└─ substrate.db         # SQLite substrate (nodes, edges, tensions, events, snapshots)
```

### Data flow

```text
Source code + git history
  → Loom (crystallizes structural knowledge into .loom/loom.db)
  → LoomExport (nodes, edges, clusters via loom-exporter)
  → Weave (imports into substrate, assigns activation, tracks tensions)
  → ExecutionIntent (when activation thresholds fire)
  → Utilis (executes: model inference, shell, tools, workflows)
  → IntentResult (feedback: success/error/partial/timeout)
  → Weave (ingests result, updates graph, resolves tensions)
```

## Suggested Development Flow

```bash
# initialize project
mkdir signal && cd signal
pnpm init
mkdir -p app/src workspace

# initialize and onboard — creates .loom/, analyzes source, crystallizes knowledge
loom onboard

# Loom exports structural graph for Weave consumption
# (LoomExporter builds LoomExport from the semantic graph)

# Weave runtime starts, imports Loom export, runs tick loop
# runtime.importFromLoom(export)  — merges into substrate
# runtime.start()                 — begins tick-based scheduling

# Weave fires execution intents when activation thresholds cross
# runtime.dispatchIntent(intent)  — Utilis handles execution

# Query the system (available after onboard completes)
loom topology           # visualize dependency graph
loom lineage <path>     # trace why something exists
loom explain <node>     # explain with evidence
```

The app remains normal software engineering code. Loom and Weave provide persistent structural and runtime cognition layers around it.
