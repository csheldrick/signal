// ── AI Summarizer ───────────────────────────────────────────
// Document summarization interface and local implementation.
// Remote summarization is explicit and opt-in: RemoteSummarizer must be
// constructed with a network fetcher and an explicit allowNetwork flag.
// When network is not allowed or the remote call fails, RemoteSummarizer
// falls back to LocalSummarizer to preserve deterministic behaviour for
// callers that do not opt in to network side effects.

import type { Document } from '../core/types.js';

export interface Summarizer {
  readonly isRemote: boolean;
  readonly allowsNetwork: boolean;
  /**
   * isPure = true indicates calling summarize() performs no external I/O
   * or side-effects (network/disk). Consumers that require deterministic,
   * realtime-safe behaviour should prefer implementations with isPure = true.
   */
  readonly isPure: boolean;
  summarize(document: Document): Promise<string>;
}

export class LocalSummarizer implements Summarizer {
  readonly isRemote = false; readonly isPure = true;
  readonly allowsNetwork = false;
  private readonly maxSentences: number;

  private static cache: Map<string, { updatedAt: number; summary: string }> = new Map();
  private static readonly CACHE_MAX_SIZE = 200;
  private static readonly CACHE_TTL_MS = 60_000;
  private static readonly FAILED_CACHE: Map<string, number> = new Map();
  private static readonly FAILED_CACHE_TTL_MS = 300_000;

  // Concurrency control to prevent LocalSummarizer overload
  // when many callers activate it concurrently (background summarization,
  // plugin calls, remote fallbacks).
  private static globalActiveRequests: number = 0;
  static readonly GLOBAL_MAX_CONCURRENT = 4;

  /**
   * Attempt to acquire a global LocalSummarizer request slot.
   * Returns true when the caller has successfully acquired a slot and must
   * call releaseRequest() when finished.
   */
  static tryRecordRequest(): boolean {
    if (LocalSummarizer.globalActiveRequests >= LocalSummarizer.GLOBAL_MAX_CONCURRENT) return false;
    LocalSummarizer.globalActiveRequests++;
    return true;
  }

  // Per-document pending tracking to coalesce concurrent requests
  // and avoid duplicate work for the same document.
  private static pending: Map<string, { promise: Promise<string>; ts: number }> = new Map();
  private static readonly MAX_PENDING_ENTRIES = 100;

  // Global failure tracking to avoid thrashing when remote summarization is flaky.
  // After maxFailures within failureWindowMs, we enter a short cooldown
  // and return local summaries to reduce load.
  private static failureCount: number = 0;
  private static lastFailureAt: number = 0;
  private static cooldownUntil: number = 0;
  private static readonly MAX_FAILURES = 3;
  private static readonly FAILURE_WINDOW_MS = 10_000; // 10s window
  private static readonly COOLDOWN_MS = 5_000; // 5s cooldown

  constructor(maxSentences: number = 3) {
    this.maxSentences = maxSentences;
  }

  async summarize(document: Document): Promise<string> {
    const id = document?.id ?? '';
    const updatedAt = (document as any)?.updatedAt ?? 0;

    // Fast-path: return cached summary when document hasn't changed.
    if (id) {
      const cached = LocalSummarizer.cache.get(id);
      if (cached && cached.updatedAt === updatedAt) {
        return cached.summary;
      }
    }

    // Attempt to acquire a global LocalSummarizer request slot. If the slot
    // cannot be acquired we still compute and return a local summary, but we
    // do not modify the global counters.
    const acquired = LocalSummarizer.tryRecordRequest();
    try {
      const sentences = (document.content || '')
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const selected = sentences.slice(0, this.maxSentences);
      const summary = selected.join('. ') + (selected.length > 0 ? '.' : '');

      if (id) {
        LocalSummarizer.cache.set(id, { updatedAt, summary });
        // Simple bounded eviction to avoid unbounded memory growth.
        if (LocalSummarizer.cache.size > LocalSummarizer.CACHE_MAX_SIZE) {
          const it = LocalSummarizer.cache.keys();
          const first = it.next().value as string | undefined;
          if (first) LocalSummarizer.cache.delete(first);
        }
      }

      return summary;
    } finally {
      // Only release the global slot if we successfully acquired it.
      if (acquired) {
        try { LocalSummarizer.releaseRequest(); } catch (_) { /* swallow */ }
      }
    }
  }

  /**
   * Get the current global active request count.
   * This is used by callers to check if they should defer their request.
   */
  static getGlobalActiveRequests(): number {
    return LocalSummarizer.globalActiveRequests;
  }

