// ── Signal Application ──────────────────────────────────────
// Wires all subsystems together. High fan-out node importing
// from every module — gives Loom a central hub in the graph.

import { DocumentStore } from '../storage/store.js';
import { StorageEventBus, StorageEventBusContract } from '../storage/events.js';
import { GraphBuilder } from '../graph/builder.js';
import { createInvertedIndex, Indexer } from '../index/inverted.js';
import type { PresenceTracker as PresenceTrackerContract, OfflineSyncQueue as OfflineSyncQueueContract } from '../core/types.js';
import { PluginHost } from '../plugins/host.js';
import type { PluginContext } from '../plugins/host.js';
import { SyncEngine } from '../sync/engine.js';
import { PresenceTracker } from '../collaboration/presence.js';
import { setSignalStorageEventBus, getDisableBgSummarize } from './globals.js';
import { getSyncEngineFromStore } from '../storage/syncEngineRegistry.js';
import { createLazyGraph, createLazyPluginHost, createLazyPresenceTracker } from './factories.js';

import type { Document, DocumentSnapshot, Summarizer } from '../core/types.js';


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
  private _localSummarizer: any;
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
    // Prefer shared singleton to avoid accidental multiple stores in normal app usage.
    try {
      // Use singleton factory when available; fall back to direct construction.
      const { getOrCreateDocumentStore } = require('../storage/store.js');
      this.store = getOrCreateDocumentStore(this.events);
    } catch (_) {
      this.store = new DocumentStore(this.events);
    }
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
    this._localSummarizer = undefined;
    const getLocalSummarizerClass = () => {
      try { const m = require('../ai/summarizer.js'); return m && (m.LocalSummarizer || (m.default && m.default.LocalSummarizer) || m.default); } catch (_) { return undefined; }
    };


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
    const MAX_CONCURRENT_REMOTE_SUMMARIES = 2;

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
            const MAX_PLUGIN_LIST = 100;
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
      summarizeDocument: async (documentId: string, allowNetwork = false) => {
        const d = this.store.read(documentId);
        if (!d) return undefined;
        // Use the configured summarizer when present; otherwise use a local one.
        if (!this._summarizer && !this._localSummarizer) { const Lc = getLocalSummarizerClass(); if (Lc && typeof Lc === 'function') { try { this._localSummarizer = new Lc(3); } catch (_) { /* swallow */ } } }
        const summarizer: Summarizer | any = this._summarizer ?? this._localSummarizer;

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

          // Check if we recently summarized this document to avoid redundant work
          // This prevents the background summarization timers from continuously
          // calling summarizeDocument for the same documents, reducing LocalSummarizer overload.
          const lastSummarizedMap: Map<string, number> = ((this as any)._bgSummarizeLast as Map<string, number>) || new Map();
          (this as any)._bgSummarizeLast = lastSummarizedMap;
          const MIN_SUMMARIZE_INTERVAL_MS = 30_000; // at least 30 seconds between summaries for same doc (increased to reduce repeated work)
          const now = Date.now();
          const last = lastSummarizedMap.get(documentId) ?? 0;
          if (now - last < MIN_SUMMARIZE_INTERVAL_MS) {
            // Document was recently summarized; skip to avoid redundant work
            return undefined;
          }
          lastSummarizedMap.set(documentId, now);

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

          const result = await attempt(MAX_RETRIES);
          // Record that we summarized this document so future calls can skip
          if (result !== undefined) {
            lastSummarizedMap.set(documentId, Date.now());
          }

          return result;
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
          try {
            const fromStore = (this.store ? getSyncEngineFromStore(this.store) : undefined);
            if (fromStore !== undefined && fromStore && typeof fromStore.getClock === 'function') return fromStore;
          } catch (err) {
            // If registry lookup fails, swallow and fall back to app-local _sync
          }
        } catch (_) { /* swallow */ }
        try { return (this as any)._sync; } catch (_) { return undefined; }
      })();

      // Defensive: if the store-published engine is a proxy/wrapper that delegates
      // to the canonical engine but returns a different object identity, prefer
      // to use the canonical engine to avoid duplicate instance logic elsewhere.
      try {
        const canonical = getSyncEngineFromStore(this.store as any);
        if (canonical && canonical !== (this as any)._sync) {
          this._sync = canonical;
        }
      } catch (_) { /* swallow */ }
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
    };
    // Lazy PluginHost instantiation to reduce startup fan-out and avoid
    // constructing the full plugin subsystem until it's actually used.
    // Provide host-level policy options to the PluginHost (e.g. allowNetworkSummaries)
    this.plugins = createLazyPluginHost(pluginContext, { allowNetworkSummaries: this._allowNetwork, allowedNetworkPlugins: undefined });
    // Lazy PresenceTracker to avoid starting background timers and IO until needed.
    this.presence = createLazyPresenceTracker(() => pluginContext);

    // Background summarization warm-up: schedule lightweight summarization for created/updated docs
    // to provide async job processing and warm caches (reduces remote latency on first real request).
    (this as any)._bgSummarizeTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Background summarization is useful in production but creates timers and
    // potential network activity that hinder test adoption and increase
    // subsystem fan-out. Allow disabling in test environments or via an
    // explicit global opt-out to make the subsystem safe for test runs.
    // Global resonance loop protection: prevent cascading summarization triggers
    // by limiting total background summarization activity and adding a global cooldown.
    let globalSummarizeActive = 0;
    const GLOBAL_MAX_ACTIVE = 2;
    const GLOBAL_COOLDOWN_MS = 5000;
    let globalCooldownUntil = 0;
    const scheduleSummarize = (docId: string) => {
      const disabled = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') ||
        (!!getDisableBgSummarize()) ||
        this._disableBgSummarize;
      if (disabled) return;
      if (!docId) return;

      // Global resonance loop protection: respect cooldown window from previous overload
      var now = Date.now();
      if (globalCooldownUntil && now < globalCooldownUntil) {
        // Still in global cooldown; set a short timer to clear it
        const shortT = setTimeout(() => { globalCooldownUntil = 0; }, 100);
        return;
      }

      // Respect global concurrency cap to avoid cascading summarization triggers
      if (globalSummarizeActive >= GLOBAL_MAX_ACTIVE) {
        // Hit global limit; set a cooldown timer before allowing more work
        const cooldownT = setTimeout(() => { globalSummarizeActive = 0; globalCooldownUntil = now + GLOBAL_COOLDOWN_MS; }, GLOBAL_COOLDOWN_MS);
        return;
      }

      // Removed resonance loop check; global cooldown and per-doc intervals provide protection

      // Per-doc timers map (shared on the instance). _bgSummarizeTimers was already created above.
      const timers: Map<string, ReturnType<typeof setTimeout>> = (this as any)._bgSummarizeTimers;
      const prev = timers.get(docId);
      if (prev) clearTimeout(prev);

      // Maintain a lightweight per-doc last-summarized timestamp to avoid
      // repeated background summarization for the same document in quick
      // succession which can create a resonance loop under high update rates.
      const lastMap: Map<string, number> = ((this as any)._bgSummarizeLast as Map<string, number>) || new Map();
      (this as any)._bgSummarizeLast = lastMap;
      const MIN_INTERVAL_MS = 15_000; // do not summarize the same doc more frequently than this (increased to reduce load)
      var now = Date.now();
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
      const MAX_CONCURRENT_BG = 1; // conservative default (reduced to lower LocalSummarizer pressure)
      const MAX_QUEUE = 200; // bounded queue size to avoid memory growth and limit queued background jobs

      // Initialize shared counters/queue on the app instance if absent.
      if (!((this as any)._bgSummarizeActive)) (this as any)._bgSummarizeActive = 0;
      if (!((this as any)._bgSummarizeQueue)) (this as any)._bgSummarizeQueue = [] as string[];

      // Check LocalSummarizer's global active requests to avoid overload
      // This prevents background timers from overwhelming the local summarizer
      const Lclass = getLocalSummarizerClass();
      // Prefer the class-declared GLOBAL_MAX_CONCURRENT when available so
      // the app's scheduling respects the summarizer's own concurrency policy.
      // Determine LocalSummarizer concurrency support and active count via
      // the safer internal alias first (_getGlobalActiveRequests) falling back
      // to the public getter when necessary. This reduces coupling to the
      // concrete class shape and makes in-app callers prefer the stable alias.
      const hasGetActive = Lclass && (typeof (Lclass as any)._getGlobalActiveRequests === 'function' || typeof (Lclass as any).getGlobalActiveRequests === 'function');
      const maxLocalConcurrent = (Lclass && typeof (Lclass as any).GLOBAL_MAX_CONCURRENT === 'number')
        ? (Lclass as any).GLOBAL_MAX_CONCURRENT
        : (hasGetActive ? 5 : 10);
      const getActiveFn = hasGetActive ? ((Lclass as any)._getGlobalActiveRequests || (Lclass as any).getGlobalActiveRequests) : undefined;
      if (getActiveFn && typeof getActiveFn === 'function' && getActiveFn() >= maxLocalConcurrent) {
        // LocalSummarizer is saturated; set a short backoff timer
        const backoffT = setTimeout(() => {
          try {
            const active = getActiveFn();
            if (active < maxLocalConcurrent) globalCooldownUntil = 0;
          } catch (_) {}
        }, 500);
        const placeholder = setTimeout(() => { try { timers.delete(docId); } catch (_) {} }, 50);
        timers.set(docId, placeholder);
        return;
      }

      const active = (this as any)._bgSummarizeActive as number;
      const queue = (this as any)._bgSummarizeQueue as string[];

      const scheduleJob = (id: string) => {
        // Job runner that performs the summary and drains the queue when done.
        // Use LocalSummarizer's concurrency control to prevent overload
        // when many timers fire concurrently.

        // Check LocalSummarizer's global active requests before running
        // to avoid over-subscribing when many timers fire concurrently.
        const Lclass = getLocalSummarizerClass();
        // Use the summarizer-declared concurrency limit when present to keep
        // background scheduling aligned with the summarizer implementation.
        const hasGetActive2 = Lclass && (typeof (Lclass as any)._getGlobalActiveRequests === 'function' || typeof (Lclass as any).getGlobalActiveRequests === 'function');
        const maxLocalConcurrent = (Lclass && typeof (Lclass as any).GLOBAL_MAX_CONCURRENT === 'number')
          ? (Lclass as any).GLOBAL_MAX_CONCURRENT
          : (hasGetActive2 ? 5 : 10);
        const getActiveFn2 = hasGetActive2 ? ((Lclass as any)._getGlobalActiveRequests || (Lclass as any).getGlobalActiveRequests) : undefined;
        if (getActiveFn2 && typeof getActiveFn2 === 'function' && getActiveFn2() >= maxLocalConcurrent) {
          // LocalSummarizer is saturated; re-enqueue with backoff
          try {
            const queue = (this as any)._bgSummarizeQueue as string[];
            if (Array.isArray(queue) && queue.length < 1000) {
              queue.push(id);
              const placeholder = setTimeout(() => { try { timers.delete(id); } catch (_) {} }, 500);
              timers.set(id, placeholder);
              return;
            }
          } catch (_) {}
          const shortT = setTimeout(() => { try { timers.delete(id); } catch (_) {} }, 750);
          timers.set(id, shortT);
          return;
        }

        // Attempt to acquire a LocalSummarizer slot; if we cannot, re-enqueue
        // the job with a short backoff to avoid over-subscribing the local summarizer.
        const Lclass2 = getLocalSummarizerClass();
          const acquired = Lclass2 ? (typeof (Lclass2 as any)._tryRecordRequest === 'function' ? (Lclass2 as any)._tryRecordRequest() : (typeof (Lclass2 as any).tryRecordRequest === 'function' ? (Lclass2 as any).tryRecordRequest() : (typeof (Lclass2 as any).recordRequest === 'function' ? ((Lclass2 as any).recordRequest(), true) : true))) : true;
        if (!acquired) {
          // Couldn't acquire: attempt to enqueue for later. If the queue is full
          // set a short placeholder timer and drop the heavy work.
          try {
            const queue = (this as any)._bgSummarizeQueue as string[];
            if (Array.isArray(queue) && queue.length < 1000) {
              queue.push(id);
              const placeholder = setTimeout(() => { try { timers.delete(id); } catch (_) {} }, 500);
              timers.set(id, placeholder);
              return;
            }
          } catch (_) {
            // If anything goes wrong, fall back to a short placeholder timer.
          }
          const shortT = setTimeout(() => { try { timers.delete(id); } catch (_) {} }, 750);
          timers.set(id, shortT);
          return;
        }

        // Mark this job active so global concurrency accounting is accurate.
        try { (this as any)._bgSummarizeActive = ((this as any)._bgSummarizeActive ?? 0) + 1; } catch (_) {}
        const t = setTimeout(async () => {
          try {
            // Clear per-doc timer slot immediately (we're running it now)
            try { timers.delete(id); } catch (_) {}
            try {
              const doc = this.store.read(id);
              if (doc) {
                try {
                  // Use the configured summarizer (may be remote) instead of always using local.
                  // This allows background work to benefit from remote summarization when available.
                  if (!this._summarizer && !this._localSummarizer) { const Lc = getLocalSummarizerClass(); if (Lc && typeof Lc === 'function') { try { this._localSummarizer = new Lc(3); } catch (_) { /* swallow */ } } }
                  const summarizer: Summarizer | any = this._summarizer ?? this._localSummarizer;
                  if (summarizer && typeof summarizer.summarize === 'function') await summarizer.summarize(doc);
                  try { lastMap.set(id, Date.now()); } catch (_) {}
                  try { console.debug && console.debug(`background summarization completed for ${id}`); } catch (_) {}
                } catch (_) {
                  // swallow summarization errors; do not update lastMap so future attempts can retry
                }
              }
            } catch (_) { /* swallow background errors */ }
            // Mark job finished and try to drain a queued job.
            try {
              try { const Lr = getLocalSummarizerClass(); if (Lr) { if (typeof (Lr as any)._releaseRequest === 'function') (Lr as any)._releaseRequest(); else if (typeof (Lr as any).releaseRequest === 'function') (Lr as any).releaseRequest(); } } catch (_) {}
              const next = (this as any)._bgSummarizeQueue.shift();
              if (next) {
                // Use a short defer to avoid deep synchronous recursion and to
                // give the event loop a chance to schedule other work.
                setTimeout(() => {
                  try { scheduleSummarize(next); } catch (_) {}
                }, 0);
              }
            } catch (_) { /* swallow */ }
          } finally {
            // Decrement global active counter defensively so the accounting stays accurate even on errors.
            try { (this as any)._bgSummarizeActive = Math.max(0, ((this as any)._bgSummarizeActive ?? 1) - 1); } catch (_) {}
          }
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

    // Rate limiting for background summarization - simplified to avoid resonance loops
    // Removed auto-disable logic; instead we rely on global cooldown and per-doc intervals

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
    try {
      // Wire the sandboxed PluginContext into PresenceTracker so it can validate
      // documents without directly accessing the store. Use the existing lazy
      // presence wrapper that was created earlier to avoid creating duplicate
      // trackers/listeners/timers.
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

    // The SyncManager is responsible for forwarding storage events to the
    // sync subsystem (SyncEngine). Do not register direct store→engine
    // forwarders here to avoid duplicate subscriptions; rely on the manager
    // to centralize event handling and ordering guarantees.

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
    const effectiveFetcher = (fetcher as any) && (typeof (fetcher as any).length === 'number' && (fetcher as any).length === 1)
      ? (doc: Document, opts?: { authToken?: string }) => {
        if (!opts || !opts.authToken) return Promise.reject(new Error('auth token required'));
        if (typeof (fetcher as any) !== 'function') return Promise.reject(new Error('fetcher not a function'));
        return (fetcher as any)(doc);
      }
      : fetcher;

    try {
      const m = require('../ai/summarizer.js');
      const Remote = m && (m.RemoteSummarizer || m.default || m);
      if (typeof Remote === 'function') {
        try { this._summarizer = new Remote(effectiveFetcher, { allowNetwork: options?.allowNetwork ?? true, maxSentences: options?.maxSentences, authToken: this._networkAuthToken }); return true; } catch (_) { /* swallow */ }
      }
    } catch (_) {}
    return false;
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
      // Use the canonical SyncEngine factory/registry to avoid duplicate
      // engine instances and duplicate event subscriptions which can
      // overload SyncEngine and downstream consumers.
      try {
        // Defensive runtime resolver: in some build/require scenarios the imported
        // SyncEngine symbol may not be the runtime constructor. Prefer the
        // imported symbol when present, otherwise attempt a runtime require
        // to obtain the constructor. This avoids missing-runtime-symbol TS
        // errors in environments that elide imports.
        const SE: any = (typeof SyncEngine !== 'undefined' && (SyncEngine as any).getOrCreate)
          ? SyncEngine
          : (() => { try { const m = require('../sync/engine.js'); return m && (m.SyncEngine || m.default || m); } catch (_) { return undefined; } })();
        if (SE && typeof SE.getOrCreate === 'function') {
          this._sync = SE.getOrCreate(this.store as any, this._peerId);
        } else {
          // Fall through to registry lookup below via thrown error.
          throw new Error('SyncEngine.getOrCreate unavailable');
        }
        } catch (err) {
          // Avoid directly constructing a new SyncEngine here — prefer any
          // already-registered engine on the store to prevent duplicate
          // subscriptions or conflicting clocks. If no engine is available,
          // rethrow the original error so callers can handle it explicitly.
          try {
            const installed = getSyncEngineFromStore(this.store);
            if (installed !== undefined && installed) {
              this._sync = installed;
            } else {
              throw err;
            }
          } catch (e) {
            // If registry lookup fails, rethrow the original error to surface
            // that getOrCreate() failed rather than silently continuing.
            throw err;
          }
        }

        // Ensure the registered engine is the canonical store-backed engine
        // to avoid accidental duplicate instances due to proxy wrappers.
        try {
          const canonical = getSyncEngineFromStore(this.store as any);
          if (canonical && this._sync && canonical !== this._sync) {
            try { console.warn('SignalApp.start: store exposes a different SyncEngine instance; using canonical store-backed engine to avoid duplicates'); } catch (_) {}
            this._sync = canonical;
          }
        } catch (_) { /* swallow */ }
    }
    this.started = true;
  }

  shutdown(dataPath?: string): void {
    if (!this.started) return;
    this.started = false;

    // Remove any active background summarization timers
    const timers = (this as any)._bgSummarizeTimers;
    if (timers && typeof timers.clear === 'function') {
      try { timers.clear(); } catch (_) {}
    }

    // Clear the background summarization counters and queue to prevent memory leaks
    const bgActive = (this as any)._bgSummarizeActive;
    const bgQueue = (this as any)._bgSummarizeQueue;
    if (bgActive !== undefined) (this as any)._bgSummarizeActive = 0;
    if (bgQueue !== undefined) (this as any)._bgSummarizeQueue = [];

    // Disable all plugins
    for (const p of this.plugins.list()) {
      if (p.enabled) this.plugins.disable(p.id);
    }

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
