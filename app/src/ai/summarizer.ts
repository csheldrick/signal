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

    const sentences = (document.content || '')
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const selected = sentences.slice(0, this.maxSentences);
    const summary = selected.join('. ') + (selected.length > 0 ? '.' : '');

    if (id) {
      LocalSummarizer.cache.set(id, { updatedAt, summary });
      // Simple bounded eviction to avoid unbounded memory growth.
      if (LocalSummarizer.cache.size > 100) {
        const it = LocalSummarizer.cache.keys();
        const first = it.next().value as string | undefined;
        if (first) LocalSummarizer.cache.delete(first);
      }
    }

    return summary;
  }
}

export class RemoteSummarizer implements Summarizer {
  readonly isRemote = true; readonly isPure = false;
  readonly allowsNetwork: boolean;
  private readonly fetcher: (document: Document) => Promise<string>;
  private readonly fallback: LocalSummarizer;
  private readonly allowNetwork: boolean;
  private readonly authToken?: string;

  // Coalesce concurrent summaries per-document to avoid duplicated remote work
  private static pending: Map<string, Promise<string>> = new Map();

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
  private readonly minAttemptIntervalMs: number = 200;

  /**
   * Create a RemoteSummarizer.
   * - fetcher: function performing the remote summarization
   * - options.allowNetwork: must be true to permit network calls; otherwise
   *   the summarizer will deterministically fall back to a LocalSummarizer.
   */
  constructor(
    fetcher: (document: Document) => Promise<string>,
    options?: { allowNetwork?: boolean; maxSentences?: number; authToken?: string },
  ) {
    this.fetcher = fetcher;
    this.allowNetwork = options?.allowNetwork ?? false;
    this.authToken = options?.authToken;
    this.allowsNetwork = this.allowNetwork;
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

    // Rate-limit repeated remote attempts per-document to reduce load and
    // avoid thrashing a failing/slow remote service.
    const last = this.lastAttemptAt.get(id) ?? 0;
    if (now - last < this.minAttemptIntervalMs) {
      return this.fallback.summarize(document);
    }
    this.lastAttemptAt.set(id, now);

    // If there's already an in-flight request for this document, return it
    // to coalesce duplicate concurrent work and reduce remote load.
    const inFlight = RemoteSummarizer.pending.get(id);
    if (inFlight) return inFlight;

    //
    if (this.cooldownUntil && now < this.cooldownUntil) {
      // We're in cooldown due to prior failures; return local summary quickly.
      return this.fallback.summarize(document);
    }

    // Encapsulate the remote attempt so we can register it in the pending map
    const op = (async (): Promise<string> => {
      try {
        const result = await Promise.race([
          this.fetcher(document),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('summarizer timeout')), this.timeoutMs)),
        ]);

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
      RemoteSummarizer.pending.set(id, op);
      // Ensure we cleanup the pending entry regardless of outcome
      op.finally(() => { RemoteSummarizer.pending.delete(id); }).catch(() => { /* swallow */ });
    }

    return op;
  }
}

