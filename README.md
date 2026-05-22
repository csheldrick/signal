# Signal

A local-first collaborative knowledge workspace, developed under continuous observation
by Loom, Weave, and Utilis.

Signal is not just an application. It is the living demonstration of the framework's
ability to crystallize architectural intent, detect drift, accumulate tensions from
real boundary violations, and dispatch AI execution in response — all from the command
line, with no custom harness code.

---

## Prerequisites

Install and link the framework CLIs from sibling repos:

```bash
# From loom/ — install the loom CLI
cd ../loom && pnpm install && pnpm build
npm link  # makes `loom` available globally

# From weave/ — install the weave CLI and its optional deps
cd ../weave && npm install && npm run build
npm link  # makes `weave` available globally

# From utilis/ — build @utilis/core (required for --utilis flag)
cd ../utilis && pnpm install && pnpm build
```

For AI execution (`weave run --utilis`), configure a provider in `~/.utilis/config.yaml`.
The GitHub Copilot provider works with no explicit API key if `gh auth login` has been run.

---

## Framework Workflow

### 1. Crystallize

Analyse Signal's source code and build the semantic graph:

```bash
cd signal
loom onboard .
```

This runs `init → explore → crystallize → topology` in one command. The graph is
persisted in `.loom/loom.db`.

### 2. Import into Weave

Pull the Loom graph into the cognitive substrate:

```bash
weave import
```

No arguments needed. Weave reads `.loom/config.json` and `.loom/loom.db` automatically,
calls `LoomExporter.buildExport()`, and merges the result into `.weave/substrate.db`.
Node activation is preserved across reimports.

### 3. Run the framework loop

**With Utilis (full loop — operators + AI execution):**

```bash
weave run --ticks 30 --utilis
```

This registers contradiction detection and graph clustering operators, wires the Utilis
intent handler from `~/.utilis/config.yaml`, and registers an execution trigger that
fires a `code_review` intent for any node whose activation exceeds 0.7.

**Without Utilis (operators only):**

```bash
weave run --ticks 30
```

### 4. Inspect results

```bash
weave status                 # overview: node count, total activation, pressure, tensions
weave inspect nodes          # all nodes sorted by activation
weave inject tensions        # unresolved architectural tensions
```

---

## Drift Detection

When code changes, recrystallise and reimport. Weave merges the update and injects
activation at changed nodes.

```bash
# Make a change in app/src/
# ...

loom explore .               # reanalyse changed files
weave import                 # merge updated graph (activation preserved)
weave run --ticks 10         # run operators — new tensions surface at changed nodes
weave inspect tensions       # see what drifted
```

---

## Manual Exploration

Inject activation at a specific node to simulate change pressure and watch it cascade:

```bash
weave inspect nodes          # find node IDs
weave inject <node-id> 0.8   # inject at a node
weave run --ticks 10         # observe propagation through the dependency graph
weave inspect nodes          # see updated activation heatmap
```

Save and restore substrate state:

```bash
weave snapshot before-refactor
# ... make changes ...
weave restore <snapshot-id>
```

---

## Architecture

Signal's 20 source files across 8 subsystems are structured to produce a rich Loom
graph (≥20 nodes, ≥15 edges) with deliberate boundary violations that Weave detects
as architectural tensions.

```text
app/src/
├─ core/          types hub (Document, DocumentLink, SearchQuery) + SignalApp bootstrap
├─ storage/       DocumentStore (CRUD + JSON persistence) + StorageEventBus
├─ sync/          VectorClock eventual-consistency: protocol, engine, conflict, queue, session, manager
├─ graph/         GraphBuilder — clustering and hub detection from document links
├─ plugins/       PluginHost sandbox + SearchPlugin (⚠ boundary violation) + ExportPlugin
├─ ai/            Summarizer interface + LocalSummarizer (extractive)
├─ editor/        High-level CRUD operations
├─ ui/            Text rendering
├─ indexing/      InvertedIndex full-text search (IDF scoring)
├─ collaboration/ PresenceTracker (⚠ compound boundary violation)
└─ versioning/    Immutable VersionHistory with lineage chains
```

**Deliberate boundary violations** — these are structural flaws seeded for Weave to detect:

- `plugins/search.ts` imports `DocumentStore` directly, bypassing the `PluginContext` sandbox
- `collaboration/presence.ts` imports both `DocumentStore` and `SyncEngine` directly (two violations)

When Weave's `ContradictionDetectionOperator` runs, these direct imports appear as
`contradicts` edges between plugin nodes and storage/sync nodes, generating
`contradiction` tensions.

---

## Data Flow

```text
app/src/ + git history
  → loom onboard .           crystallize into .loom/loom.db
  → weave import             build LoomExport, merge into .weave/substrate.db
  → weave run --ticks N      activation propagates, operators detect tensions
  → ExecutionIntent          fires when node activation > 0.7 (with --utilis)
  → Utilis                   routes to configured provider, runs code_review
  → IntentResult             success/error/partial fed back into substrate
  → graph state updated      execution_result node created, tensions resolved or created
```
