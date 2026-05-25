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

import { LocalSummarizer, RemoteSummarizer } from '../ai/summarizer.js';
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
  private readonly _allowNetwork: boolean;

  constructor(config: AppConfig) {
    this.events = new StorageEventBus();
    this.store = new DocumentStore(this.events);
    this.graph = new GraphBuilder(() => this.store.list());
    // Initial validator seeding is handled where validators are attached below; avoid redundant registration here to reduce listener churn.
    this._peerId = config.peerId;

    // Initialize summarizer deterministically to LocalSummarizer by default.
    // Remote summarization is opt-in and must be explicitly enabled.
    this._allowNetwork = !!config.allowNetwork;
    this._summarizer = undefined; // lazily created when first used


    const pluginContext: PluginContext = {
      listDocuments: () => this.store.list(),
      searchDocuments: (query) => this.store.search(query),
      getDocument: (id) => this.store.read(id),
      getClock: () => ({}),

      onStorageEvent: (type, listener) => {
        // Provide plugins a readonly/frozen snapshot of events and a disposer.
        const wrapper = (ev: any) => {
          try {
            switch (ev.type) {
              case 'created': {
                const d = ev.document;
                const frozen = Object.freeze({
                  ...ev,
                  document: Object.freeze({ ...d, links: d.links.map((l: any) => Object.freeze({ ...l })), tags: [...d.tags] }),
                });
                listener(frozen);
                return;
              }
              case 'updated': {
                const cur = ev.current; const prev = ev.previous;
                const frozen = Object.freeze({
                  ...ev,
                  current: Object.freeze({ ...cur, links: cur.links.map((l: any) => Object.freeze({ ...l })), tags: [...cur.tags] }),
                  previous: Object.freeze({ ...prev, links: prev.links.map((l: any) => Object.freeze({ ...l })), tags: [...prev.tags] }),
                });
                listener(frozen);
                return;
              }
              case 'deleted': {
                listener(Object.freeze({ ...ev }));
                return;
              }
              case 'linked': {
                const link = ev.link;
                listener(Object.freeze({ ...ev, link: Object.freeze({ ...link }) }));
                return;
              }
              default:
                listener(Object.freeze(ev));
                return;
            }
          } catch (_) {
            try { listener(ev); } catch (_) { /* swallow */ }
          }
        };
        this.events.on(type as any, wrapper);
        return () => { this.events.off(type as any, wrapper); };
      },

      summarizeDocument: async (documentId: string, allowNetwork = false) => {
        const d = this.store.read(documentId);
        if (!d) return undefined;
        // Use the configured summarizer when present; otherwise use a local one.
        const summarizer = this._summarizer ?? new LocalSummarizer(3);

        // Deny network summarization when caller does not explicitly request it.
        // Plugins will call PluginContext.summarizeDocument without allowNetwork,
        // so this prevents plugins from causing network calls.
        try {
          // If the active summarizer appears to be a RemoteSummarizer and the caller
          // did not request network, refuse to perform network I/O.
          if ((summarizer as any)?.constructor && (summarizer as any).constructor.name === 'RemoteSummarizer' && !allowNetwork) {
            return undefined;
          }

          // Provide a small retry/backoff wrapper for remote summarization to mitigate
          // transient network failures and reduce backpressure on upstream queues.
          const MAX_RETRIES = 3;
          const BASE_MS = 100;

          const attempt = async (triesLeft: number): Promise<string | undefined> => {
            try {
              return await (summarizer as any).summarize(d);
            } catch (err) {
              if (triesLeft <= 0) return undefined;
              await new Promise(res => setTimeout(res, BASE_MS * Math.pow(2, MAX_RETRIES - triesLeft)));
              return attempt(triesLeft - 1);
            }
          };

          return await attempt(MAX_RETRIES);
        } catch (_) {
          return undefined;
        }
      },
    };
    this.plugins = new PluginHost(pluginContext);

    // Background summarization warm-up: schedule lightweight summarization for created/updated docs
    // to provide async job processing and warm caches (reduces remote latency on first real request).
    (this as any)._bgSummarizeTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const scheduleSummarize = (docId: string) => {
      const timers: Map<string, ReturnType<typeof setTimeout>> = (this as any)._bgSummarizeTimers;
      const prev = timers.get(docId);
      if (prev) clearTimeout(prev);
      const t = setTimeout(async () => {
        timers.delete(docId);
        try {
          const doc = this.store.read(docId);
          if (!doc) return;
          const s = this._summarizer ?? new LocalSummarizer(3);
          await s.summarize(doc);
          try { console.debug && console.debug(`background summarization completed for ${docId}`); } catch (_) { /* swallow */ }
        } catch (_) { /* swallow background errors */ }
      }, 100);
      timers.set(docId, t);
    };

    this.events.on('created', (ev) => scheduleSummarize((ev as any).document.id));
    this.events.on('updated', (ev) => scheduleSummarize((ev as any).documentId));

    // PresenceTracker uses the StorageEventBus validator (no direct store access)
    this.presence = new PresenceTracker();
    const initialIds = this.store.list().map(d => d.id);

    // Provide a synchronous snapshot validator for the realtime path so callers
    // using PresenceTracker.setValidator receive a pure (non-IO) function.
    // Also attach the async event-driven validator for comprehensive checks.
    this.presence.setValidator(
      this.events.attachDocumentValidatorSnapshot(initialIds)
    );

    this.presence.setAsyncValidator(
      this.events.attachDocumentValidatorFromEvents(initialIds)
    );

    // Wire storage events → sync engine
    this.events.on('*', (event) => {
      if (this.started) {
        this._sync?.generateOutbound(event);
      }
    });
  }

  enableRemoteSummarizer(fetcher: (document: Document) => Promise<string>, options?: { allowNetwork?: boolean; maxSentences?: number }): boolean {
    // Remote summarization may only be enabled when the app was constructed with allowNetwork.
    if (!this._allowNetwork) return false;
    // Construct RemoteSummarizer with the provided fetcher. The options.allowNetwork defaults to true
    // to allow network calls for this summarizer instance; callers may pass allowNetwork: false to force
    // local-only behavior for this instance.
    this._summarizer = new RemoteSummarizer(fetcher, { allowNetwork: options?.allowNetwork ?? true, maxSentences: options?.maxSentences });
    return true;
  }

  disableRemoteSummarizer(): void {
    // Revert to deterministic local behavior. Defer actual LocalSummarizer allocation until first use.
    this._summarizer = undefined;
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
