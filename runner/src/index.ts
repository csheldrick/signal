#!/usr/bin/env node
// ── Signal Experiment Runner ─────────────────────────────────────────────────
// This is how you "run" Weave for Signal.
//
// Weave is a library. You instantiate ContinuityRuntime, feed it a LoomExport,
// wire in a Utilis intent handler, register operators and triggers, then call
// runtime.start(). This script does exactly that.
//
// Usage:
//   cd signal/runner
//   npm install
//   npm run build && npm start
//
// Prerequisites:
//   - loom onboard must have been run in the signal root (produces .loom/loom.db)

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContinuityRuntime,
  ContradictionDetectionOperator,
  GraphClusteringOperator,
} from 'weave';
import type { ExecutionIntent, IntentResult } from 'weave';

import {
  createIntentHandler,
  loadConfig,
  Router,
  Agent,
  CopilotAdapter,
  AnthropicAdapter,
  OpenAIAdapter,
  OllamaAdapter,
} from '@utilis/core';
import type { IntentHandler } from '@utilis/core';

// Loom packages are CommonJS — use createRequire to import them from ESM
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loomGraph = require('@loom/graph') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GraphStore = loomGraph.GraphStore as new (dbPath: string) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LoomExporter = loomGraph.LoomExporter as new (store: any) => { buildExport(graphId: string, options?: Record<string, unknown>): LoomExport };

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNAL_ROOT = resolve(__dirname, '../../');
const LOOM_DB = resolve(SIGNAL_ROOT, '.loom/loom.db');
const LOOM_CONFIG = resolve(SIGNAL_ROOT, '.loom/config.json');
const WEAVE_DB = resolve(SIGNAL_ROOT, '.weave/substrate.db');

// ── Types (inlined to avoid cross-package import complexity) ─────────────────

interface LoomExport {
  nodes: Array<{ id: string; kind: string; name: string; path?: string; metadata?: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; kind: string; weight?: number }>;
  clusters?: Array<{ id: string; name: string; members: string[] }>;
  metadata?: { timestamp?: number; commitSha?: string; repository?: string };
}

interface LoomConfig {
  graphId: string;
  name: string;
  dbPath: string;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n═══ Signal Experiment Runner ═══\n');

  // 1. Load Loom workspace
  if (!existsSync(LOOM_DB) || !existsSync(LOOM_CONFIG)) {
    console.error('✗ No Loom workspace found. Run `loom onboard` in the signal root first.');
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(LOOM_CONFIG, 'utf-8')) as LoomConfig;
  console.log(`Loom workspace:  ${config.name} (${config.graphId.slice(0, 8)}...)`);

  const store = new GraphStore(LOOM_DB);
  const exporter = new LoomExporter(store);

  // 2. Build LoomExport
  const loomExport = exporter.buildExport(config.graphId, {
    repository: 'signal',
  }) as LoomExport;

  console.log(`LoomExport:      ${loomExport.nodes.length} nodes, ${loomExport.edges.length} edges, ${loomExport.clusters?.length ?? 0} clusters`);

  const meetsTarget = loomExport.nodes.length >= 20 && loomExport.edges.length >= 15;
  console.log(`EXP-001 target:  ${meetsTarget ? '✓ met' : `✗ not met yet (need ≥20 nodes, ≥15 edges)`}`);

  store.close();

  // 3. Instantiate Weave runtime
  console.log('\nStarting Weave runtime...');
  const runtime = new ContinuityRuntime({
    decayRate: 0.03,
    propagationDamping: 0.7,
    propagationThreshold: 0.01,
    tickIntervalMs: 500,
    operatorActivationThreshold: 0.3,
    dbPath: WEAVE_DB,
  });

  // 4. Load any existing persisted state
  if (existsSync(WEAVE_DB)) {
    runtime.load();
    console.log('Loaded persisted substrate state.');
  }

  // 5. Register built-in operators
  runtime.registerOperator(new ContradictionDetectionOperator());
  runtime.registerOperator(new GraphClusteringOperator());

  // 6. Import Loom structural graph
  const importResult = runtime.importFromLoom(loomExport);
  console.log(`Imported:        ${importResult.nodesCreated} new nodes, ${importResult.edgesCreated} new edges, ${importResult.nodesUpdated} updated`);

