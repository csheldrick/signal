# Ecosystem Boundary Constraints

## Loom boundaries

- Loom manages `.loom/` — Signal must not write to this directory
- Loom persists to `.loom/loom.db` (SQLite) and `.loom/config.json`
- Loom exports `LoomExport` structs with nodes, edges, and clusters
- Loom node kinds: file, function, class, module, package, interface, type, variable, constant
- Loom edge kinds: imports, depends_on, calls, extends, implements, uses, contains, co_changed
- Loom's `LoomExporter.diff()` computes structural changes between exports (including removed nodes)
- Loom's `UtilisProvider` interface (`packages/core/src/loom/`) supports inference, shell, and embedding

## Weave boundaries

- Weave manages `.weave/` — Signal must not write to this directory
- Weave persists to `.weave/substrate.db` (SQLite) and `.weave/config.json`
- Weave imports LoomExports via `LoomAdapter.import()` (merge semantics, not replace)
- Weave's `diffAndActivate()` handles additions, modifications, AND removals
- Weave substrate types: file, function, class, subsystem, concept, task, issue, abstraction, execution_result, hypothesis, contradiction, goal, tension, capability
- Weave edge types: depends_on, supports, contradicts, derived_from, caused_by, predicts, blocks, resolves, related_to, co_edited, imports
- Weave dispatches `ExecutionIntent` to Utilis when activation thresholds fire
- Weave supports intent cancellation via `AbortSignal`
- Weave's `RuntimeConfig` controls decay, propagation, tick interval, and thresholds

## Utilis boundaries

- Utilis is the execution leaf — it receives work, executes, returns results
- Utilis handles: model inference, shell execution, file operations, MCP tools, API calls, test running, code analysis
- Utilis supports execution modes: run, stream, tool-loop, workflow, fleet, capability-query
- Utilis does NOT maintain graph state or make scheduling decisions
- Legacy path: `WeaveRuntime` + `createDefaultExecutionHandler()` (capability-based)
- Intent path: `createIntentHandler()` maps `ExecutionIntent` → `Agent.run()` → `IntentResult`
- Loom path: `UtilisProviderImpl` provides `infer()`, `exec()`, `embed()` directly to Loom

## Signal boundaries

- Signal owns its application code (`app/src/`)
- Signal owns its workspace cognition inputs (`workspace/`)
- Signal does NOT import Loom, Weave, or Utilis as dependencies
- Signal's `.loom/` and `.weave/` directories are external system state
