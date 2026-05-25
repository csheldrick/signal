# Signal — Copilot Instructions

## What Signal Is

Signal is a local-first collaborative knowledge workspace. Its source lives in `app/` and its cognition inputs (goals, architecture decisions, observations, tasks) live in `workspace/`. Runtime state is persisted by Loom (`.loom/`) and Weave (`.weave/`).

---

## Companion Systems

Signal is built in concert with three companion systems: **Utilis**, **Loom**, and **Weave**. These systems do not live in this repository, but their contracts, exports, and interfaces are active here. The sections below give a full account of each.

---

## Utilis

**Tagline:** One harness. Every model.

Utilis is a self-learning agentic LLM harness. It unifies multiple AI providers behind a single interface, routes tasks to the optimal model based on type and complexity, collects workspace context automatically, and tunes its own routing decisions over time via logged feedback.

### Packages

| Package | Description |
|---|---|
| `@utilis/core` | Provider adapters, router, workspace collector, agent, learning system, plugin/skill system |
| `@utilis/cli` | `utilis` CLI binary, interactive tabbed shell, rich terminal UI |
| `@utilis/sdk` | `UtilisClient` for embedding Utilis in applications |
| `@utilis/workflows` | Multi-step workflow engine with DAG execution |

### Supported Providers

- **Anthropic** — Claude (Opus, Sonnet, Haiku) via `@anthropic-ai/sdk`
- **OpenAI** — GPT models via the `openai` SDK
- **GitHub Copilot** — GPT and Claude models via `api.individual.githubcopilot.com`; credentials resolved from config `api_key`, `GITHUB_TOKEN`/`GH_TOKEN`, or `gh auth token`; `X-Initiator: user|agent` header keeps agentic tool-loop iterations billed as one premium request; `X-Interaction-Id` UUID bundles each turn server-side
- **Google Gemini** — Gemini family via Google's OpenAI-compatible endpoint (`generativelanguage.googleapis.com/v1beta/openai/`); reads `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- **Groq** — Llama/Mixtral/DeepSeek/Gemma on Groq hardware; chosen for speed
- **OpenRouter** — Gateway to hundreds of models via `openrouter.ai/api/v1`; model IDs are `vendor/model` (e.g. `anthropic/claude-3.5-sonnet`)
- **Ollama** — Local models via NDJSON HTTP API
- **LM Studio** — OpenAI-compatible local server
- **llama.cpp** — OpenAI-compatible local server

### Routing

`Router.route(analysis)` scores all registered providers using static `PROVIDER_PROFILES` (quality/speed/cost/local weights) combined with task type and complexity. Routing modes: `auto` | `quality` | `speed` | `cost` | `local-first` | `cloud-first`.

Task types: `code_generation` | `code_review` | `refactor` | `explain` | `test_generation` | `text_generation` | `documentation` | `debugging` | `writing` | `brainstorm` | `general`

Complexity tiers: `low` | `medium` | `high` | `critical`

### Request Lifecycle

```
utilis run "<prompt>"
  ├─ WorkspaceCollector.collect(cwd)         git diff, README, tsconfig, source files
  ├─ analyzeTask()                           detectTaskType() + detectComplexity()
  ├─ Router.route(analysis)                  score providers → RouteDecision
  └─ ProviderAdapter.complete(request)       withRetry() — exponential backoff (3×, 1s–30s)
```

### Config

Located at `~/.utilis/config.yaml`. Optional — all fields have Zod defaults. Environment variables use `${VAR_NAME}` syntax. Internal types are camelCase; YAML is snake_case — translation happens once in `config/loader.ts::normalize()`.

### Skills & Plugins

Skills are reusable parameterized prompt templates (`{{varName}}` interpolation, `{{output.<skillId>}}` composition). Multiple prompt variants are tracked per skill and tuned by `SkillTuner` via feedback + latency scoring. Plugins bundle skills, executable tools, lifecycle hooks, and agent instructions. Run logs at `~/.utilis/skill-interactions.jsonl`.

