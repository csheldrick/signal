# Signal

A local-first collaborative knowledge workspace, developed under continuous observation
by Loom, Weave, and Utilis.

Signal is not just an application. It is the living demonstration of the framework's
ability to crystallize architectural intent, **grow new capability in response to
pressure**, and **select competing approaches by externally-grounded fitness** (Signal's
own test suite) — all from the command line, with no custom harness code.

Signal used to be a *fixture*: a curated inject list was replayed and the framework
"discovered" exactly what a human had planted. It is now **generative-first** (see
[ADR-004](workspace/architecture/decisions/004-generative-fitness-model.md)). Context is
re-derived from the live graph and the `workspace/` docs; the curated list survives only
as a regression baseline, and the headline metric is the **rediscovery rate** — how much
hand-authored insight the system re-derives on its own.

---

## Prerequisites

Install and link the framework CLIs from sibling repos:

```bash
# From loom/ — install the loom CLI
cd ../loom && pnpm install && pnpm build
npm link  # makes `loom` available globally

# From derive/ — install the derive CLI and its optional deps
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

### 3. Bootstrap context (generative by default)

Seed the substrate with semantic context. The default is **generative**: an LLM
re-derives goals/observations/tensions from the live graph and the `workspace/` docs.

```bash
weave bootstrap --utilis            # derive context from the graph + workspace/ docs
```

The `--curated` mode of `scripts/framework_bootstrap.sh` instead replays the
hand-authored baseline at `scripts/baselines/signal_bootstrap.curated.json`, which is
kept as a **regression baseline**, not the source of truth:

```bash
./framework_bootstrap.sh            # generative (default)
./framework_bootstrap.sh --curated  # replay the curated baseline
```

Compare the two — the demo's real headline metric is *rediscovery rate*, not patch count:

```bash
scripts/check_bootstrap_drift.sh    # how much curated insight the system re-derives
```

### 4. Run the framework loop

**With Utilis (full loop — operators + AI execution):**

```bash
weave run --ticks 30 --utilis
```

This registers contradiction detection, graph clustering, and inference operators
(cyclic-dependency, boundary-erosion, subsystem-overload), wires the Utilis intent
handler from `~/.utilis/config.yaml`, and registers an execution trigger that fires
a `code_review` intent for any `concept`, `observation`, or `subsystem` node whose
activation exceeds 0.3.

**Without Utilis (operators only):**

```bash
weave run --ticks 30
```

### 5. Evolve: grow and select capability

Where `weave run` propagates activation and `weave resolve` repairs tensions, `weave
evolve` **generates** candidate implementations for active goals, runs each one, and
**selects** the fittest by Signal's own test suite (`TestFitnessProbe`), pruning the
rest. Each variant is evaluated in its own git worktree for isolation.

```bash
weave evolve --variants 4 --dir app   # spawn 4 variants, score by app tests, retain fittest
```

Each generative goal carries a *targeted* grounding test (e.g.
`app/tests/summarizer.test.ts` for the `Summarizer` capability), so a variant is scored
only against the tests that ground its goal. See
[ADR-004](workspace/architecture/decisions/004-generative-fitness-model.md) for the
fitness-probe and worktree-isolation contract, and EXP-006 / EXP-007 for the experiments.

### 6. Inspect results

```bash
weave status                 # overview: node count, total activation, pressure, tensions
weave observe activation     # top 25 nodes by activation (bar chart)
weave observe tensions       # unresolved tensions sorted by pressure
weave observe clusters       # detected subsystem clusters and their members
```

### 7. Inject semantic observations

The `weave inject --type <type> "<description>"` command creates an observation node
and auto-wires it to structurally relevant Loom-imported nodes via fuzzy label matching.
See `.context/framework-info.md` for a complete library of inject commands covering all
six categories: `goal`, `architecture`, `observation`, `constraint`, `hypothesis`, `tension`.

```bash
weave inject --type tension "Plugin sandbox claims isolation but SearchPlugin proves it is unenforced"
weave inject --type goal "Persistent full-text index: InvertedIndex must survive process restart"
weave inject --type hypothesis "SearchPlugin direct store access will cause stale search results"
weave run --ticks 10 --utilis
weave observe tensions
```

Each injection type maps to a specific edge type (`supports`, `contradicts`, `predicts`,
`blocks`, `related_to`) so activation flows correctly through the structural graph.

---

## Drift Detection

When code changes, recrystallise and reimport. Weave merges the update and injects
activation at changed nodes.

```bash
# Make a change in app/src/
# ...