  /**
   * Record a new global request. Callers should use this before starting
   * work that may take time, so they can check the global limit.
   */
  static recordRequest(): void {
    LocalSummarizer.globalActiveRequests++;
  }

  /**
   * Decrement the global active request count. Callers should use this
   * after completing their work to properly release the request slot.
   */
  static releaseRequest(): void {
    LocalSummarizer.globalActiveRequests = Math.max(0, LocalSummarizer.globalActiveRequests - 1);
  }

  /**
   * Check if we're currently in a global cooldown due to prior failures.
   */
  static isInCooldown(): boolean {
    return Date.now() < LocalSummarizer.cooldownUntil;
  }
}

export class RemoteSummarizer implements Summarizer {
  readonly isRemote = true; readonly isPure = false;
  readonly allowsNetwork: boolean;
  private readonly fetcher: (document: Document, opts?: { authToken?: string }) => Promise<string>;
  private readonly fallback: LocalSummarizer;
  private readonly allowNetwork: boolean;
  private readonly authToken?: string;

  // Coalesce concurrent summaries per-document to avoid duplicated remote work
  private static pending: Map<string, { promise: Promise<string>; ts: number }> = new Map();
  private static readonly MAX_PENDING_ENTRIES = 50;

  // Global concurrency control: limit the number of simultaneous remote
  // summarization requests across all RemoteSummarizer instances. When the
  // global cap is reached we immediately return a local summary to avoid
  // overloading the remote service and downstream subsystems.
  private static globalActiveRequests: number = 0;
  private static readonly GLOBAL_MAX_CONCURRENT = 6;

  static getGlobalActiveRequests(): number {
    return RemoteSummarizer.globalActiveRequests;
  }

  static tryRecordRequest(): boolean {
    if (RemoteSummarizer.globalActiveRequests >= RemoteSummarizer.GLOBAL_MAX_CONCURRENT) return false;
    RemoteSummarizer.globalActiveRequests++;
    return true;
  }

  static releaseRequest(): void {
    RemoteSummarizer.globalActiveRequests = Math.max(0, RemoteSummarizer.globalActiveRequests - 1);
  }

  private static getPending(id: string): Promise<string> | undefined {
    const entry = RemoteSummarizer.pending.get(id);
    if (!entry) return undefined;
    // Evict very old entries to avoid memory leaks
    if (Date.now() - entry.ts > 30_000) {
      RemoteSummarizer.pending.delete(id);
      return undefined;
    }
    return entry.promise;
  }

