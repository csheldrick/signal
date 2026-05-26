// ── Signal Application ──────────────────────────────────────
// Wires all subsystems together. High fan-out node importing
// from every module — gives Loom a central hub in the graph.

import { DocumentStore } from '../storage/store.js';
import { StorageEventBus, StorageEventBusContract } from '../storage/events.js';
import { GraphBuilder } from '../graph/builder.js';
import { createInvertedIndex, Indexer } from '../index/inverted.js';
import { PluginHost } from '../plugins/host.js';
import type { PluginContext } from '../plugins/host.js';
import { SyncEngine } from '../sync/engine.js';
import { PresenceTracker } from '../collaboration/presence.js';
import { setSignalStorageEventBus, getDisableBgSummarize } from './globals.js';
import { getSyncEngineFromStore } from '../storage/syncEngineRegistry.js';
import { createLazyGraph, createLazyPluginHost, createLazyPresenceTracker } from './factories.js';

import { LocalSummarizer, RemoteSummarizer } from '../ai/summarizer.js';
import type { Summarizer } from '../ai/summarizer.js';
import type { Document, DocumentSnapshot } from '../core/types.js';

export interface AppConfig {
  dataPath: string;
  peerId: string;
  /** Allow remote summarization (must be explicitly enabled) */
  allowNetwork?: boolean;
  /** Optional network authentication token required to enable remote summarization. */
  networkAuthToken?: string;
  /** When true, background summarization timers will be disabled (useful for tests) */
  disableBackgroundSummarize?: boolean;
}

export class SignalApp {
  readonly store: DocumentStore;
  readonly events: StorageEventBus;
  readonly eventsContract: StorageEventBusContract;
  readonly graph: GraphBuilder;
  readonly plugins: PluginHost;
  readonly presence: PresenceTracker;
  /* sync lazy-initialized at start */
  /* summarizer lazy-initialized at start */

  private started = false;
  private readonly _peerId: string;
  private _sync?: SyncEngine;
  private _summarizer?: Summarizer;
  private readonly _localSummarizer: LocalSummarizer;
  private readonly _allowNetwork: boolean;
  private readonly _networkAuthToken?: string;
  private readonly _disableBgSummarize: boolean;

