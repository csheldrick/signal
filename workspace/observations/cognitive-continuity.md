# Observation: Cognitive Continuity

## The problem this framework solves

Every static analysis tool — linters, type checkers, dependency graphs — is
*stateless*. Run it twice on the same code and you get the same output. There is no
memory of what changed, what was recently edited, or what architectural decisions led
to the current structure.

This means the tool cannot answer questions like:
- "Which files have been most actively changed in the last sprint?"
- "Which boundary violation was introduced most recently?"
- "Is this module drifting away from its original purpose?"

These are *temporal* questions. Answering them requires a substrate that persists
between runs.

## What Weave adds: activation memory

Weave's substrate is a graph that *remembers activation history*. Every time a file
is modified, its node receives activation. That activation:

1. Decays over time (so old activity fades)
2. Propagates to dependents (so hot files warm their neighbours)
3. Accumulates into tensions when contradicting nodes are both active

The result is a **cognitive continuity layer** — a persistent model of the
codebase's recent attention, not just its current structure.

## The difference from git history

Git tracks *what* changed and *when*. Weave tracks *why it matters* — because
activation propagates through the structural graph, a change in a core type
reverberates all the way to the UI layer, giving the team a live map of blast radius.

Git also has no concept of architectural rules. A commit that introduces a boundary
violation looks identical to one that doesn't. Weave's operator layer encodes those
rules and fires when they are broken.

## What this means for the runner

The runner (`runner/src/index.ts`) is not just a test harness — it is the **cognitive
bootstrap**. The first time you run it, Weave has no memory. After twenty ticks, it
has observed the current activation state, detected tensions, and persisted both to
`.weave/substrate.db`.

The *second* time you run the runner (after making code changes), Weave *loads its
previous state* and diffs it against the new Loom export. It knows which nodes are
new, which changed, and which disappeared. The activation it injects is not arbitrary
— it reflects the actual delta between snapshots.

This is the flywheel: each run makes the substrate more faithful to reality.

## The handoff problem

The hardest part of knowledge transfer is not the code — it is the *context*:
why this boundary exists, why that refactor never happened, what the team agreed
to in the ADR that nobody remembers. Weave makes this tacit knowledge *explicit*
by encoding it as substrate state. New contributors don't read every ADR; they run
the runner and see which tensions are unresolved and where attention has been
concentrated.

The `.weave/substrate.db` is not a build artifact. It is a *cognitive artifact*:
a compressed representation of the team's accumulated architectural understanding,
updated continuously as the codebase evolves.

## Open questions

1. **Tension resolution:** When Utilis resolves a tension (e.g., refactors SearchPlugin),
   how does the substrate reflect that the violation is gone? Does Loom's next export
   show the edge removed? Does Weave automatically close the tension?

2. **Multi-repo substrates:** The framework currently assumes one repo per substrate.
   What happens when Signal imports a library that also has a substrate? Can substrates
   compose?

3. **Decay calibration:** The default decay rate (0.03–0.05 per tick) was chosen
   intuitively. What decay rate best matches human cognitive decay — the rate at which
   a developer "forgets" which files they were working on?

4. **Operator coverage:** ContradictionDetectionOperator and GraphClusteringOperator
   cover structural violations and cluster membership. What other cognitive operators
   are needed? Candidates: StabilityOperator (detects churn), DriftOperator
   (detects structural divergence from baseline), DepthOperator (detects missing
   abstraction layers).