  private static setPending(id: string, p: Promise<string>): void {
    RemoteSummarizer.pending.set(id, { promise: p, ts: Date.now() });
    if (RemoteSummarizer.pending.size > RemoteSummarizer.MAX_PENDING_ENTRIES) {
      const entries = [...RemoteSummarizer.pending.entries()].sort(([, a], [, b]) => a.ts - b.ts);
      const toRemove = RemoteSummarizer.pending.size - RemoteSummarizer.MAX_PENDING_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        RemoteSummarizer.pending.delete(entries[i][0]);
      }
    }
  }

  private static clearPending(id: string): void {
    RemoteSummarizer.pending.delete(id);
  }

  // Simple failure tracking to avoid repeated remote attempts when the
  // remote service is failing or slow. After maxFailures within failureWindowMs
  // the summarizer will enter a short cooldown and return local summaries.
  private failureCount: number = 0;
  private lastFailureAt: number = 0;
  private cooldownUntil: number = 0;

  private readonly maxFailures: number = 3;
  private readonly failureWindowMs: number = 10_000; // 10s window
  private readonly cooldownMs: number = 5_000; // 5s cooldown
  private readonly timeoutMs: number = 300;
  // Track the last remote attempt per-document to apply a small rate limit
  // which prevents rapid repeated remote attempts for the same document.
  private lastAttemptAt: Map<string, number> = new Map();
  private readonly minAttemptIntervalMs: number = 1000;

  /**
   * Create a RemoteSummarizer.
   * - fetcher: function performing the remote summarization
   * - options.allowNetwork: must be true to permit network calls; otherwise
   *   the summarizer will deterministically fall back to a LocalSummarizer.
   */
  constructor(
    fetcher: (document: Document, opts?: { authToken?: string }) => Promise<string>,
    options?: { allowNetwork?: boolean; maxSentences?: number; authToken?: string },
  ) {
    // Store the raw fetcher reference so summarize() can call it with explicit opts
    this.fetcher = fetcher;

    // Require auth token if network is requested; otherwise disable network for safety.
    let effectiveAllow = options?.allowNetwork ?? false;
    this.authToken = options?.authToken;
    if (effectiveAllow && !this.authToken) {
      try { console.warn('RemoteSummarizer: allowNetwork requested but authToken missing; network disabled for safety'); } catch (_) { /* swallow */ }
      effectiveAllow = false;
    }

    // Defensive runtime check: ensure the provided fetcher accepts an options parameter
    // so we can actually deliver the authToken. Many older fetchers accepted a single
    // document arg and would ignore opts; detect that shape via function.length and
    // disable network in that case to avoid silently calling a fetcher without auth.
    try {
      if (effectiveAllow && typeof fetcher === 'function' && (fetcher as any).length < 2) {
        try { console.warn('RemoteSummarizer: provided fetcher does not accept options (auth token cannot be injected); network disabled for safety'); } catch (_) { /* swallow */ }
        effectiveAllow = false;
      }
    } catch (_) {
      // In case feature-detection fails for any reason, fall back to the safer behavior
      effectiveAllow = false;
    }

    this.allowNetwork = effectiveAllow;
    this.allowsNetwork = effectiveAllow;
    this.fallback = new LocalSummarizer(options?.maxSentences ?? 3);
  }

  private now(): number {
    return Date.now();
  }

  private recordFailure(): void {
    const now = this.now();
    if (now - this.lastFailureAt > this.failureWindowMs) {
      // Failure window expired; reset counter
      this.failureCount = 0;
    }
    this.failureCount += 1;
    this.lastFailureAt = now;
    if (this.failureCount >= this.maxFailures) {
      this.cooldownUntil = now + this.cooldownMs;
      // Reset failureCount so we don't immediately re-enter cooldown after it ends
      this.failureCount = 0;
    }
  }

  private recordSuccess(): void {
    this.failureCount = 0;
    this.lastFailureAt = 0;
    this.cooldownUntil = 0;
  }

  async summarize(document: Document): Promise<string> {
    const id = document?.id ?? '';

    const now = this.now();

    if (!this.allowNetwork) {
      // Explicit opt-in required for network calls — fallback deterministically.
      return this.fallback.summarize(document);
    }

    // Avoid remote calls for documents without stable ids or for very short
    // content where a local heuristic summary is sufficient. This prevents
    // unnecessary network load and reduces remote service pressure.
    const contentLen = (document.content || '').trim().length;
    if (!id || contentLen < 50) {
      return this.fallback.summarize(document);
    }

    // Check remote instance cooldown due to prior failures; do not rely on LocalSummarizer cooldown.
    if (Date.now() < this.cooldownUntil) {
      // We're in a cooldown window due to recent remote failures; return local summary.
      return this.fallback.summarize(document);
    }

    // Rate-limit repeated remote attempts per-document to reduce load and
    // avoid thrashing a failing/slow remote service.
    const last = this.lastAttemptAt.get(id) ?? 0;
    if (now - last < this.minAttemptIntervalMs) {
      return this.fallback.summarize(document);
    }
    this.lastAttemptAt.set(id, now);

    // If there's already an in-flight request for this document, return it
    // to coalesce duplicate concurrent work and reduce remote load.
    const inFlight = RemoteSummarizer.getPending(id);
    if (inFlight) return inFlight;

    // Check remote concurrency before starting the remote request.
    // Use RemoteSummarizer's own global counter to avoid overloading the remote service.
    if (!RemoteSummarizer.tryRecordRequest()) {
      // Remote concurrency cap is reached; return a local summary immediately.
      return this.fallback.summarize(document);
    }

    // Encapsulate the remote attempt so we can register it in the pending map
    const op = (async (): Promise<string> => {
      try {
        let result: string;
        try {
          result = await Promise.race([
            this.fetcher(document, { authToken: this.authToken }),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('summarizer timeout')), this.timeoutMs)),
          ]);
        } finally {
          // Ensure the remote global active counter is decremented even on timeout/failure.
          RemoteSummarizer.releaseRequest();
        }

        if (typeof result !== 'string' || result.length === 0) {
          // Treat invalid/empty responses as failures
          this.recordFailure();
          return this.fallback.summarize(document);
        }

        // Successful remote summary — reset failure tracking
        this.recordSuccess();
        return result;
      } catch (err) {
        // On any remote failure, record it and return a safe local summary.
        this.recordFailure();
        return this.fallback.summarize(document);
      }
    })();

    if (id) {
      // Publish in-flight promise so concurrent callers reuse it
      RemoteSummarizer.setPending(id, op);
      // Ensure we cleanup the pending entry regardless of outcome
      op.finally(() => { RemoteSummarizer.clearPending(id); });
    }

    return op;
  }
}

