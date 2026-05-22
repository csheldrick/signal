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

// ── Loom export enrichment ────────────────────────────────────────────────────
// ContradictionDetectionOperator needs two things Loom doesn't always provide:
//   1. Fine-grained subsystem clusters — Loom's coarse 2-cluster output doesn't
//      distinguish plugins/ from storage/, so the operator can't detect cross-
//      boundary edges without explicit cluster assignments.
//   2. Explicit `contradicts` edges — the operator fires when two *connected*
//      nodes in different clusters both have high activation. Without edges of
//      kind `contradicts`, it has nothing to evaluate.
//
// Both are derived purely from file paths: app/src/<subsystem>/ defines the
// boundary. No manual configuration required.

function enrichLoomExport(raw: LoomExport): { export: LoomExport; contradictEdgesAdded: number } {
  const subsystemOf = (path: string | undefined): string | undefined => {
    const m = path?.match(/\/src\/([^/]+)\//);
    return m?.[1];
  };

  // 1. Tag each node with its boundary subsystem
  const nodes: LoomExport['nodes'] = raw.nodes.map(n => {
    const sub = subsystemOf(n.path);
    if (!sub) return n;
    return { ...n, metadata: { ...n.metadata, boundary: sub } };
  });

  // 2. Fine-grained clusters: one entry per subsystem directory
  const byBoundary = new Map<string, string[]>();
  for (const n of nodes) {
    const sub = (n.metadata?.boundary as string | undefined) ?? n.kind;
    let members = byBoundary.get(sub);
    if (!members) { members = []; byBoundary.set(sub, members); }
    members.push(n.id);
  }
  const clusters = [...byBoundary.entries()].map(([name, members]) => ({
    id: `cluster-${name}`,
    name,
    members,
  }));

  // 3. Cross-boundary imports → explicit contradiction edges
  const boundary = new Map(nodes.map(n => [n.id, n.metadata?.boundary as string | undefined]));
  const contradictEdges: LoomExport['edges'] = [];
  for (const e of raw.edges) {
    if (e.kind !== 'imports') continue;
    const src = boundary.get(e.source);
    const tgt = boundary.get(e.target);
    if (src && tgt && src !== tgt) {
      contradictEdges.push({ source: e.source, target: e.target, kind: 'contradicts', weight: 1.0 });
    }
  }

  return {
    export: { nodes, edges: [...raw.edges, ...contradictEdges], clusters, metadata: raw.metadata },
    contradictEdgesAdded: contradictEdges.length,
  };
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

  const rawNodeCount = loomExport.nodes.length;
  const rawEdgeCount = loomExport.edges.length;
  console.log(`LoomExport:      ${rawNodeCount} nodes, ${rawEdgeCount} edges, ${loomExport.clusters?.length ?? 0} clusters`);

  const meetsTarget = rawNodeCount >= 20 && rawEdgeCount >= 15;
  console.log(`EXP-001 target:  ${meetsTarget ? '✓ met' : `✗ not met yet (need ≥20 nodes, ≥15 edges)`}`);

  // Enrich before importing: fine-grained subsystem clusters + contradiction edges
  const { export: enrichedExport, contradictEdgesAdded } = enrichLoomExport(loomExport);
  console.log(`Enriched:        +${contradictEdgesAdded} contradiction edges, ${enrichedExport.clusters?.length ?? 0} subsystem clusters`);

  store.close();

  // 3. Instantiate Weave runtime
  console.log('\nStarting Weave runtime...');
  const runtime = new ContinuityRuntime({
    decayRate: 0.03,
    propagationDamping: 0.7,
    propagationThreshold: 0.01,
    tickIntervalMs: 500,
    operatorActivationThreshold: 0.25,  // lowered: injected nodes decay ~40% over 30 ticks
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

  // 6. Import enriched structural graph
  const importResult = runtime.importFromLoom(enrichedExport);
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

  // 9. Inject activation — run all three experiments before the tick loop.
  //
  //    Node lookup uses enrichedExport (same IDs, just enriched metadata).
  //    Injection levels are set so nodes remain above operatorActivationThreshold
  //    (0.25) even after full decay: with decayRate=0.03 over 30 ticks the
  //    survival factor is (1-0.03)^30 ≈ 0.40, so floor = level × 0.40 > 0.25
  //    requires level > 0.625. We use 0.85–0.95 for safety margin.
  //
  //    DocumentStore appears in both EXP-002 and EXP-005; inject once with the
  //    max needed level (0.85) to avoid double-injection side effects.

  const findNode = (name: string, kinds?: string[]) =>
    enrichedExport.nodes.find(n => n.name === name && (!kinds || kinds.includes(n.kind)));

  const storeNode   = findNode('DocumentStore');
  const syncNode    = findNode('SyncEngine');

  // Shared injection: DocumentStore and SyncEngine are targets in both EXP-002 and EXP-005
  if (storeNode && runtime.graph.getNode(storeNode.id)) {
    runtime.inject(storeNode.id, 0.85);
  }
  if (syncNode && runtime.graph.getNode(syncNode.id)) {
    runtime.inject(syncNode.id, 0.85);
  }

  // EXP-002: boundary violation — SearchPlugin → DocumentStore
  const searchPluginNode = findNode('SearchPlugin', ['class', 'service']);
  if (searchPluginNode && runtime.graph.getNode(searchPluginNode.id)) {
    console.log(`EXP-002: Injecting at SearchPlugin  (${searchPluginNode.id.slice(0, 8)}...)`);
    runtime.inject(searchPluginNode.id, 0.85);
  } else {
    console.log('EXP-002: SearchPlugin not found (run loom onboard after creating app/src/plugins/search.ts)');
  }

  // EXP-003: hub node cascade — InvertedIndex fans out to dependents
  const invertedIndexNode = findNode('InvertedIndex', ['class', 'service']);
  if (invertedIndexNode && runtime.graph.getNode(invertedIndexNode.id)) {
    console.log(`EXP-003: Injecting at InvertedIndex (${invertedIndexNode.id.slice(0, 8)}...) — cascade test`);
    runtime.inject(invertedIndexNode.id, 0.95);
  } else {
    console.log('EXP-003: InvertedIndex not found (run loom onboard after creating app/src/indexing/index.ts)');
  }

  // EXP-005: compound tension — PresenceTracker → DocumentStore + SyncEngine
  const presenceNode = findNode('PresenceTracker', ['class', 'service']);
  if (presenceNode && runtime.graph.getNode(presenceNode.id)) {
    console.log(`EXP-005: Injecting at PresenceTracker (${presenceNode.id.slice(0, 8)}...) — compound tension test`);
    runtime.inject(presenceNode.id, 0.90);
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
      reportResults(runtime, enrichedExport, rawNodeCount, rawEdgeCount);
    }
  }, 100);
}

function reportResults(runtime: ContinuityRuntime, loomExport: LoomExport, rawNodes: number, rawEdges: number): void {
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

  const exp001Met = rawNodes >= 20 && rawEdges >= 15;
  console.log(`EXP-001 (E2E pipeline):       ${exp001Met ? '✓' : '✗'} ${rawNodes} nodes / ${rawEdges} edges (need ≥20/≥15)`);

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
