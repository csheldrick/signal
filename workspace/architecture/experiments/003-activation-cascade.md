# EXP-003: Activation Cascade from a Hub Node

## Hypothesis

When activation is injected at a high-centrality node (one with many inbound edges),
the propagation does not spread uniformly — it cascades in waves that follow structural
dependency paths. Nodes that depend on the hub receive activation first; their dependents
receive it next. The wave front decays with distance, producing a measurable activation
gradient across the substrate.

## Why this matters

Static analysis tools treat all nodes equally. Weave's activation model lets you ask:
*"If this file changed, which other files would be cognitively affected, and how much?"*
The cascade reveals implicit coupling that import graphs alone cannot capture — two files
may not directly import each other, but both depend on a shared hub, so changes in that
hub create correlated activation in both.

## Setup

`app/src/indexing/index.ts` introduces `InvertedIndex`, a high fan-in hub:
- Every subsystem that wants full-text search will import it
- It imports only from the core types (low fan-out)
- Loom should classify it as a hub by degree centrality

Inject 0.9 activation at the `InvertedIndex` node. The cascade should reach:
- Any file that imports `InvertedIndex` (distance 1, predicted activation ≥ 0.6)
- Files that import *those* files (distance 2, predicted activation ≥ 0.4)
- No change beyond distance 2 at the default damping coefficient of 0.7

## Expected behavior

| Tick | Expected state |
| ---- | -------------- |
| 0    | InvertedIndex at 0.9, all others at baseline |
| 1    | Direct dependents receive `0.9 × 0.7 = 0.63` activation |
| 2    | Second-order dependents receive `0.63 × 0.7 = 0.44` activation |
| 3+   | Exponential decay; hub itself decays by `decayRate` per tick |

## Measurements

| Metric | Target |
| ------ | ------ |
| Distance-1 node activation after tick 1 | ≥ 0.55 |
| Distance-2 node activation after tick 2 | ≥ 0.35 |
| Nodes beyond distance 2 remain below threshold | < 0.3 |
| No spurious tensions from cascade alone | 0 contradictions |

## Exit criteria

The experiment succeeds when the activation gradient is measurable across at least
two distinct "shells" of the dependency graph around the hub node, and the decay
between shells is consistent with the configured `propagationDamping` coefficient.

## Notes

This experiment validates that Weave's propagation model is *structurally faithful* —
it respects the actual import graph rather than treating all neighbours equally. If the
gradient is flatter than expected, the substrate edges are not weighted correctly.
