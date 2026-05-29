# Plan 001 — Flip Signal to Generative Bootstrap + Fitness Selection

## Status

Proposed — 2026-05-29

## Why

Signal today is a **fixture**, not a project that grows. The README says so plainly: its 20
source files and two boundary violations were *engineered* to produce a rich Loom graph. The
default bootstrap (`scripts/framework_bootstrap.sh` without `--utilis`) **replays a hand-authored
inject list** (`scripts/signal_bootstrap.json`), and the git history is ~44 of 50 commits named
`fix(weave-resolve): address … tensions`. So the framework "discovers" exactly what a human
planted, then patches it. The loop converges; nothing novel emerges.

This plan flips Signal onto the generative + fitness machinery added in Substrate (see
`substrate/.github/plans/generative-operators-and-fitness-selection.prompt.md`) so that:

- context is **re-derived from the graph** (generative) instead of replayed from a curated file,
- the framework can **build new capability** in response to pressure, not only patch seeded flaws,
- competing approaches are **selected by externally-grounded fitness** (Signal's own test suite),
- the curated list survives only as a **regression baseline**, not the source of truth.

## Dependencies

- Substrate: `GapProposalOperator`, `HypothesisGenerationOperator`, `CapabilitySynthesisOperator`,
  `VariationOperator`, `SelectionOperator`, `TestFitnessProbe`, and `weave evolve` (that plan must
  land first, or land in lockstep).
- `weave bootstrap --utilis` (already exists) for generative seeding.
- A configured Utilis provider for `--utilis` execution.

## Tasks

### SIG-001 — Make generative bootstrap the default
- Steps:
  1. Invert the mode flag in `scripts/framework_bootstrap.sh`: default → **generative**
     (`weave bootstrap --utilis`); add `--curated` to opt back into the replayed list.
  2. Keep `weave run` → `weave evolve` in the loop instead of straight `weave resolve --loop`
     (resolve remains for pure tension repair; evolve drives generation + selection).
- Files: `scripts/framework_bootstrap.sh`.
- Acceptance: `./framework_bootstrap.sh` seeds context from the live graph with no curated replay;
  `./framework_bootstrap.sh --curated` reproduces today's behaviour.

### SIG-002 — Demote the curated inject list to a regression baseline
- Steps:
  1. Move `scripts/signal_bootstrap.json` → `scripts/baselines/signal_bootstrap.curated.json`.
  2. Add `scripts/check_bootstrap_drift.sh`: run generative bootstrap, diff the derived goals/
     observations/tensions against the curated baseline, and report coverage (how much of the
     hand-authored insight the system rediscovers on its own). This becomes the demo's real
     headline metric: *rediscovery rate*, not *patch count*.
- Files: `scripts/baselines/signal_bootstrap.curated.json`, `scripts/check_bootstrap_drift.sh`.
- Acceptance: Drift script prints a rediscovery-rate comparison without failing the build.

### SIG-003 — Wire Signal's test suite as the fitness probe
- Steps:
  1. Ensure `app/` has a runnable suite `weave evolve` can call (the `TestFitnessProbe` shells the
     target's test command). Confirm/standardise the `app` test script (`app/tests/*`).
  2. Document the working-dir contract so each variant is evaluated in isolation (worktree or copy).
- Files: `app/package.json` (test script), `workspace/architecture/decisions/004-*.md` (contract).
- Acceptance: `weave evolve --dir app` scores variants from real `app` test results.

### SIG-004 — Pick one real capability gap as the first generative target
- Why: Prove generation end-to-end on a genuine gap, not a seeded violation.
- Candidate: `LocalSummarizer` — the `Summarizer` interface has only an extractive stub
  (`app/src/ai/summarizer.ts`). It is a real unmet capability already noted in framework-info.
- Steps:
  1. Seed only the *goal* ("provide a real Summarizer implementation"), let
     `CapabilitySynthesisOperator` + `VariationOperator` spawn candidate implementations.
  2. Let `SelectionOperator` + `TestFitnessProbe` pick the survivor against summarizer tests.
- Files: a summarizer test in `app/tests/` to ground fitness; no hand-written implementation.
- Acceptance: A summarizer implementation lands that was *generated and selected*, not authored
  in advance, and passes the grounding tests.

### SIG-005 — Stop seeding boundary violations (decision required — see Open Questions)
- Why: As long as violations are hand-planted, the demo tests recall of its own answer key.
- Steps (if approved): remove the deliberate violations in `app/src/plugins/search.ts` and
  `app/src/collaboration/presence.ts`; let real drift surface organically as the generated code grows.
- Files: `app/src/plugins/search.ts`, `app/src/collaboration/presence.ts`, README architecture section.
- Acceptance: Bootstrap finds tensions from *emergent* structure, not pre-seeded imports.

### SIG-006 — Author the supporting design docs
- Steps:
  1. `workspace/architecture/decisions/004-generative-fitness-model.md` — ADR recording the shift
     from curated/reductive to generative/selective, with the rediscovery-rate success metric.
  2. `workspace/architecture/experiments/006-generative-emergence.md` — does generative bootstrap
     rediscover the curated insights? what does it find that the humans didn't?
  3. `workspace/architecture/experiments/007-fitness-selection.md` — given K variants of one goal,
     does externally-grounded fitness reliably pick the variant that passes tests at lowest
     activation cost?
- Files: the three docs above.
- Acceptance: ADR + two experiment specs committed with hypotheses, setup, and exit criteria.

### SIG-007 — Update README + framework-info to the new loop
- Steps: Replace the curated-replay narrative with the generative/evolve loop; document
  `weave evolve`, the rediscovery-rate metric, and the new bootstrap flags.
- Files: `README.md`, `.context/framework-info.md`.
- Acceptance: Docs describe the generative-first workflow end-to-end.

## New loop (target state)

```text
loom onboard .                      crystallize source → .loom/loom.db
weave import                        merge into .weave/substrate.db
weave bootstrap --utilis            DERIVE goals/observations/tensions from the graph (no replay)
weave run --generative --ticks N    propagate; generative operators emit goals/hypotheses/capabilities
weave evolve --variants K --dir app spawn variants → run → score by tests → retain fittest, prune rest
weave observe activation|tensions   inspect what emerged and what survived
scripts/check_bootstrap_drift.sh    report rediscovery rate vs curated baseline
```

## Open questions

1. **SIG-005 is a judgment call.** Removing seeded violations makes the demo honest but loses the
   guaranteed-rich graph. Keep them for now behind `--curated`, or remove from the default path?
2. **Fitness isolation.** Run each variant in a git worktree (clean, slower) or in-place with
   snapshot/restore (faster, riskier)? Worktree is the safer default.
3. **Convergence guard.** Should `weave evolve` carry a curiosity term that rewards exploring
   under-activated regions so the project never fully settles? (Ties to the `exploration_needed`
   field-dynamics signal.)
