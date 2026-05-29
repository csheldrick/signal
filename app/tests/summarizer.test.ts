// ── Summarizer grounding tests ───────────────────────────────
// These tests *ground fitness* for the Summarizer capability (see
// workspace/goals/ai-summarizer-offline.md and EXP-007). `weave evolve` runs
// this file via TestFitnessProbe to score candidate Summarizer implementations:
// a variant only survives if it satisfies the offline-first, deterministic
// contract asserted here.
//
//   • LocalSummarizer: offline, pure, deterministic, extractive, bounded
//   • RemoteSummarizer: explicit opt-in network; falls back to local otherwise

import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { LocalSummarizer, RemoteSummarizer } from '../src/ai/summarizer.js';
import type { Document } from '../src/core/types.js';

function makeDoc(partial: Partial<Document> = {}): Document {
  const now = Date.now();
  return {
    id: 'doc-1',
    title: 'Test',
    content: 'First sentence. Second sentence. Third sentence. Fourth sentence.',
    tags: [],
    links: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  } as Document;
}

// ── LocalSummarizer ─────────────────────────────────────────────────────────

describe('LocalSummarizer', () => {
  it('declares the offline-first contract: local, pure, no network', () => {
    const s = new LocalSummarizer();
    assert.equal(s.isRemote, false);
    assert.equal(s.isPure, true);
    assert.equal(s.allowsNetwork, false);
  });

  it('produces a non-empty extractive summary from document content', async () => {
    const s = new LocalSummarizer(2);
    const summary = await s.summarize(makeDoc());
    assert.ok(summary.length > 0);
    assert.ok(summary.includes('First sentence'));
  });

  it('bounds the summary to maxSentences', async () => {
    const s = new LocalSummarizer(2);
    const summary = await s.summarize(makeDoc({ id: 'bound' }));
    // 2 sentences requested → must not contain the third/fourth.
    assert.ok(summary.includes('First sentence'));
    assert.ok(summary.includes('Second sentence'));
    assert.ok(!summary.includes('Third sentence'));
  });

  it('is deterministic: same input yields the same summary', async () => {
    const a = new LocalSummarizer(3);
    const b = new LocalSummarizer(3);
    const doc = makeDoc({ id: 'determinism' });
    assert.equal(await a.summarize(doc), await b.summarize(doc));
  });

  it('handles empty content without throwing', async () => {
    const s = new LocalSummarizer(3);
    const summary = await s.summarize(makeDoc({ id: 'empty', content: '' }));
    assert.equal(typeof summary, 'string');
    assert.equal(summary, '');
  });
});

// ── RemoteSummarizer (offline fallback) ──────────────────────────────────────

describe('RemoteSummarizer', () => {
  it('falls back to a local summary when network is not opted into', async () => {
    let fetcherCalled = false;
    const fetcher = async () => {
      fetcherCalled = true;
      return 'REMOTE SUMMARY';
    };
    // No allowNetwork → must stay offline and never call the fetcher.
    const s = new RemoteSummarizer(fetcher, { maxSentences: 2 });
    const summary = await s.summarize(makeDoc({ id: 'offline' }));

    assert.equal(s.allowsNetwork, false);
    assert.equal(fetcherCalled, false);
    assert.ok(summary.includes('First sentence'));
    assert.ok(!summary.includes('REMOTE SUMMARY'));
  });

  it('disables network when allowNetwork is requested without an auth token', async () => {
    const fetcher = async (_doc: Document, _opts?: { authToken?: string }) => 'REMOTE';
    const s = new RemoteSummarizer(fetcher, { allowNetwork: true });
    // allowNetwork requested but no authToken → fail safe to offline.
    assert.equal(s.allowsNetwork, false);
  });
});
