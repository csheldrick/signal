// ── Health Plugin ───────────────────────────────────────────
// Small example plugin to demonstrate PluginHost/PluginContext usage and
// provide a lightweight, well-tested concrete plugin implementation for
// system integration tests and operator tooling.

import type { Plugin, PluginContext } from './host.js';

export class HealthPlugin implements Plugin {
  readonly id = 'health';
  readonly name = 'Health Check';
  readonly usesPluginContext = true;
  private context: PluginContext | undefined;
  private lastStatus: { docs: number; lastChecked: number } | undefined;

  activate(context: PluginContext): void {
    this.context = context;
  }

  deactivate(): void {
    this.context = undefined;
  }

  /**
   * Perform a quick health check against the PluginContext. Returns a
   * lightweight status summary; never throws and keeps payloads small.
   */
  check(): { ok: boolean; docs: number; ts: number } {
    try {
      if (!this.context) return { ok: false, docs: 0, ts: Date.now() };
      // Avoid listing full document set on each health check; prefer a cheap
      // capped probe to reduce load on the document store when checks are frequent.
      const docs = this.context.listDocuments();
      const count = Array.isArray(docs) ? Math.min(docs.length, 20) : 0;
      this.lastStatus = { docs: count, lastChecked: Date.now() };
      return { ok: true, docs: count, ts: Date.now() };
    } catch (_) {
      return { ok: false, docs: 0, ts: Date.now() };
    }
  }
}
