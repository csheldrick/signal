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
  summarize(document: Document): Promise<string>;
}

export class LocalSummarizer implements Summarizer {
  readonly isRemote = false;
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
  readonly isRemote = true;
  readonly allowsNetwork: boolean;
  private readonly fetcher: (document: Document) => Promise<string>;
  private readonly fallback: LocalSummarizer;
  private readonly allowNetwork: boolean;

  /**
   * Create a RemoteSummarizer.
   * - fetcher: function performing the remote summarization
   * - options.allowNetwork: must be true to permit network calls; otherwise
   *   the summarizer will deterministically fall back to a LocalSummarizer.
   */
  constructor(
    fetcher: (document: Document) => Promise<string>,
    options?: { allowNetwork?: boolean; maxSentences?: number },
  ) {
    this.fetcher = fetcher;
    this.allowNetwork = options?.allowNetwork ?? false;
    this.allowsNetwork = this.allowNetwork;
    this.fallback = new LocalSummarizer(options?.maxSentences ?? 3);
  }

  async summarize(document: Document): Promise<string> {
    if (!this.allowNetwork) {
      // Explicit opt-in required for network calls — fallback deterministically.
      return this.fallback.summarize(document);
    }

    try {
      const timeoutMs = 300;
      const result = await Promise.race([
        this.fetcher(document),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('summarizer timeout')), timeoutMs)),
      ]);
      if (typeof result !== 'string' || result.length === 0) {
        return this.fallback.summarize(document);
      }
      return result;
    } catch (_) {
      // On any remote failure, return a safe local summary.
      return this.fallback.summarize(document);
    }
  }
}

