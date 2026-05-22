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
import { ContinuityRuntime, ContradictionDetectionOperator, GraphClusteringOperator, } from 'weave';
// Loom packages are CommonJS — use createRequire to import them from ESM
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loomGraph = require('@loom/graph');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GraphStore = loomGraph.GraphStore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LoomExporter = loomGraph.LoomExporter;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNAL_ROOT = resolve(__dirname, '../../');
const LOOM_DB = resolve(SIGNAL_ROOT, '.loom/loom.db');
const LOOM_CONFIG = resolve(SIGNAL_ROOT, '.loom/config.json');
const WEAVE_DB = resolve(SIGNAL_ROOT, '.weave/substrate.db');
// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n═══ Signal Experiment Runner ═══\n');
    // 1. Load Loom workspace
    if (!existsSync(LOOM_DB) || !existsSync(LOOM_CONFIG)) {
        console.error('✗ No Loom workspace found. Run `loom onboard` in the signal root first.');
        process.exit(1);
    }
    const config = JSON.parse(readFileSync(LOOM_CONFIG, 'utf-8'));
    console.log(`Loom workspace:  ${config.name} (${config.graphId.slice(0, 8)}...)`);
    const store = new GraphStore(LOOM_DB);
    const exporter = new LoomExporter(store);
    // 2. Build LoomExport
    const loomExport = exporter.buildExport(config.graphId, {
        repository: 'signal',
    });
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
    // 7. Wire Utilis intent handler (logs intents — swap in createIntentHandler() for real execution)
    runtime.setIntentHandler(async (intent) => {
        const now = new Date().toISOString();
        console.log(`\n⚡ ExecutionIntent fired!`);
        console.log(`   mode:     ${intent.mode}`);
        console.log(`   taskType: ${intent.taskType ?? 'general'}`);
        console.log(`   prompt:   ${intent.prompt.slice(0, 80)}...`);
        // To connect real Utilis execution:
        //   import { createIntentHandler } from '@utilis/core';
        //   import { buildAgent } from './utilis-setup.js';
        //   const handler = createIntentHandler({ agent: await buildAgent() });
        //   runtime.setIntentHandler(handler);
        return {
            intentId: intent.intentId,
            completedAt: now,
            status: 'ok',
            content: '[stub] Intent logged. Wire createIntentHandler() for real execution.',
            providerId: 'stub',
            model: 'stub',
            taskType: intent.taskType ?? 'general',
            complexityTier: intent.complexity ?? 'low',
            fallbackUsed: false,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
        };
    });
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
    //    plugins/search.ts directly imports from storage/store.ts
    const violationNodeId = resolve(SIGNAL_ROOT, 'app/src/plugins/search.ts');
    const relativeViolation = 'app/src/plugins/search.ts';
    // Try both absolute and relative node IDs (Loom may use either)
    const violationNode = runtime.graph.getNode(violationNodeId) ?? runtime.graph.getNode(relativeViolation);
    if (violationNode) {
        console.log('\nInjecting activation at boundary-violating node (EXP-002)...');
        runtime.inject(violationNode.id, 0.8);
    }
    else {
        console.log('\nNote: boundary-violation node not found in graph yet (run loom onboard after creating app/src/plugins/search.ts)');
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
function reportResults(runtime) {
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
    }
    else {
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
