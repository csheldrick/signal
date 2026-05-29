#!/bin/bash
# Bootstrap drift / rediscovery-rate report.
#
# Runs the generative bootstrap against the live graph + workspace/ docs, then
# compares the derived context against the curated baseline. The headline metric
# is the *rediscovery rate*: how much of the hand-authored insight the system
# re-derives on its own — not the patch count.
#
# This is a report, not a gate: it never fails the build. Use it to track
# whether the generative loop is converging toward (or diverging from) the
# curated answer key as the project evolves.
#
# Usage:
#   ./scripts/check_bootstrap_drift.sh

set -e

BASELINE="scripts/baselines/signal_bootstrap.curated.json"
DERIVED="$(mktemp -t signal-bootstrap-derived.XXXXXX.json)"
trap 'rm -f "$DERIVED"' EXIT

if [[ ! -f "$BASELINE" ]]; then
  echo "error: curated baseline not found at $BASELINE" >&2
  exit 1
fi

echo "Deriving generative bootstrap context (no curated replay)..."
# --dry-run derives + emits the context without mutating the substrate.
weave bootstrap --utilis --dry-run --save "$DERIVED"

echo ""
echo "Comparing derived context against curated baseline:"
echo "  baseline: $BASELINE"
echo "  derived:  $DERIVED"
echo ""

# Rediscovery rate per type: fraction of curated entries whose description is
# semantically echoed in the derived set. We approximate "semantically echoed"
# with a normalised keyword-overlap match so the report stays dependency-free.
# Entries that are derived but absent from the baseline are reported as
# *emergent* — insight the humans did not plant.
node scripts/lib/bootstrap_drift.mjs "$BASELINE" "$DERIVED"

echo ""
echo "Note: this is a rediscovery-rate report, not a pass/fail gate."
