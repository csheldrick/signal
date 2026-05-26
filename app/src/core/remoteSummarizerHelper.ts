import { RemoteSummarizer } from '../ai/summarizer.js';
import type { Document } from '../core/types.js';

/**
 * Explicit helper to enable remote summarization on an existing SignalApp
 * instance. This enforces the auth-token contract and validates the fetcher
 * shape so callers cannot accidentally enable network summarization without
 * providing a token or using a fetcher that can accept injected options.
 *
 * Usage is intentionally explicit to make network side-effects visible at the
 * application boundary (opt-in) and to avoid implicit global or hidden
 * side-effects.
 */
export function enableRemoteSummarizerOnApp(app: any, fetcher: (document: Document, opts?: { authToken?: string }) => Promise<string>, options?: { allowNetwork?: boolean; maxSentences?: number; authToken?: string }): void {
  try {
    const allowNetwork = !!(options?.allowNetwork ?? (app && (app as any)._allowNetwork));
    const authToken = options?.authToken ?? (app && (app as any)._networkAuthToken);
    if (allowNetwork && !authToken) {
      throw new Error('enableRemoteSummarizerOnApp: authToken required to enable network summarization');
    }
    if (typeof fetcher !== 'function' || (fetcher as any).length < 2) {
      throw new Error('enableRemoteSummarizerOnApp: fetcher must accept (document, opts) to allow auth token injection');
    }

    (app as any)._summarizer = new RemoteSummarizer(fetcher, { allowNetwork, maxSentences: options?.maxSentences, authToken });
  } catch (e) {
    try { console.warn('enableRemoteSummarizerOnApp: failed to enable remote summarizer', e); } catch (_) {}
  }
}
