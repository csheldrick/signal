import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { enableRemoteSummarizerOnApp } from '../src/core/remoteSummarizerHelper';

describe('RemoteSummarizerHelper', () => {
  it('should enable remote summarizer with proper options', async () => {
    const mockApp = { summarizer: null };
    const fetcher = async () => { return 'summary'; };

    enableRemoteSummarizerOnApp(mockApp, fetcher, { allowNetwork: true });
    assert.ok(mockApp.summarizer);
  });

  it('should throw error if fetcher is not a function', () => {
    const mockApp = {};

    assert.throws(() => {
      enableRemoteSummarizerOnApp(mockApp, null, { allowNetwork: true });
    }, /fetcher not a function/);
  });

  it('should handle missing options gracefully', async () => {
    const mockApp = { summarizer: null };
    const fetcher = async () => { return 'summary'; };

    enableRemoteSummarizerOnApp(mockApp, fetcher);
    assert.ok(mockApp.summarizer);
  });
});