### Notes, Todos & Tasks

- **Notes** (`~/.utilis/notes.json`) — persistent context injected into agent prompts; support pinning
- **Todos** (`~/.utilis/todos.json`) — personal tracking with status (`open` | `in_progress` | `done`); open/in-progress items appear in agent context
- **Tasks** (`~/.utilis/tasks.json`) — agent-executable job queue; supports composition to chain outputs
- **Daily notes** (`~/.utilis/daily/YYYY-MM-DD.json`) — scratch notes injected as `<daily_context>` into every session

### Interactive Shell

`utilis` (no args) opens a rich tabbed terminal UI. Each tab owns its own `Agent`, `Router`, and conversation history. Key bindings: `^T` new tab, `^W` close, `^N`/`^P` switch, `^R` resume session picker, `^S` save transcript, `^Y` copy last reply. `utilis chat` opens the classic single-shell REPL.

### Self-Learning

`AutoTuner.maybeTune()` runs on every CLI invocation. When the configured cadence (daily/weekly/monthly) has elapsed and ≥5 interaction samples exist, `RouterTuner` converts per-(provider, model) feedback weights to per-provider routing bias (`[-0.4, +0.4]`). All interactions logged to `~/.utilis/interactions.jsonl` (append-only JSONL).

### Resilience

All provider calls are wrapped in `withRetry()` (exponential backoff, 1s base, 30s cap, 3 attempts, jitter). Retries on: network errors (ECONNRESET, ETIMEDOUT), rate limits (429), server errors (5xx). Client errors (4xx except 429) are not retried.

### SDK Integration

`UtilisClient` from `@utilis/sdk` provides a clean embedding API. Weave integrates via a single `ExecutionHandler` function: `(payload: ExecutionPayload) => Promise<ExecutionResult>`. Weave never touches provider internals, model selection, or routing — it only sees results.

---

## Loom

**Tagline:** Brownfield comprehension and operational continuity.

Loom is a persistent software comprehension system. It targets large, underdocumented codebases where architectural intent has eroded over time. Loom continuously crystallizes knowledge from source code, git history, and runtime behavior into a structured, versioned, graph-based representation that survives model changes and reduces inference dependence.

### What Loom Is / Is Not

Loom IS: a semantic comprehension runtime, a graph-based architectural memory system, a brownfield onboarding accelerator, an operational continuity layer, a runtime governance engine.

Loom is NOT: a chatbot, a chatbot framework, a general autonomous agent, a vector database wrapper, a prompt accumulation system, or a static code generation tool.

### Packages

| Package | Description |
|---|---|
| `@loom/types` | Core interfaces, Zod schemas, discriminated unions for all graph node types |
| `@loom/graph` | SQLite-backed semantic graph; versioned nodes, typed edges, mutation history |
| `@loom/llm` | LLM provider abstraction (includes a `CopilotProvider`); used for semantic extraction where heuristics fall short |
| `@loom/agents` | Agent orchestration: explorer, historian, architect, field-inferrer, import agents |
| `@loom/runtime` | Shadow runtime and drift detection; observes live systems against the comprehension model |
| `@loom/evolution` | Evolution engine; proposes spec mutations with confidence scores and rollback history |
| `@loom/continuity` | Local-first memory adapter; cross-session persistence backbone |
| `@loom/mcp` | MCP server; exposes Loom operations to IDE agents and Copilot |
| `@loom/cli` | Interactive CLI; all user-facing commands and workspace management |

### Core Concepts

