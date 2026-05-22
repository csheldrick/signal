# EXP-001: End-to-End Pipeline Validation

## Hypothesis

The Loom → Weave → Utilis pipeline can operate on a real (small) TypeScript application
without manual graph construction. Loom extracts structure, Weave maintains cognitive
state, and Utilis executes when activation thresholds fire.

## Setup

### Phase 1: Structural extraction (Loom)

```bash
cd signal
loom onboard
```

Expected output: Loom produces a `LoomExport` containing:
- File nodes for each `.ts` source file in `app/src/`
- Function/class nodes for exported symbols
- Module/subsystem nodes for each directory (`core`, `storage`, `sync`, etc.)
- Dependency edges (`imports`, `depends_on`) reflecting actual imports
- Cluster groupings matching the directory structure

### Phase 2: Cognitive import (Weave)

```typescript
import { ContinuityRuntime } from 'weave';

const runtime = new ContinuityRuntime({ dbPath: '.weave/substrate.db' });
const loomExport = /* load from Loom */;

// Import structural graph
const result = runtime.importFromLoom(loomExport);
console.log(`Imported: ${result.nodesCreated} nodes, ${result.edgesCreated} edges`);

// Register operators
runtime.registerOperator(new ContradictionDetectionOperator());
runtime.registerOperator(new GraphClusteringOperator());

// Start tick loop
runtime.start();
```

Expected behavior:
- Nodes appear in substrate with `source: 'loom'` metadata
- Activation starts at 0 (no activity yet)
- No tensions exist (fresh import)

### Phase 3: Change detection (Loom diff → Weave activation)

After modifying Signal source code:

```typescript
const previousExport = /* cached */;
const currentExport = /* fresh loom onboard */;
const { activated, removed } = runtime.loom.diffAndActivate(previous, current, 0.5);
```

Expected behavior:
- Changed nodes receive activation
- Activation propagates to neighbors via weighted edges
- ContradictionDetectionOperator fires if contradicting nodes both activate

### Phase 4: Tension → Execution (Weave → Utilis)

When a tension accumulates enough pressure:

```typescript
import { createIntentHandler } from '@utilis/core';

const handler = createIntentHandler({ agent, cwd: './signal' });
runtime.setIntentHandler(handler);

// Register trigger: when any node crosses 0.7 activation, run code analysis
runtime.registerTrigger({
  id: 'high-activation-analysis',
  nodeTypes: ['file', 'function', 'class'],
  activationThreshold: 0.7,
  pressureThreshold: 0,
  cooldownMs: 30000,
  lastTriggeredAt: 0,
  handler: async (ctx) => {
    await runtime.dispatchIntent({
      intentId: crypto.randomUUID(),
      issuedAt: new Date().toISOString(),
      mode: 'run',
      prompt: `Analyze this code for architectural issues: ${ctx.triggerNode.label}`,
      taskType: 'code_review',
      complexity: 'medium',
      focusPaths: [ctx.triggerNode.state.path],
    });
  },
});
```

## Measurements

| Metric | Target | How to measure |
| ------ | ------ | -------------- |
| LoomExport node count | ≥ 20 | `loomExport.nodes.length` |
| LoomExport edge count | ≥ 15 | `loomExport.edges.length` |
| Cluster count | ≥ 3 | `loomExport.clusters.length` |
| Organic tensions detected | ≥ 1 | `runtime.tensions.getUnresolved().length` after 50 ticks |
| ExecutionIntents dispatched | ≥ 1 | event log filter on `execution_triggered` |
| IntentResult success rate | 100% | all results have `status: 'ok'` |

## Exit criteria

The experiment succeeds if all six metrics meet their targets in a single run
without injecting artificial activation or manually creating tensions.
