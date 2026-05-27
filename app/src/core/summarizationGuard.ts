// ── Summarization Guard ───────────────────────────────────────
// Protects against resonance loops in background summarization.
// Provides debouncing, circuit breakers, and global rate limiting
// to prevent cascading summarization triggers from overwhelming
// the system.

import type { Document } from './types.js';

/**
 * Global state for resonance loop protection.
 * Shared across all SignalApp instances to prevent system-wide overload.
 */
interface GlobalGuardState {
  lastGlobalSummarizeAt: number;
  lastGlobalEventAt: number;
  eventDebounceMs: number;
  globalCooldownUntil: number;
  failureCount: number;
  failureWindowMs: number;
  cooldownMs: number;
  maxFailures: number;
}

const globalGuard: GlobalGuardState = {
  lastGlobalSummarizeAt: 0,
  lastGlobalEventAt: 0,
  eventDebounceMs: 200,
  globalCooldownUntil: 0,
  failureCount: 0,
  failureWindowMs: 30_000,
  cooldownMs: 5_000,
  maxFailures: 5,
};

/**
 * Check if we should allow a background summarization request.
 * Returns { allowed: boolean; waitMs: number } where waitMs > 0 means
 * the caller should defer the request.
 */
export function checkGuard(now: number = Date.now()): { allowed: boolean; waitMs: number } {
  // Global cooldown from excessive failures
  if (globalGuard.globalCooldownUntil > now) {
    return { allowed: false, waitMs: globalGuard.globalCooldownUntil - now };
  }

  // Rate limit background summarization globally
  const MIN_INTERVAL_MS = 100;
  if (now - globalGuard.lastGlobalSummarizeAt < MIN_INTERVAL_MS) {
    return { allowed: false, waitMs: MIN_INTERVAL_MS - (now - globalGuard.lastGlobalSummarizeAt) };
  }

  // Rate limit event handlers to prevent event storms
  const EVENT_DEBOUNCE_MS = 100;
  if (now - globalGuard.lastGlobalEventAt < EVENT_DEBOUNCE_MS) {
    return { allowed: false, waitMs: EVENT_DEBOUNCE_MS - (now - globalGuard.lastGlobalEventAt) };
  }

  // Update state
  globalGuard.lastGlobalSummarizeAt = now;
  globalGuard.lastGlobalEventAt = now;

  return { allowed: true, waitMs: 0 };
}

/**
 * Record a summarization success to reset failure tracking.
 */
export function recordSuccess(): void {
  globalGuard.failureCount = 0;
  globalGuard.globalCooldownUntil = 0;
}

/**
 * Record a summarization failure. Triggers cooldown if failures exceed threshold.
 */
export function recordFailure(): void {
  const now = Date.now();
  if (now - globalGuard.lastGlobalSummarizeAt > globalGuard.failureWindowMs) {
    globalGuard.failureCount = 0;
  }
  globalGuard.failureCount++;
  globalGuard.lastGlobalSummarizeAt = now;

  if (globalGuard.failureCount >= globalGuard.maxFailures) {
    globalGuard.globalCooldownUntil = now + globalGuard.cooldownMs;
    globalGuard.failureCount = 0;
  }
}

/**
 * Get the current global failure count.
 */
export function getFailureCount(): number {
  return globalGuard.failureCount;
}

/**
 * Get the remaining cooldown time in milliseconds.
 */
export function getRemainingCooldownMs(now: number = Date.now()): number {
  if (globalGuard.globalCooldownUntil <= now) return 0;
  return globalGuard.globalCooldownUntil - now;
}

/**
 * Reset global guard state (useful for tests).
 */
export function resetGuard(): void {
  globalGuard.lastGlobalSummarizeAt = 0;
  globalGuard.lastGlobalEventAt = 0;
  globalGuard.globalCooldownUntil = 0;
  globalGuard.failureCount = 0;
}

/**
 * Export for testing.
 */
export const __TEST__ = {
  resetGuard,
  getFailureCount,
  getRemainingCooldownMs,
};
