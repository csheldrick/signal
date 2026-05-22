# ADR-001: Ecosystem Integration Model

## Status

Accepted

## Context

Signal is a local-first collaborative knowledge workspace. It operates within an
ecosystem of three systems:

- **Loom** — structural comprehension (analyzes source, extracts semantic graphs)
- **Weave** — cognitive substrate runtime (activation propagation, tension tracking, scheduling)
- **Utilis** — execution capability layer (model inference, shell, tools, workflows)

Signal needs to define how it relates to these systems.

## Decision

Signal is a **target application** — the codebase that Loom analyzes, Weave maintains
cognitive state for, and Utilis executes work against.

### Data flow

```text
Signal source code + git history
  → Loom crystallizes structural knowledge (→ .loom/loom.db)
  → Loom exports LoomExport (nodes, edges, clusters)
  → Weave imports into substrate graph (→ .weave/substrate.db)
  → Weave fires ExecutionIntents when activation thresholds cross
  → Utilis executes (inference, shell, tools)
  → Utilis returns IntentResult (success/error/partial/timeout)
  → Weave ingests feedback, updates graph, resolves tensions
```

### Integration boundaries

| System | Owns | Does NOT own |
|--------|------|-------------|
| Loom | AST extraction, module boundaries, dependency graphs, lineage, contract inference | Activation, tensions, scheduling, execution |
| Weave | Activation propagation, temporal decay, tension accumulation, operator scheduling | Source analysis, code execution, model routing |
| Utilis | Model routing, shell execution, tool invocation, workflow DAGs | Graph state, activation, structural analysis |

### Persistence

- `.loom/loom.db` — SQLite semantic graph (Loom's comprehension model)
- `.loom/config.json` — Loom workspace metadata
- `.weave/substrate.db` — SQLite substrate (Weave's cognitive state)
- `.weave/config.json` — Weave RuntimeConfig

### Contract types

- **Loom → Weave:** `LoomExport` (one-way structural push)
- **Weave → Utilis:** `ExecutionIntent` / `IntentResult` (request/response)
- **Weave → Utilis (legacy):** `ExecutionPayload` / `ExecutionResult`

## Consequences

- Signal does not import or depend on Loom, Weave, or Utilis packages directly
- Signal's `.loom/` and `.weave/` directories are managed by those systems
- Signal's `workspace/` directory provides human-authored cognition inputs (goals, constraints, decisions)