loom explore .                # reanalyse changed files
weave import                  # merge updated graph (activation preserved)
weave run --ticks 10 --utilis # run operators — new tensions surface at changed nodes
weave observe tensions        # see what drifted
```

---

## Manual Exploration

Inject activation at a specific node to simulate change pressure and watch it cascade:

```bash
weave inspect nodes           # find node IDs
weave inject <node-id> 0.8    # inject at a node
weave run --ticks 10 --utilis # observe propagation through the dependency graph
weave inspect nodes           # see updated activation heatmap
```

Save and restore substrate state:

```bash
weave snapshot before-refactor
# ... make changes ...
weave restore <snapshot-id>
```

---

## Architecture

Signal's source files across 8 subsystems produce a rich Loom graph (≥20 nodes,
≥15 edges). Tensions are no longer pre-seeded — they surface from **emergent** structure
as the generated code grows.

```text
app/src/
├─ core/          types hub (Document, DocumentLink, SearchQuery) + SignalApp bootstrap
├─ storage/       DocumentStore (CRUD + JSON persistence) + StorageEventBus
├─ sync/          VectorClock eventual-consistency: protocol, engine, conflict, queue, session, manager
├─ graph/         GraphBuilder — clustering and hub detection from document links
├─ plugins/       PluginHost sandbox + SearchPlugin + ExportPlugin (PluginContext-only)
├─ ai/            Summarizer interface + LocalSummarizer (extractive) + RemoteSummarizer (opt-in)
├─ editor/        High-level CRUD operations
├─ ui/            Text rendering
├─ indexing/      InvertedIndex full-text search (IDF scoring)
├─ collaboration/ PresenceTracker (PluginContext-sandboxed)
└─ versioning/    Immutable VersionHistory with lineage chains
```

**No seeded boundary violations.** Earlier revisions hand-planted direct cross-subsystem
imports (`SearchPlugin` → `DocumentStore`, `PresenceTracker` → `DocumentStore` + `SyncEngine`)
for Weave to detect. Those have been refactored onto the `PluginContext` sandbox, so the
demo no longer tests recall of its own answer key — Weave's operators must find tensions
from structure that genuinely emerges. The curated baseline that described those
violations is retained at `scripts/baselines/signal_bootstrap.curated.json` only as a
rediscovery yardstick. See
[ADR-004](workspace/architecture/decisions/004-generative-fitness-model.md).

---

## Data Flow

```text
app/src/ + git history
  → loom onboard .              crystallize into .loom/loom.db
  → weave import                build LoomExport, merge into .weave/substrate.db
  → weave bootstrap --utilis    DERIVE seed from graph + READ workspace/ docs (no JSON replay)
  → weave run --ticks N         activation propagates; generative operators emit goals/hypotheses/capabilities
  → weave evolve --dir app      spawn variants → run → score by app tests → retain fittest, prune rest
                                └─ WRITE-BACK: results appended to workspace/ experiments & observations
  → ExecutionIntent             fires when node activation > 0.3 (with --utilis)
  → Utilis                      routes to configured provider, runs code_review
  → IntentResult                success/error/partial fed back into substrate
  → graph state updated         execution_result node created, tensions resolved or created
  → check_bootstrap_drift.sh    report rediscovery rate vs the curated baseline
```

The `workspace/` docs are part of the loop, not orphaned inputs: the `docs` bridge in
`.weave/config.json` ingests `workspace/goals|observations|architecture|tasks` as seed
context and writes experiment/selection outcomes back into the matching files (see
ADR-004 and the `docs.output` config).
