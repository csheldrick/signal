# EXP-004: Goal-to-Code Crystallization Path

## Hypothesis

The causal chain from a workspace goal to deployed code is traceable as a directed
path through the substrate. Activation injected at a goal node should flow *downward*
through abstraction layers — from goal to ADR to task to subsystem — rather than
spreading laterally across unrelated concerns. This means the framework can answer:
*"Which code is implementing this goal right now, and how much of it?"*

## The crystallization metaphor

Goals are supersaturated solutions — high-level intent that hasn't yet precipitated
into concrete form. Each layer of the stack (ADR → task → module → function) is a
crystallization step: the intent becomes progressively more specific and testable.
Weave models this as an activation flow that *concentrates* as it descends.

If a goal has high activation but its downstream code has low activation, the
crystallization is incomplete — there is intent without implementation. This is a
*dissolution tension*: the framework knows work remains.

## Substrate model

```
workspace/goals/framework-feasibility.md
  ↓ realizes
workspace/architecture/decisions/001-ecosystem-integration.md
  ↓ informs
workspace/tasks/experiment-tasks.md
  ↓ produces
runner/src/index.ts
  ↓ tests
app/src/plugins/search.ts
```

Each `↓` is a directed edge in the substrate. Loom extracts cross-file references;
workspace documents establish these edges explicitly via their content links.

## Setup

1. Inject 0.8 activation at `framework-feasibility.md` (the root goal)
2. Register a `CrystallizationOperator` that:
   - Fires when a goal node's activation is ≥ 0.5
   - Checks activation of all nodes reachable by following `realizes` / `informs` / `produces` edges
   - Creates a `dissolution` tension if any step in the chain has activation < 0.2
3. Run for 50 ticks
4. Observe whether activation flows into the implementation nodes organically

## Expected behavior

- After 5 ticks: goal node at ~0.65, ADR at ~0.45, tasks at ~0.32
- After 20 ticks: flow stabilises; implementation modules show baseline elevation
- If any layer has no downstream edges yet: a `dissolution` tension appears

## What makes this non-trivial

Goals and code live in separate parts of the substrate. Without explicit edges
connecting them, activation cannot flow from intent to implementation. The experiment
tests whether the current workspace→code edge model is rich enough to carry the signal,
or whether new edge kinds (`realizes`, `implements_goal`) are needed.

## Exit criteria

- Activation is measurably higher in implementation nodes after injection at the goal node
- OR a `dissolution` tension appears (also a success — it means the operator fired correctly)
- Total runtime under 60 seconds
