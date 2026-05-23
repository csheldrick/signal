#!/bin/bash
# Bootstrap the Loom → Weave continuity framework for this repo.
#
# Two modes:
#   ./framework_bootstrap.sh           Curated: replays hand-authored inject list
#   ./framework_bootstrap.sh --utilis  Generative: LLM re-derives context from graph

set -e

MODE="curated"
if [[ "$1" == "--utilis" ]]; then
  MODE="generative"
fi

# 1. Crystallise the Loom structural model
loom reset -y
loom onboard

# 2. Import the graph into the Weave substrate
weave import
weave inspect nodes

# 3. Seed the substrate with semantic context
if [[ "$MODE" == "generative" ]]; then
  echo "Generating bootstrap context via LLM..."
  weave bootstrap --utilis --save scripts/signal_bootstrap.json
else
  echo "Replaying curated inject list from scripts/signal_bootstrap.json..."
  weave bootstrap --from scripts/signal_bootstrap.json
fi

# 4. Propagate activation and derive tensions
weave run --ticks 30 --utilis

# 5. Observe results
weave observe tensions
weave observe activation
weave observe clusters
