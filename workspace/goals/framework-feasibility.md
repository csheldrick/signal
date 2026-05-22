# Framework Feasibility

Signal exists to prove that the Loom ↔ Weave ↔ Utilis framework is feasible, usable,
and produces measurable value over bare-source development.

## Thesis

A greenfield application developed under continuous Loom/Weave/Utilis observation will:

1. Build a comprehension model faster than a developer reading source
2. Detect architectural drift before it becomes technical debt
3. Surface tensions (contradictions, boundary violations, missing tests) automatically
4. Execute corrective actions via Utilis when tension pressure exceeds thresholds

## Success criteria

- Loom can `explore` Signal and produce a non-trivial `LoomExport` (≥20 nodes, ≥15 edges)
- Weave can import that export and maintain activation state across ticks
- Weave detects at least one tension organically (not manually injected)
- Weave fires at least one `ExecutionIntent` in response to tension pressure
- Utilis executes that intent and returns a meaningful `IntentResult`
- The full cycle completes without manual intervention

## What we are NOT proving

- Performance at scale (Signal is intentionally small)
- Multi-user sync correctness (that's a Signal feature, not a framework concern)
- Production-grade Weave operator coverage (we use the built-in operators only)

## Loom/Weave implications

- Signal must have enough structural complexity to produce interesting graphs
  (multiple modules, cross-module dependencies, at least one interface boundary)
- Signal should introduce at least one deliberate architectural tension
  (e.g., a plugin that violates its sandbox boundary) to test detection
- The workspace cognition files themselves are inputs that Loom can analyze
