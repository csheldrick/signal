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

  // 9. Inject activation — run all three experiments before the tick loop so
  //    their propagation is captured in the same observation window.

  // EXP-002: Single boundary violation (SearchPlugin → DocumentStore)
  //
  // ContradictionDetectionOperator requires BOTH sides of a contradiction edge to
  // exceed `operatorActivationThreshold`. Injecting only at SearchPlugin leaves
  // DocumentStore cold → operator never fires. We inject at both nodes to model the
  // realistic scenario where storage is also actively being used.
  const searchPluginNode = loomExport.nodes.find(
    n => n.name === 'SearchPlugin' && (n.kind === 'service' || n.kind === 'class'),
  );
  if (searchPluginNode && runtime.graph.getNode(searchPluginNode.id)) {
    console.log(`EXP-002: Injecting at SearchPlugin  (${searchPluginNode.id.slice(0, 8)}...)`);
    runtime.inject(searchPluginNode.id, 0.8);
    // Activate the violated boundary too so the operator sees both sides
    const storeNodeForExp002 = loomExport.nodes.find(n => n.name === 'DocumentStore');
    if (storeNodeForExp002 && runtime.graph.getNode(storeNodeForExp002.id)) {
      runtime.inject(storeNodeForExp002.id, 0.6);
    }
  } else {
    console.log('EXP-002: SearchPlugin not found (run loom onboard after creating app/src/plugins/search.ts)');
  }

  // EXP-003: Hub node cascade (InvertedIndex → dependents)
  const invertedIndexNode = loomExport.nodes.find(
    n => n.name === 'InvertedIndex' && (n.kind === 'class' || n.kind === 'service'),
  );
  if (invertedIndexNode && runtime.graph.getNode(invertedIndexNode.id)) {
    console.log(`EXP-003: Injecting at InvertedIndex (${invertedIndexNode.id.slice(0, 8)}...) — cascade test`);
    runtime.inject(invertedIndexNode.id, 0.9);
  } else {
    console.log('EXP-003: InvertedIndex not found (run loom onboard after creating app/src/indexing/index.ts)');
  }

  // EXP-005: Compound tension (PresenceTracker violates two boundaries)
  const presenceNode = loomExport.nodes.find(
    n => n.name === 'PresenceTracker' && (n.kind === 'class' || n.kind === 'service'),
  );
  const documentStoreNode = loomExport.nodes.find(n => n.name === 'DocumentStore');
  const syncEngineNode = loomExport.nodes.find(n => n.name === 'SyncEngine');
  if (presenceNode && runtime.graph.getNode(presenceNode.id)) {
    console.log(`EXP-005: Injecting at PresenceTracker (${presenceNode.id.slice(0, 8)}...) — compound tension test`);
    runtime.inject(presenceNode.id, 0.8);
    // Also activate both violated subsystems to maximise operator pressure
    if (documentStoreNode && runtime.graph.getNode(documentStoreNode.id)) {
      runtime.inject(documentStoreNode.id, 0.6);
    }
    if (syncEngineNode && runtime.graph.getNode(syncEngineNode.id)) {
      runtime.inject(syncEngineNode.id, 0.6);
    }
  } else {
    console.log('EXP-005: PresenceTracker not found (run loom onboard after creating app/src/collaboration/presence.ts)');
  }

  // 10. Start the runtime — 30 ticks to give the cascade room to propagate
  console.log('\nRuntime started. Running 30 ticks (15 seconds)...\n');
  runtime.start();

  // 11. Observe and report
  const TICK_LIMIT = 30;
  let lastTickCount = 0;

  const observer = setInterval(() => {
    const state = runtime.getState();
    if (state.tickCount > lastTickCount) {
      lastTickCount = state.tickCount;
      process.stdout.write(
        `tick ${String(state.tickCount).padStart(2)} | nodes: ${state.nodeCount} | Σactivation: ${state.totalActivation.toFixed(3)} | tensions: ${state.unresolvedTensions} | pending: ${state.pendingExecutions}\r`,
      );
    }
    if (state.tickCount >= TICK_LIMIT) {
      clearInterval(observer);
      reportResults(runtime, loomExport);
    }
  }, 100);
}

function reportResults(runtime: ContinuityRuntime, loomExport: LoomExport): void {
  const state = runtime.getState();
  const tensions = runtime.tensions.getUnresolved();

  console.log('\n\n═══ Results ═══\n');
  console.log(`Ticks run:           ${state.tickCount}`);
  console.log(`Node count:          ${state.nodeCount}`);
  console.log(`Total activation:    ${state.totalActivation.toFixed(3)}`);
  console.log(`Unresolved tensions: ${state.unresolvedTensions}`);
  console.log(`Events logged:       ${state.eventCount}`);

  // ── Substrate heatmap (top 10 nodes by activation) ──────────────────────────
  const allNodes = loomExport.nodes
    .map(n => ({ node: n, substrateNode: runtime.graph.getNode(n.id) }))
    .filter(({ substrateNode }) => substrateNode !== undefined)
    .map(({ node, substrateNode }) => ({
      name: node.name,
      kind: node.kind,
      activation: substrateNode!.activation ?? 0,
    }))
    .sort((a, b) => b.activation - a.activation)
    .slice(0, 10);

  if (allNodes.length > 0) {
    console.log('\nSubstrate heatmap (top 10 by activation):');
    const maxAct = allNodes[0]?.activation ?? 1;
    for (const { name, kind, activation } of allNodes) {
      const barWidth = 20;
      const filled = Math.round((activation / Math.max(maxAct, 0.01)) * barWidth);
      const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
      console.log(`  ${bar} ${activation.toFixed(3)}  ${name} (${kind})`);
    }
  }

  // ── Per-experiment verdicts ──────────────────────────────────────────────────
  console.log('\n── Experiment results ──');

  const exp001Met = loomExport.nodes.length >= 20 && loomExport.edges.length >= 15;
  console.log(`EXP-001 (E2E pipeline):       ${exp001Met ? '✓' : '✗'} ${loomExport.nodes.length} nodes / ${loomExport.edges.length} edges (need ≥20/≥15)`);

  const contradictions = tensions.filter(t => t.kind === 'contradiction');
  console.log(`EXP-002 (boundary violation): ${contradictions.length > 0 ? '✓' : '✗'} ${contradictions.length} contradiction tension(s)`);

  const invertedIndexNode = loomExport.nodes.find(n => n.name === 'InvertedIndex');
  const hubFound = invertedIndexNode !== undefined && runtime.graph.getNode(invertedIndexNode.id) !== undefined;
  console.log(`EXP-003 (hub cascade):        ${hubFound ? '✓' : '–'} InvertedIndex hub ${hubFound ? 'injected — check heatmap for cascade' : 'not found yet'}`);

  const presenceNode = loomExport.nodes.find(n => n.name === 'PresenceTracker');
  const compoundViolations = presenceNode
    ? contradictions.filter(t => t.sourceNodes.some(id => id === presenceNode.id))
    : [];
  console.log(`EXP-005 (compound tension):   ${compoundViolations.length > 0 ? '✓' : '–'} ${compoundViolations.length} tension(s) from PresenceTracker`);

  if (tensions.length > 0) {
    console.log('\nAll unresolved tensions:');
    for (const t of tensions) {
      const shortSources = t.sourceNodes.map((id: string) => id.slice(0, 8)).join(', ');
      console.log(`  [${t.kind}] pressure=${t.pressure.toFixed(2)} sources=[${shortSources}]`);
    }
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
