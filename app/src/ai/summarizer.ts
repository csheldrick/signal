// ── AI Summarizer ───────────────────────────────────────────
// Document summarization interface and local implementation.
// Demonstrates the ai subsystem boundary.

import type { Document } from '../core/types.js';

export interface Summarizer {
  readonly isRemote?: boolean;
  summarize(document: Document): Promise<string>;
}

export class LocalSummarizer implements Summarizer { readonly isRemote = false;
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