  constructor(config: AppConfig) {
    this.events = new StorageEventBus();
    // Provide a contract-typed view over the concrete event bus instance so
    // lightly-coupled components can depend on the StorageEventBusContract
    // without requiring the concrete class. This preserves existing callers
    // that expect the concrete StorageEventBus while making the contract
    // discoverable for architectural analysis and decoupling.
    this.eventsContract = this.events;
    // Expose the app StorageEventBus on a small, well-known global slot so
    // lightly-coupled components (e.g. PresenceTracker wrappers) can emit
    // session lifecycle events without requiring an additional constructor
    // parameter. Defensive: swallow failures to avoid breaking tests/environments
    // without a globalThis writable slot.
    // Only expose the StorageEventBus via globalThis when explicitly opted-in.
    // Default behaviour is to avoid writing to globals to reduce implicit
    // process-wide coupling and to keep the application a well-typed, explicit
    // dependency graph. Set env SIGNAL_ALLOW_GLOBALS=true to opt-in for
    // backwards compatibility in environments that require the global slot.
    if (typeof setSignalStorageEventBus === 'function' && (typeof process !== 'undefined' && process.env && process.env.SIGNAL_ALLOW_GLOBALS === 'true')) {
      try { setSignalStorageEventBus(this.events); } catch (_) {}
    }
    this.store = new DocumentStore(this.events);
    this.graph = createLazyGraph(() => { try { const l = this.store.list(); return Array.isArray(l) ? l.slice(0, 500) : []; } catch (_) { return []; } });
    // Create a lightweight inverted index and an Indexer that listens to
    // the StorageEventBus. Historically we created these eagerly which
    // increases startup fan-out (many listeners and background work).
    // Defer creation until first use to minimize startup overhead and
    // avoid registering listeners unless indexing is actually required.
    (this as any)._invertedIndex = undefined;
    (this as any)._indexer = undefined;
    // Provide a best-effort factory so diagnostics or other code can
    // instantiate the indexer on demand without making it part of the
    // startup critical path.
    (this as any)._createInvertedIndex = () => {
      try {
        if ((this as any)._invertedIndex) return (this as any)._invertedIndex;
        const idx = createInvertedIndex();
        try {
          const indexer = new Indexer(this.events, idx);
          (this as any)._invertedIndex = idx;
          (this as any)._indexer = indexer;
        } catch (_) { /* swallow indexer construction errors */ }
        return (this as any)._invertedIndex;
      } catch (_) {
        // If index creation fails, return undefined but do not crash startup.
        return undefined;
      }
    };
    // Initial validator seeding is handled where validators are attached below; avoid redundant registration here to reduce listener churn.
    this._peerId = config.peerId;

    // Initialize summarizer deterministically to LocalSummarizer by default.
    // Remote summarization is opt-in and must be explicitly enabled.
    this._allowNetwork = !!config.allowNetwork;
    this._networkAuthToken = config.networkAuthToken;
    this._disableBgSummarize = !!config.disableBackgroundSummarize;
    this._summarizer = undefined; // lazily created when first used
    // Shared LocalSummarizer used throughout the app to avoid creating many
    // ephemeral instances which increase subsystem fan-out and memory churn.
    this._localSummarizer = new LocalSummarizer(3);


    // Provide safe, defensive clones to plugins so they cannot mutate internal store state.
    const cloneDoc = (d: any) => {
      if (!d) return d;
      return {
        ...d,
        links: Array.isArray(d.links) ? d.links.map((l: any) => ({ ...l })) : [],
        tags: Array.isArray(d.tags) ? [...d.tags] : [],
      };
    };

    let remoteSummarizeInFlight = 0;
    const MAX_CONCURRENT_REMOTE_SUMMARIES = 3;

    const pluginContext: PluginContext = {
      listDocuments: (() => {
        // Short-lived cache to reduce repeated expensive cloning for plugin calls.
        let cachedTs = 0;
        let cached: ReadonlyArray<Readonly<DocumentSnapshot>> = [];
        const TTL_MS = 100;
        return () => {
          try {
            const now = Date.now();
            if (now - cachedTs < TTL_MS) return cached;
            const list = this.store.list();
            const MAX_PLUGIN_LIST = 200;
            const results = Array.isArray(list) ? list.slice(0, MAX_PLUGIN_LIST).map((d: any) => cloneDoc(d)) : [];
            cachedTs = now;
            cached = results;
            return results;
          } catch (_) {
            return [];
          }
        };
      })(),
      searchDocuments: (query) => {
        try {
          const res = this.store.search(query) as any[];
          return Array.isArray(res) ? res.map((r: any) => ({ document: cloneDoc((r as any).document), score: (r as any).score ?? 0, highlights: Array.isArray((r as any).highlights) ? [...(r as any).highlights] : [] })) : [];
        } catch (_) {
          return [];
        }
      },
      getDocument: (id) => {
        try {
          const d = this.store.read(id) as any;
          return d ? cloneDoc(d) : undefined;
        } catch (_) {
          return undefined;
        }
      },
      getClock: () => {
        try {
          // Prefer the active SyncEngine clock when available so plugins receive
          // a meaningful view of the current vector clock. Return a shallow
          // copy to avoid exposing internal mutable state.
          const maybeSync = (() => {
            try {
              // Prefer a canonical engine published on the store (if present)
              // to avoid accidental duplicate SyncEngine instances and to
              // centralize engine registration. Fall back to the app-local
              // _sync only if the store does not expose a registered engine.
              const fromStore = (this.store ? getSyncEngineFromStore(this.store) : undefined);
              if (fromStore && typeof fromStore.getClock === 'function') return fromStore;
            } catch (_) { /* swallow */ }
            try { return (this as any)._sync; } catch (_) { return undefined; }
          })();
          if (maybeSync && typeof maybeSync.getClock === 'function') {
            try {
              const c = maybeSync.getClock();
              return (c && typeof c === 'object') ? { ...c } : {};
            } catch (_) {
              return {};
            }
          }
        } catch (_) {
          /* swallow */
        }
        return {};
      },

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
        if (typeof (this.events as any).onAsync === 'function') {
          (this.events as any).onAsync(type as any, wrapper);
        } else {
          // Fallback to on() for older buses; prefer async registration when available
          this.events.on(type as any, wrapper);
        }
        return () => { this.events.off(type as any, wrapper); };
      },

      summarizeDocument: async (documentId: string, allowNetwork = false) => {
        const d = this.store.read(documentId);
        if (!d) return undefined;
        // Use the configured summarizer when present; otherwise use a local one.
        const summarizer: Summarizer = this._summarizer ?? this._localSummarizer;

        // Deny network summarization when caller does not explicitly request it.
        try {
          if (summarizer.isRemote && (!allowNetwork || !summarizer.allowsNetwork)) {
            return undefined;
          }

          const isRemote = summarizer.isRemote;
          // If remote, enforce a simple concurrency cap to avoid unbounded
          // in-flight remote requests that can backlog and affect realtime flows.
          if (isRemote && remoteSummarizeInFlight >= MAX_CONCURRENT_REMOTE_SUMMARIES) {
            return undefined;
          }

          const MAX_RETRIES = 3;
          const BASE_MS = 100;

          const attempt = async (triesLeft: number): Promise<string | undefined> => {
            try {
              if (isRemote) remoteSummarizeInFlight++;
              try {
                return await summarizer.summarize(d);
              } finally {
                if (isRemote) {
                  try { remoteSummarizeInFlight = Math.max(0, remoteSummarizeInFlight - 1); } catch (_) { remoteSummarizeInFlight = 0; }
                }
              }
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
    // Lazy PluginHost instantiation to reduce startup fan-out and avoid
    // constructing the full plugin subsystem until it's actually used.
    this.plugins = createLazyPluginHost(pluginContext);
    // Lazy PresenceTracker to avoid starting background timers and IO until needed.
    this.presence = createLazyPresenceTracker(() => pluginContext);

    // Background summarization warm-up: schedule lightweight summarization for created/updated docs
    // to provide async job processing and warm caches (reduces remote latency on first real request).
    (this as any)._bgSummarizeTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Background summarization is useful in production but creates timers and
    // potential network activity that hinder test adoption and increase
    // subsystem fan-out. Allow disabling in test environments or via an
    // explicit global opt-out to make the subsystem safe for test runs.
    const scheduleSummarize = (docId: string) => {
      const disabled = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') ||
        (!!getDisableBgSummarize()) ||
        this._disableBgSummarize;
      if (disabled) return;
      if (!docId) return;

      // Per-doc timers map (shared on the instance). _bgSummarizeTimers was already created above.
      const timers: Map<string, ReturnType<typeof setTimeout>> = (this as any)._bgSummarizeTimers;
      const prev = timers.get(docId);
      if (prev) clearTimeout(prev);

      // Maintain a lightweight per-doc last-summarized timestamp to avoid
      // repeated background summarization for the same document in quick
      // succession which can create a resonance loop under high update rates.
      const lastMap: Map<string, number> = ((this as any)._bgSummarizeLast as Map<string, number>) || new Map();
      (this as any)._bgSummarizeLast = lastMap;
      const MIN_INTERVAL_MS = 5_000; // do not summarize the same doc more frequently than this
      const now = Date.now();
      const last = lastMap.get(docId) ?? 0;

      // If we've summarized recently, avoid scheduling an immediate heavy run.
      // Instead, put a short placeholder timer to clear previous scheduling and
      // avoid building up timer churn. This prevents a cascade where background
      // summarization triggers more storage events that re-schedule it.
      if (now - last < MIN_INTERVAL_MS) {
        // keep a short, cheap timer to collapse repeated triggers without doing work
        const shortT = setTimeout(() => { try { timers.delete(docId); } catch (_) {} }, 750);
        timers.set(docId, shortT);
        return;
      }

      // Concurrency & queueing: bound concurrent background summarization jobs
      // to avoid unbounded CPU/network pressure from many timers firing.
      const MAX_CONCURRENT_BG = 2; // conservative default
      const MAX_QUEUE = 1000; // bounded queue size to avoid memory growth

      // Initialize shared counters/queue on the app instance if absent.
      if (!((this as any)._bgSummarizeActive)) (this as any)._bgSummarizeActive = 0;
      if (!((this as any)._bgSummarizeQueue)) (this as any)._bgSummarizeQueue = [] as string[];

      const active = (this as any)._bgSummarizeActive as number;
      const queue = (this as any)._bgSummarizeQueue as string[];

      const scheduleJob = (id: string) => {
        // Job runner that performs the summary and drains the queue when done.
        (this as any)._bgSummarizeActive = ((this as any)._bgSummarizeActive as number) + 1;
        const t = setTimeout(async () => {
          // Clear per-doc timer slot immediately (we're running it now)
          try { timers.delete(id); } catch (_) {}
          try {
            const doc = this.store.read(id);
            if (doc) {
              try {
                await this._localSummarizer.summarize(doc);
                try { lastMap.set(id, Date.now()); } catch (_) {}
                try { console.debug && console.debug(`background summarization completed for ${id}`); } catch (_) {}
              } catch (_) {
                // swallow summarization errors; do not update lastMap so future attempts can retry
              }
            }
          } catch (_) { /* swallow background errors */ }
          // Mark job finished and try to drain a queued job.
          try {
            (this as any)._bgSummarizeActive = Math.max(0, ((this as any)._bgSummarizeActive as number) - 1);
            const next = (this as any)._bgSummarizeQueue.shift();
            if (next) {
              // Use a short defer to avoid deep synchronous recursion and to
              // give the event loop a chance to schedule other work.
              setTimeout(() => {
                try { scheduleSummarize(next); } catch (_) {}
              }, 0);
            }
          } catch (_) { /* swallow */ }
        }, 2000);

        timers.set(id, t);
      };

      if (active < MAX_CONCURRENT_BG) {
        // Run immediately within concurrency limits.
        scheduleJob(docId);
        return;
      }

      // Otherwise attempt to enqueue; if the queue is full, drop the request
      // (best-effort protection against overload). We still set a short timer
      // so the per-doc timers map does not grow unboundedly.
      if (queue.length >= MAX_QUEUE) {
        const shortT = setTimeout(() => { try { timers.delete(docId); } catch (_) {} }, 750);
        timers.set(docId, shortT);
        return;
      }

      queue.push(docId);
      // Keep a lightweight placeholder timer so callers see that the request is
      // scheduled (and so that callers that rely on timers being present behave).
      const placeholder = setTimeout(() => { try { /* placeholder expired */ timers.delete(docId); } catch (_) {} }, 500);
      timers.set(docId, placeholder);
    };

    const bgDisabled = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') ||
      (!!getDisableBgSummarize()) ||
      this._disableBgSummarize;
    if (!bgDisabled) {
      // Prefer async registration to avoid heavy synchronous fan-out on
      // storage events (which can overload realtime subsystems). Fall back
      // to on() for older buses for compatibility.
      try {
        if (typeof (this.events as any).onAsync === 'function') {
          (this.events as any).onAsync('created', (ev: any) => scheduleSummarize(ev && ev.document && ev.document.id ? ev.document.id : ''));
          (this.events as any).onAsync('updated', (ev: any) => scheduleSummarize(ev && ev.documentId ? ev.documentId : ''));
        } else {
          this.events.on('created', (ev) => scheduleSummarize((ev as any).document.id));
          this.events.on('updated', (ev) => scheduleSummarize((ev as any).documentId));
        }
      } catch (_) {
        // Defensive fallbacks: if anything goes wrong prefer synchronous
        // registration over failing to register at all, but swallow errors.
        try { this.events.on('created', (ev) => scheduleSummarize((ev as any).document.id)); } catch (_) {}
        try { this.events.on('updated', (ev) => scheduleSummarize((ev as any).documentId)); } catch (_) {}
      }
    }

    // PresenceTracker uses the StorageEventBus validator (no direct store access)
    this.presence = new PresenceTracker();
    try {
      // Wire the sandboxed PluginContext into PresenceTracker so it can validate
      // documents without directly accessing the store.
      if (typeof (this.presence as any).setPluginContext === 'function') {
        (this.presence as any).setPluginContext(pluginContext);
      }
    } catch (_) { /* swallow */ }
    const initialIds = this.store.list().map(d => d.id);

    // Provide a synchronous snapshot validator for the realtime path so callers
    // using PresenceTracker.setValidator receive a pure (non-IO) function.
    // Also attach the async event-driven validator for comprehensive checks.
    // Use a single shared existence set and one listener for both sync and async
    // validators to avoid registering two separate '*' listeners which increases fan-out.
    // Use the StorageEventBus-provided snapshot validator to avoid creating
    // an ad-hoc '*' listener here. The snapshot validator maintains an
    // internal Set and exposes a synchronous validator with a dispose method;
    // reuse it for both sync and async presence validation to avoid duplicating
    // listeners that increase StorageEventBus fan-out.
    const snapshotValidator = this.events.attachDocumentValidatorSnapshot(initialIds);

    const syncValidator = snapshotValidator;
    const asyncValidator = async (id: string) => snapshotValidator(id);

    // Ensure disposers release the underlying bus listener when presence no
    // longer needs validation.
    (syncValidator as any).dispose = () => { try { (snapshotValidator as any).dispose && (snapshotValidator as any).dispose(); } catch (_) {} };
    (asyncValidator as any).dispose = () => { try { (snapshotValidator as any).dispose && (snapshotValidator as any).dispose(); } catch (_) {} };

    this.presence.setValidator(syncValidator);
    this.presence.setAsyncValidator(asyncValidator);

    // Storage events are forwarded to the SyncEngine internally when appropriate.
    // Avoid registering a second, duplicate forwarder here to prevent duplicate
    // outbound message generation (the SyncEngine subscribes to store events itself).
  }

  enableRemoteSummarizer(fetcher: (document: Document, opts?: { authToken?: string }) => Promise<string>, options?: { allowNetwork?: boolean; maxSentences?: number }): boolean {
    // Remote summarization may only be enabled when the app was constructed with allowNetwork.
    if (!this._allowNetwork) return false;
    // Require an explicit network authentication token to avoid accidental
    // enabling of the remote summarizer subsystem.
    if (!this._networkAuthToken) return false;
    // Construct RemoteSummarizer with the provided fetcher. The options.allowNetwork defaults to true
    // to allow network calls for this summarizer instance; callers may pass allowNetwork: false to force
    // local-only behavior for this instance.
    // Support backward-compatible single-arg fetchers by wrapping them in a function that enforces an authToken
    // is supplied via the options bag. This makes the network-auth contract explicit.
    const effectiveFetcher = (fetcher as any).length === 1
      ? (doc: Document, opts?: { authToken?: string }) => {
        if (!opts || !opts.authToken) return Promise.reject(new Error('auth token required'));
        return (fetcher as any)(doc);
      }
      : fetcher;

    this._summarizer = new RemoteSummarizer(effectiveFetcher, { allowNetwork: options?.allowNetwork ?? true, maxSentences: options?.maxSentences, authToken: this._networkAuthToken });
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
    if (!this._sync) {
      // Reuse the same engine instance that SyncManager uses when possible to
      // avoid creating duplicate SyncEngine instances for the same
      // DocumentStore. SyncManager caches the engine on the store under a
      // private non-enumerable property named '__signal_sync_engine__'.
      const ENGINE_KEY = '__signal_sync_engine__';
      const cached = (this.store as any)[ENGINE_KEY] as SyncEngine | undefined;
      if (cached) {
        this._sync = cached;
      } else {
        // Create a new engine and publish it to the store for other callers
        // to reuse. Be robust against races: if construction throws because
        // another actor created an engine concurrently, prefer the installed
        // engine. If no engine is installed, rethrow the error so callers can
        // observe the misconfiguration.
        try {
          let created: SyncEngine;
          try {
            // Attempt to create a new engine. If another actor created one
            // concurrently, the SyncEngine constructor may throw to signal a
            // duplicate binding; handle that deterministically below.
            created = new SyncEngine(this.store, this._peerId);
          } catch (err) {
            // If construction failed, prefer an already-installed engine on the
            // store (the preferred shared instance). If one exists, adopt it;
            // otherwise rethrow to surface the configuration error to callers.
            const installed = (this.store as any)[ENGINE_KEY] as SyncEngine | undefined;
            if (installed) {
              this._sync = installed;
              created = installed;
            } else {
              throw err;
            }
          }

          // If we don't yet have a cached engine reference, publish the one
          // we created/adopted on the store so other callers can reuse it.
          if (!this._sync) {
            this._sync = created;
            try {
              Object.defineProperty(this.store, ENGINE_KEY, { value: created, configurable: true, enumerable: false, writable: true });
            } catch (_) {
              // Best-effort fallback for environments that disallow defineProperty
              (this.store as any)[ENGINE_KEY] = created;
            }
          }
          try {
            Object.defineProperty(this.store, ENGINE_KEY, { value: created, enumerable: false, configurable: true });
          } catch (_){
            // Fallback for environments that restrict defineProperty.
            (this.store as any)[ENGINE_KEY] = created;
          }
          this._sync = created;
        } catch (err) {
          // If another actor installed an engine in the interim, use it.
          const installed = (this.store as any)[ENGINE_KEY] as SyncEngine | undefined;
          if (installed) {
            this._sync = installed;
          } else {
            // No installed engine found; rethrow so the caller sees the real error.
            throw err;
          }
        }
      }
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
