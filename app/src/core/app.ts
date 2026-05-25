// ── Signal Application ──────────────────────────────────────
// Wires all subsystems together. High fan-out node importing
// from every module — gives Loom a central hub in the graph.

import { DocumentStore } from '../storage/store.js';
import { StorageEventBus } from '../storage/events.js';
import { GraphBuilder } from '../graph/builder.js';
import { PluginHost } from '../plugins/host.js';
import type { PluginContext } from '../plugins/host.js';
import { SyncEngine } from '../sync/engine.js';

import { LocalSummarizer, type Summarizer } from '../ai/summarizer.js';
import type { Document } from '../core/types.js';

export interface AppConfig {
  dataPath: string;
  peerId: string;
}

export class SignalApp {
  readonly store: DocumentStore;
  readonly events: StorageEventBus;
  readonly graph: GraphBuilder;
  readonly plugins: PluginHost;
  readonly sync: SyncEngine;
  readonly summarizer: Summarizer;

  private started = false;

  constructor(config: AppConfig) {
    this.events = new StorageEventBus();
    this.store = new DocumentStore(this.events);
    this.graph = new GraphBuilder(this.store);
    this.summarizer = new LocalSummarizer(3);
    this.sync = new SyncEngine(this.store, config.peerId);

    const pluginContext: PluginContext = {
      listDocuments: () => this.store.list(),
      searchDocuments: (query) => this.store.search(query),
      getDocument: (id) => this.store.read(id),
    };
    this.plugins = new PluginHost(pluginContext);

    // Wire storage events → sync engine
    this.events.on('*', (event) => {
      if (this.started) {
        this.sync.generateOutbound(event);
      }
    });
  }

  start(dataPath?: string): void {
    if (this.started) return;
    if (dataPath) {
      this.store.load(dataPath);
    }
    this.started = true;
  }

  shutdown(dataPath?: string): void {
    if (!this.started) return;
    this.started = false;

    // Disable all plugins
    for (const p of this.plugins.list()) {
      if (p.enabled) this.plugins.disable(p.id);
    }

    if (dataPath) {
      this.store.save(dataPath);
    }
  }

  isRunning(): boolean {
    return this.started;
  }
}
