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
  summarize(document: Document): Promise<string>;
}

export class LocalSummarizer implements Summarizer {
  readonly isRemote = false;
  private readonly maxSentences: number;

  constructor(maxSentences: number = 3) {
    this.maxSentences = maxSentences;
  }

  async summarize(document: Document): Promise<string> {
    const sentences = document.content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const selected = sentences.slice(0, this.maxSentences);
    return selected.join('. ') + (selected.length > 0 ? '.' : '');
  }
}

class RemoteSummarizer implements Summarizer {
  readonly isRemote = true;
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
    this.fallback = new LocalSummarizer(options?.maxSentences ?? 3);
  }

  async summarize(document: Document): Promise<string> {
    if (!this.allowNetwork) {
      // Explicit opt-in required for network calls — fallback deterministically.
      return this.fallback.summarize(document);
    }

    try {
      const result = await this.fetcher(document);
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

