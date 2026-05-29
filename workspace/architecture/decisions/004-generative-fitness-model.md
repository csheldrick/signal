# ADR-004: Generative Bootstrap + Fitness Selection

## Status

Accepted — 2026-05-29 (supersedes the curated-replay default of ADR-001's bootstrap)

## Context

Signal was originally a **fixture**: its source files and boundary violations were
engineered to produce a rich Loom graph, and the default bootstrap replayed a
hand-authored inject list (`scripts/signal_bootstrap.json`). The framework then
"discovered" exactly what a human had planted and patched it — the loop converged and
nothing novel emerged. The bulk of the git history was `fix(weave-resolve): … tensions`
commits closing seeded flaws.

Two things changed that make a different model possible:

1. Substrate added generative operators (`GapProposalOperator`,
   `HypothesisGenerationOperator`, `CapabilitySynthesisOperator`, `VariationOperator`),
   a `SelectionOperator`, a `TestFitnessProbe`, and the `weave evolve` command.
2. The deliberately-seeded boundary violations in `plugins/search.ts` and
   `collaboration/presence.ts` were refactored away during the TypeScript migration, so
   the curated narrative no longer matches the code. Tensions must now come from
   *emergent* structure, not pre-seeded imports.

## Decision

Flip Signal from **curated / reductive** to **generative / selective**:

- **Generative is the default.** `./framework_bootstrap.sh` re-derives context from the
  live graph + `workspace/` docs (`weave bootstrap --utilis`). `--curated` opts back into
  the replayed list, which now lives at `scripts/baselines/signal_bootstrap.curated.json`
  as a **regression baseline**, not the source of truth.
- **Capability is grown, not only patched.** The loop runs `weave evolve` (generation +
  selection) alongside `weave resolve` (pure tension repair).
- **Fitness is externally grounded.** Competing variants are scored by Signal's own test
  suite via `TestFitnessProbe`, not by self-report.
- **The headline metric is rediscovery rate**, reported by
  `scripts/check_bootstrap_drift.sh`: how much hand-authored insight the system
  re-derives on its own, plus what it finds that the humans did not (emergent entries).

### Fitness probe contract (the `weave evolve --dir app` interface)

`TestFitnessProbe` shells the target's test command and scores a variant by the
result. For Signal:

- **Test command.** `app` exposes `npm test` (→ `vitest run`). Vitest resolves the
  NodeNext `.js` import specifiers to their `.ts` sources, so no separate build step is
  required for the probe.
- **Per-capability grounding.** Each generative goal carries a *targeted* grounding test
  (e.g. `app/tests/summarizer.test.ts` for the `Summarizer` capability). The probe runs
  the targeted file for that goal — `vitest run tests/<capability>.test.ts` — so a
  variant is scored only against the tests that ground *its* goal, and unrelated
  pre-existing failures (which are themselves tensions) do not pollute the signal.
- **Score.** A variant's fitness is `(tests passed / tests total)` for its grounding
  file, with ties broken by lower activation cost (cheaper survivor wins).

### Working-directory isolation

Each variant is evaluated in **its own git worktree** (clean checkout of the candidate),
not in-place. Worktrees are slower than snapshot/restore but cannot leak state between
variants or corrupt the working tree if a candidate misbehaves — the safer default for
an automated loop that spawns and discards many candidates. Snapshot/restore in-place
remains a future optimisation if worktree creation dominates runtime.

This is **enabled** via `evolve.isolation: "worktree"` in `.weave/config.json`.

### Convergence guard (enabled)

`weave evolve` carries a **curiosity term** that rewards exploring under-activated regions
of the graph, tied to the `exploration_needed` field-dynamics signal, so the project never
fully settles into the curated answer key. A variant's score is therefore:

```
score = fitness + curiosity.weight * exploration_needed(region)
```

where `fitness` is the grounding-test pass rate (in `[0,1]`) and the curiosity bonus is a
modest fraction of that — `curiosity.weight: 0.2` in `.weave/config.json` — so exploration
biases ties and breaks stalemates without ever letting a failing variant outrank a passing
one. **Enabled** via `evolve.curiosity.enabled: true`. EXP-006 measures whether this keeps
emergence > 0 as the project matures.

## Consequences

- The curated list stops being authoritative and becomes a yardstick. A run that
  rediscovers <100% of it is informative, not broken.
- Generated implementations only land if they pass their grounding tests, so the test
  suite becomes load-bearing — adding a capability means first adding the test that
  grounds it.
- Because tensions now come from emergent structure, the demo no longer tests recall of
  its own answer key; the README and `framework-info` are updated to drop the
  seeded-violation narrative.
- `workspace/` docs are now wired into the loop in both directions (see ADR-004's
  companion config in `.weave/config.json`): ingested as seed context, and written back
  with experiment/selection outcomes.
