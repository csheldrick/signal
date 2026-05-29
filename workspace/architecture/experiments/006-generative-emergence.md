# EXP-006: Generative Emergence vs the Curated Baseline

## Hypothesis

Given only the live Loom graph and the `workspace/` docs — and **no** curated inject
list — the generative bootstrap (`weave bootstrap --utilis`) will re-derive the majority
of the hand-authored insight in `scripts/baselines/signal_bootstrap.curated.json`, and
will additionally surface *emergent* observations that the curated list never contained.

Concretely:

- **Rediscovery:** ≥ 60% overall rediscovery rate against the curated baseline, with the
  structural categories (`architecture`, `observation`) scoring highest because they are
  most directly readable from the graph.
- **Emergence:** ≥ 3 derived entries that match nothing in the baseline (genuine new
  signal, not noise).

## Setup

```bash
./framework_bootstrap.sh                 # generative (default)
scripts/check_bootstrap_drift.sh         # rediscovery-rate report
```

`check_bootstrap_drift.sh` runs `weave bootstrap --utilis --dry-run` to derive context
without mutating the substrate, then `scripts/lib/bootstrap_drift.mjs` compares the
derived set against the curated baseline using normalised keyword (Jaccard) overlap. The
match threshold is 0.34; entries below it on the curated side count as *not
rediscovered*, and derived entries that match nothing count as *emergent*.

## What we measure

| Metric | Source | Target |
| ------ | ------ | ------ |
| Overall rediscovery rate | drift report `OVERALL` | ≥ 60% |
| Per-type rediscovery | drift report rows | `architecture`/`observation` ≥ 70% |
| Emergent count | drift report `Emergent` | ≥ 3 |

## What we learn

- **High rediscovery, low emergence:** the graph already encodes the curated insight; the
  human list was largely redundant with what is structurally derivable.
- **Low rediscovery, high emergence:** the curated list carried tacit knowledge the graph
  does not express (good candidates for `workspace/` docs the ingestion bridge should
  read), and the generative pass is exploring elsewhere.
- **Both high:** the ideal — the system recovers known insight *and* extends it.

## Open question

Does the generative pass need a curiosity term (rewarding under-activated regions) to
keep emergence > 0 as the project matures, or does the graph stay rich enough on its own?
This ties to the convergence-guard decision deferred in ADR-004.

## Exit criteria

- The drift report runs end-to-end and prints an overall rediscovery rate.
- Overall rediscovery ≥ 60% **and** emergent count ≥ 3 on at least one generative run,
  recorded in the framework-written results block below.

<!-- weave:results -->
<!-- weave evolve appends the measured rediscovery rate and emergent entries here. -->
<!-- /weave:results -->
