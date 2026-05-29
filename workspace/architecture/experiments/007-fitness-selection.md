# EXP-007: Externally-Grounded Fitness Selection

## Hypothesis

Given K candidate implementations of a single goal, externally-grounded fitness — running
the goal's targeted test file via `TestFitnessProbe` — reliably selects the variant that
passes the grounding tests at the lowest activation cost, and prunes the rest. Selection
is *grounded* (driven by real test results) rather than *self-reported* (driven by a
model's confidence in its own output).

First target: the **`Summarizer`** capability (see goal
`workspace/goals/ai-summarizer-offline.md`), grounded by `app/tests/summarizer.test.ts`.

## Setup

```bash
# Seed only the goal; let CapabilitySynthesisOperator + VariationOperator spawn variants.
weave inject --type goal "Provide a real Summarizer implementation"
weave run --generative --ticks 20
weave evolve --variants 4 --dir app      # spawn 4 variants, score each in its own worktree
weave observe activation                 # inspect survivor + pruned
```

Each variant is checked out into its own git worktree, `npm install` is reused from the
parent, and the probe runs `vitest run tests/summarizer.test.ts`. Fitness =
`(passed / total)` for that file; ties broken by lower activation cost.

## What we measure

| Metric | Definition | Target |
| ------ | ---------- | ------ |
| Survivor validity | survivor passes 100% of `summarizer.test.ts` | required |
| Selection precision | survivor is the lowest-activation-cost passing variant | ≥ K−1 of K runs |
| Pruning | non-survivor variants are removed from the substrate | all losers pruned |
| Grounding integrity | a deliberately-broken variant scores 0 and never wins | always |

## Control

Inject one variant that is intentionally wrong (returns the empty string). It must score
0 on the grounding tests and must never be selected — this proves the probe is grounded
in real results, not in the variant's self-assessment.

## What we learn

- If the lowest-cost passing variant wins consistently, fitness + cost tie-breaking is a
  sound selection rule for capability synthesis.
- If a failing variant ever wins, the probe is not actually grounding selection (e.g. the
  worktree isn't isolated, or the test command isn't being scored) — a correctness bug in
  the loop, not the candidate.

## Exit criteria

- At least one `weave evolve --variants K` run lands a `Summarizer` implementation that
  was *generated and selected* (not hand-authored) and passes `summarizer.test.ts`.
- The intentionally-broken control variant scores 0 and is pruned.
- Survivor + pruned set + fitness scores recorded in the results block below.

<!-- weave:selection -->
<!-- weave evolve appends survivor, pruned variants, and fitness scores here. -->
<!-- /weave:selection -->
