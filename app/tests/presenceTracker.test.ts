import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createValidatorFromStore, createValidatorFromPluginContext } from '../src/collaboration/presence.js';

// Tests for presence-related functionality

describe('PresenceTracker', () => {
  // it('should create a validator from a store', async () => {
  //   const storeMock = { validate: async (id) => id === 'valid-id' };
  //   const validator = createValidatorFromStore(storeMock);
  //   const result = await validator('valid-id');
  //   assert.equal(result, true);
  // });

  // it('should create a validator from a plugin context', async () => {
  //   const contextMock = { validate: async (id) => id === 'context-id' };
  //   const validator = createValidatorFromPluginContext(contextMock);
  //   const result = await validator('context-id');
  //   assert.equal(result, true);
  // });

  it('should handle invalid IDs gracefully', async () => {
    const storeMock = { validate: async () => false };
    const validator = createValidatorFromStore(storeMock);
    const result = await validator('invalid');
    assert.equal(result, false);
  });
});