#!/bin/bash
# Bootstrap the Loom → Weave continuity framework for this repo.
#
# Two modes:
#   ./framework_bootstrap.sh            Generative (default): the LLM re-derives
#                                       context from the live graph + workspace/ docs.
#   ./framework_bootstrap.sh --curated  Curated: replays the hand-authored inject
#                                       list kept as a regression baseline.
#
# The generative path is now the default: Signal grows capability in response to
# pressure and selects competing approaches by externally-grounded fitness
# (Signal's own test suite via `weave evolve`). The curated list survives only as
# a regression baseline — see scripts/check_bootstrap_drift.sh for the
# rediscovery-rate comparison.

set -e

MODE="generative"
if [[ "$1" == "--curated" ]]; then
  MODE="curated"
fi

CURATED_BASELINE="scripts/baselines/signal_bootstrap.curated.json"

rm -rf .weave/substrate.db

# 1. Crystallise the Loom structural model
loom reset -y
loom onboard --skip-drift --skip-handoff

# 2. Import the graph into the Weave substrate
weave import
weave inspect nodes

# 3. Seed the substrate with semantic context
if [[ "$MODE" == "generative" ]]; then
  echo "Deriving bootstrap context from the live graph + workspace/ docs (generative)..."
  weave bootstrap --utilis
else
  echo "Replaying curated inject list from ${CURATED_BASELINE}..."
  weave bootstrap --from "$CURATED_BASELINE"
fi

# 4. Propagate activation; generative operators emit goals/hypotheses/capabilities
weave run --ticks 10 --utilis

# 5. Observe what emerged
weave observe tensions
weave observe activation
weave observe clusters

# 6. Evolve: spawn variants for active goals, run + score them against the app
#    test suite, retain the fittest and prune the rest. `resolve` remains the
#    tool for pure tension repair; `evolve` drives generation + selection.
if [[ "$MODE" == "generative" ]]; then
  weave evolve --dir app
else
  weave resolve --loop
fi
