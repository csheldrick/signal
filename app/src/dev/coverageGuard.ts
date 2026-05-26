import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Enforce a coverage threshold by reading coverage/coverage-summary.json.
 *
 * This helper is intentionally opt-in: CI or test harnesses should invoke it
 * after running coverage to fail fast when coverage is below the configured
 * threshold. It is defensive and will warn (not throw) if no coverage summary
 * is present to avoid breaking local dev workflows.
 *
 * Usage (example in CI):
 *   // run tests with coverage -> produce coverage/coverage-summary.json
 *   node -e "require('./app/src/dev/coverageGuard').enforceCoverageThreshold(80)"
 */
export async function enforceCoverageThreshold(thresholdPercent: number, summaryPath?: string): Promise<void> {
  try {
    const base = summaryPath ? String(summaryPath) : join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (!existsSync(base)) {
      try {
        console.warn(`coverageGuard: coverage summary not found at ${base}; skipping threshold enforcement`);
      } catch (_) { /* swallow */ }
      return;
    }

    const raw = readFileSync(base, 'utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error('coverageGuard: failed to parse coverage summary JSON');
    }

    // Many coverage tools (nyc) provide a "total" section with lines/branches/functions/statements percentages.
    const total = parsed && parsed.total ? parsed.total : parsed;
    let pct: number | undefined;
    try {
      if (total && typeof total.lines === 'object' && typeof total.lines.pct === 'number') {
        pct = total.lines.pct;
      } else if (total && typeof total.pct === 'number') {
        pct = total.pct;
      }
    } catch (_) { /* swallow */ }

    if (typeof pct !== 'number') {
      try { console.warn('coverageGuard: could not determine total lines percentage from coverage summary; skipping'); } catch (_) {}
      return;
    }

    if (pct < thresholdPercent) {
      throw new Error(`coverageGuard: coverage ${pct}% is below required threshold ${thresholdPercent}%`);
    }
  } catch (err) {
    // Rethrow meaningful errors so CI can fail fast when appropriate.
    if (err instanceof Error) throw err;
    throw new Error('coverageGuard: unknown error during enforcement');
  }
}

export default enforceCoverageThreshold;
