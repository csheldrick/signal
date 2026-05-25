// ── Signal Application ──────────────────────────────────────
// Wires all subsystems together. High fan-out node importing
// from every module — gives Loom a central hub in the graph.

import { DocumentStore } from '../storage/store.js';
import { StorageEventBus } from '../storage/events.js';
import { GraphBuilder } from '../graph/builder.js';
import { PluginHost } from '../plugins/host.js';
import type { PluginContext } from '../plugins/host.js';
import { SyncEngine } from '../sync/engine.js';
import { PresenceTracker } from '../collaboration/presence.js';

import { LocalSummarizer } from '../ai/summarizer.js';
import type { Summarizer } from '../ai/summarizer.js';
import type { Document } from '../core/types.js';

export interface AppConfig {
  dataPath: string;
  peerId: string;
  /** Allow remote summarization (must be explicitly enabled) */
  allowNetwork?: boolean;
}

export class SignalApp {
  readonly store: DocumentStore;
  readonly events: StorageEventBus;
  readonly graph: GraphBuilder;
  readonly plugins: PluginHost;
  readonly presence: PresenceTracker;
  /* sync lazy-initialized at start */
  /* summarizer lazy-initialized at start */

  private started = false;
  private readonly _peerId: string;
  private _sync?: SyncEngine;
  private _summarizer?: Summarizer;

  constructor(config: AppConfig) {
    this.events = new StorageEventBus();
    this.store = new DocumentStore(this.events);
    this.graph = new GraphBuilder(() => this.store.list());
    // Seed StorageEventBus validator with current document ids to support presence checks without direct store access
    this.events.attachDocumentValidatorFromEvents(this.store.list().map(d => d.id));
    this._peerId = config.peerId;

    // Initialize summarizer deterministically to LocalSummarizer by default.
    // Remote summarization is opt-in and must be explicitly enabled.
    this._summarizer = new LocalSummarizer();


    const pluginContext: PluginContext = {
      listDocuments: () => this.store.list(),
      searchDocuments: (query) => this.store.search(query),
      getDocument: (id) => this.store.read(id),
    };
    this.plugins = new PluginHost(pluginContext);

    // PresenceTracker uses the StorageEventBus validator (no direct store access)
    this.presence = new PresenceTracker(this.store, undefined);
    this.presence.setAsyncValidator(
      this.events.attachDocumentValidatorFromEvents(this.store.list().map(d => d.id))
    );

    // Wire storage events → sync engine
    this.events.on('*', (event) => {
      if (this.started) {
        this._sync?.generateOutbound(event);
      }
    });
  }

  start(dataPath?: string): void {
    if (this.started) return;
    if (dataPath) {
      this.store.load(dataPath);
    }
    // Lazy-initialize subsystems that are safe to defer until app start
    // summarizer is initialized lazily when first needed (avoid runtime import and coupling)
    if (!this._sync) this._sync = new SyncEngine(this.store, this._peerId);
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