- **MemoryNode** — typed graph node with `id`, `type`, `summary`, `relationships`, `evidence[]`, `confidence` (0–1), `createdAt`, `updatedAt`
- **Crystallization** — pipeline that transforms raw source and history into durable typed graph nodes with evidence and confidence scores; crystallized knowledge survives session boundaries
- **Lineage** — evolutionary history of a component extracted from git commits, PR descriptions, blame, and ADRs; a first-class graph primitive
- **Contract** — formal operational interface (inputs, outputs, guarantees, invariants, validation rules); inferred from implementation for brownfield systems
- **Adapter** — maps contracts onto real implementations (filesystem, git, TypeScript AST, database schema, LSP, external APIs)
- **Drift** — divergence between the crystallized comprehension model and the actual codebase; detected and reconciled, never silently accumulated
- **Continuity Graph** — persistent semantic graph connecting files, symbols, contracts, workflows, observations, and decisions across sessions

### Local Persistence (`.loom/`)

```
.loom/
├─ config.json      # workspace metadata: graphId, name, type, dbPath, LLM config
├─ loom.db          # SQLite semantic graph (nodes, edges, mutations, evidence)
├─ snapshots/       # timestamped backups created by loom snapshot
└─ artifacts/       # generated output (weave exports, agent rule files)
```

### CLI Commands

```bash
loom onboard .          # full brownfield onboarding in one command
loom explore .          # crystallize comprehension from source
loom lineage <path>     # trace why something exists (git archaeology)
loom topology           # visualize architectural dependency graph
loom invariants         # list detected/formalized invariants
loom audit              # compare runtime against spec
loom drift              # detect divergence from the comprehension model
loom derive              # derive specs from the comprehension layer
loom evolve             # propose evolution grounded in graph evidence
loom reconcile          # surface and resolve drift
loom explain <node>     # explain a graph node with evidence
loom diff               # show spec mutation history
loom obsidian           # project semantic graph into an Obsidian vault
```

### Loom → Weave Export

Loom publishes a `LoomExport` struct that Weave consumes to seed its substrate:

```typescript
interface LoomExport {
  nodes: LoomNode[];          // id, kind, name, path?, metadata?
  edges: LoomEdge[];          // source, target, kind, weight (0–1), metadata?
  clusters?: LoomCluster[];   // id, name, members (node ids)
  metadata?: {
    timestamp?: number;       // ms since epoch
    commitSha?: string;
    repository?: string;
  };
}
```

Node kind mapping to Weave substrate types: `file→file`, `function→function`, `class→class`, `module/package→subsystem`, `interface/type→abstraction`, everything else → `concept`.

### Invariants

- Every workflow execution is observable
- Every transformation is reversible
- Contracts are versioned
- Memory nodes require evidence
- Semantic relationships are typed
- No inference-only state is trusted permanently
- Crystallized knowledge is never silently invalidated

### AI Integration

AI augments comprehension extraction, contract inference, lineage interpretation, and architecture reasoning. AI is never the primary memory store (the graph is). All AI-driven changes are explainable, observable, reviewable, and reversible. AI inference quality should decrease over time as crystallized knowledge grows — the graph displaces the prompt.

`@loom/llm` ships a `CopilotProvider` that calls the GitHub Copilot HTTP API directly. Credentials: `GITHUB_TOKEN` → `LOOM_GITHUB_TOKEN` → `gh auth token`. Default model: `gpt-5-mini`.

---

## Weave

**Tagline:** Persistent cognitive substrate runtime.

Weave is the middle layer between Loom (structural world model) and Utilis (execution/capability layer). It maintains evolving world state through activation propagation, tension accumulation, and operator-driven graph mutation. Weave is not an agent, chatbot, or planner — it is a dynamical system.

### What Weave Does / Does Not Do

Weave DOES: maintain a persistent substrate graph, propagate activation, track tensions, schedule operators, import Loom structure, dispatch execution intents to Utilis, ingest results and update graph state.

Weave does NOT: parse source code, analyze ASTs, mine git history, maintain conversation state, implement autonomous agent loops, or use vector databases.

### Local Persistence (`.weave/`)

```
.weave/
├─ config.json      # RuntimeConfig: decay rates, propagation damping, tick interval, thresholds
└─ substrate.db     # SQLite substrate (nodes, edges, tensions, events, snapshots)
```

### Core Flow

