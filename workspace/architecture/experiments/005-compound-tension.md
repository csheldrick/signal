# EXP-005: Compound Tension from Multi-Boundary Violation

## Hypothesis

A module that violates two separate architectural boundaries simultaneously creates a
compound tension — one with higher pressure than either single-boundary violation in
isolation. This is because the ContradictionDetectionOperator fires independently for
each violated boundary, and both tensions share the same source node, causing pressure
to accumulate faster than the cooldown can clear it.

## Setup

`app/src/collaboration/presence.ts` introduces `PresenceTracker`, which:

1. Imports `DocumentStore` directly from `storage/store.ts` (bypasses the plugin sandbox)
2. Imports `SyncEngine` directly from `sync/engine.ts` (cross-subsystem coupling)

Both imports are structural — they appear in the dependency graph Loom extracts. The
two boundary violations are:

- **Violation 1:** `collaboration/` → `storage/` without going through `PluginContext`
- **Violation 2:** `collaboration/` → `sync/` (these are independent subsystems with
  no legitimate reason to share an importer)

## Activation strategy

```
Inject 0.8 at PresenceTracker
Inject 0.6 at DocumentStore     (simulates recent storage activity)
Inject 0.6 at SyncEngine        (simulates recent sync activity)
```

Three nodes with elevated activation, two contradiction edges. The operator should
produce two separate tensions *or* one compound tension with doubled source nodes.

## Expected vs EXP-002

| Property | EXP-002 (SearchPlugin) | EXP-005 (PresenceTracker) |
| -------- | ---------------------- | ------------------------- |
| Violations | 1 | 2 |
| Source pairs | 1 | 2 |
| Expected tensions | 1 | 2 (or 1 compound) |
| Expected pressure | baseline | ≥ 2× baseline |
| Time to threshold | ~5 ticks | ~3 ticks (more activation) |

## What we learn

If the pressures are additive, it confirms that the operator accumulates pressure
per source pair. If they merge into one compound tension, the operator is
de-duplicating by source node rather than source pair — useful to know for
future operator design.

## Exit criteria

- At least 2 `contradiction` tensions in `getUnresolved()` after 20 ticks
- OR 1 tension with `sourceNodes.length === 4` (all four violating nodes)
- Total pressure across all compound tensions > pressure from EXP-002 alone