  // 7. Wire Utilis intent handler via createIntentHandler
  const utilisConfig = loadConfig();
  const router = new Router({ mode: utilisConfig.routing.mode, fallback: utilisConfig.routing.fallback });
  if (utilisConfig.providers.copilot) router.register(new CopilotAdapter(utilisConfig.providers.copilot.apiKey));
  if (utilisConfig.providers.anthropic) router.register(new AnthropicAdapter(utilisConfig.providers.anthropic.apiKey));
  if (utilisConfig.providers.openai) router.register(new OpenAIAdapter(utilisConfig.providers.openai.apiKey));
  if (utilisConfig.providers.ollama) router.register(new OllamaAdapter(utilisConfig.providers.ollama.baseUrl));
  const agent = new Agent(router);
  const handler: IntentHandler = createIntentHandler({ agent, cwd: SIGNAL_ROOT }) as IntentHandler;
  runtime.setIntentHandler(handler);
  console.log('Utilis intent handler registered.');

  // 8. Register execution trigger: fire intent when a node exceeds 0.7 activation
  runtime.registerTrigger({
    id: 'high-activation-review',
    nodeTypes: ['file', 'function', 'class', 'subsystem'],
    activationThreshold: 0.7,
    pressureThreshold: 0,
    cooldownMs: 30_000,
    lastTriggeredAt: 0,
    handler: async (ctx) => {
      await runtime.dispatchIntent({
        intentId: crypto.randomUUID(),
        issuedAt: new Date().toISOString(),
        mode: 'run',
        prompt: `Review this node for architectural issues: ${ctx.triggerNode.label ?? ctx.triggerNode.id} (activation: ${ctx.triggerNode.activation.toFixed(2)})`,
        taskType: 'code_review',
        complexity: 'medium',
      });
    },
  });

  // 9. Inject activation at the boundary-violating node (EXP-002)
  //    Loom node IDs are UUIDs — find SearchPlugin by name in the LoomExport,
  //    then look up that UUID in the substrate (imported in step 6).
  const violationLoomNode = loomExport.nodes.find(
    n => n.name === 'SearchPlugin' && (n.kind === 'service' || n.kind === 'class'),
  );
  if (violationLoomNode) {
    const violationNode = runtime.graph.getNode(violationLoomNode.id);
    if (violationNode) {
      console.log(`\nInjecting activation at SearchPlugin (${violationLoomNode.id.slice(0, 8)}...) (EXP-002)...`);
      runtime.inject(violationNode.id, 0.8);
    }
  } else {
    console.log('\nNote: SearchPlugin node not found — run loom onboard after creating app/src/plugins/search.ts');
  }

  // 10. Start the runtime
  console.log('\nRuntime started. Running 20 ticks (10 seconds)...\n');
  runtime.start();

  // 11. Observe and report
  const startTime = Date.now();
  const TICK_LIMIT = 20;
  let lastTickCount = 0;

  const observer = setInterval(() => {
    const state = runtime.getState();
    if (state.tickCount > lastTickCount) {
      lastTickCount = state.tickCount;
      process.stdout.write(`tick ${String(state.tickCount).padStart(2)} | nodes: ${state.nodeCount} | activation: ${state.totalActivation.toFixed(3)} | tensions: ${state.unresolvedTensions} | pending: ${state.pendingExecutions}\r`);
    }
    if (state.tickCount >= TICK_LIMIT) {
      clearInterval(observer);
      reportResults(runtime);
    }
  }, 100);
}

function reportResults(runtime: ContinuityRuntime): void {
  const state = runtime.getState();
  const tensions = runtime.tensions.getUnresolved();

  console.log('\n\n═══ Results ═══\n');
  console.log(`Ticks run:           ${state.tickCount}`);
  console.log(`Node count:          ${state.nodeCount}`);
  console.log(`Total activation:    ${state.totalActivation.toFixed(3)}`);
  console.log(`Unresolved tensions: ${state.unresolvedTensions}`);
  console.log(`Events logged:       ${state.eventCount}`);

  if (tensions.length > 0) {
    console.log('\nTensions detected:');
    for (const t of tensions) {
      console.log(`  [${t.kind}] pressure=${t.pressure.toFixed(2)} sources=[${t.sourceNodes.join(', ')}]`);
    }
    console.log('\nEXP-002: ✓ Tension detection working');
  } else {
    console.log('\nEXP-002: No tensions yet (inject more activation or run more ticks)');
  }

  const snapshot = runtime.snapshot('experiment-run');
  if (snapshot) {
    console.log(`\nSnapshot saved: ${snapshot.id}`);
  }

  runtime.shutdown();
  console.log('\nRuntime shut down. State persisted to .weave/substrate.db\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Runner failed:', err);
  process.exit(1);
});