```
External event (code change, test failure, user request)
  ↓
Activation injection → nodes gain activation
  ↓
Propagation engine  → activation spreads through weighted edges (damping factor applied)
  ↓
Temporal decay      → activation diminishes over time
  ↓
Tension accumulation → unresolved states sustain pressure (Tension nodes persist until resolved)
  ↓
Scheduler           → selects operators when node activation crosses configured thresholds
  ↓
Operators           → mutate graph state (create/update SubstrateNodes and SubstrateEdges)
  ↓
Feedback            → MutationResults inject new activation back into the graph
```

### Key Types

```typescript
SubstrateNode    — id, type, label, state, activation (float), confidence (float), createdAt, updatedAt, metadata
SubstrateEdge    — id, source, target, type, weight (0–1), decay (rate), confidence, createdAt, metadata
SubstrateEvent   — id, type, timestamp, payload (append-only event log)
Tension          — id, kind, pressure (float), sourceNodes, createdAt, resolvedAt?
Operator         — descriptor (id, name, triggerTypes, minActivation) + execute(context) => MutationResult
MutationResult   — nodesCreated, nodesUpdated, edgesCreated, edgesUpdated, tensionsCreated, tensionsResolved
RuntimeConfig    — decayRate, propagationDamping, tickIntervalMs, activationThreshold, confidenceDecay
```

### Node Types

`file` | `function` | `class` | `subsystem` | `concept` | `task` | `issue` | `abstraction` | `execution_result` | `hypothesis` | `contradiction` | `goal` | `tension` | `capability`

### Edge Types

`depends_on` | `supports` | `contradicts` | `derived_from` | `caused_by` | `predicts` | `blocks` | `resolves` | `related_to` | `co_edited` | `imports`

### Built-in Operators

- **contradiction-detection** — detects contradicting nodes/edges and creates `contradiction` nodes
- **graph-clustering** — label propagation clustering → `subsystem` nodes
- **execution-triggers** — fires `ExecutionIntent` when node activation crosses threshold

### Weave ↔ Loom Boundary

Loom owns structural intelligence. Weave owns graph dynamics. The interface is a **one-way structural export**: Loom pushes a `LoomExport`; Weave consumes it via `loom-adapter.ts` and assigns initial activation. Loom must never assign activation, manage tensions, or influence scheduling. Weave must never parse source code or mine git history.

### Weave ↔ Utilis Boundary

Weave owns cognition state. Utilis owns execution capability. When activation and tension cross configured thresholds, Weave emits an `ExecutionIntent`. Utilis handles it via a single registered callback:

```typescript
type ExecutionHandler = (payload: ExecutionPayload) => Promise<ExecutionResult>;
runtime.setExecutionHandler(handler);
```

Capability types Utilis can declare: `shell_exec` | `model_inference` | `file_operation` | `mcp_tool` | `api_call` | `test_runner` | `code_analysis`.

Utilis must never modify graph state directly, maintain activation state, or read/write to `substrate.db`. All feedback flows back through `ExecutionResult`.

### Engineering Principles

- Activation propagation is the core primitive — everything flows from injection / propagation / decay
- Tensions sustain pressure — they do not resolve automatically; they drive scheduling
- Operators are the only mutation path — all graph changes come from operator execution
- Deterministic substrate — stochastic behavior is isolated inside operators
- Event sourced — all mutations are logged as append-only `SubstrateEvent` records
- Temporal continuity — state evolves across sessions; it is not reset per invocation

---

## Data Flow: Source → Loom → Weave → Utilis

```
Source code + git history
  → loom explore .         crystallizes structural knowledge into .loom/loom.db
  → LoomExport             nodes, edges, clusters pushed to Weave
  → Weave substrate        activation injected, tensions accumulated, operators scheduled
  → ExecutionIntent        fired when activation threshold crossed
  → Utilis                 handles intent (model inference, shell, file ops, tools)
  → ExecutionResult        returned to Weave; graph state updated; new activation injected
```
