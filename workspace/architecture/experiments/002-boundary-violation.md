# EXP-002: Deliberate Boundary Violation Detection

## Hypothesis

When Signal code deliberately violates an architectural boundary (e.g., a plugin
directly importing from the storage layer), Loom's dependency graph will capture
the violation as a cross-subsystem edge, and Weave's ContradictionDetectionOperator
will surface it as a `contradiction` tension.

## Setup

1. Signal has a `plugins/` subsystem and a `storage/` subsystem
2. The plugin-runtime goal states: "Plugins cannot directly access the storage layer"
3. A deliberate violation is introduced: `plugins/search.ts` imports from `storage/store.ts`

## Expected behavior

- Loom detects the `imports` edge from `plugins/search.ts` → `storage/store.ts`
- Loom clusters these into separate subsystems (`plugins` cluster, `storage` cluster)
- Weave imports the export and creates substrate nodes with the cross-boundary edge
- When both nodes receive activation (from any code change), the
  ContradictionDetectionOperator detects the boundary violation
- A `contradiction` tension is created with source nodes `[plugins/search, storage/store]`
- If pressure exceeds threshold, an ExecutionIntent fires asking Utilis to analyze
  the violation and suggest a fix

## Exit criteria

- Tension of kind `contradiction` appears in `runtime.tensions.getUnresolved()`
- Tension source nodes include both the plugin file and the storage file
