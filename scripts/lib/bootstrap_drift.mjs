#!/usr/bin/env node
// Compute a rediscovery-rate report between a curated bootstrap baseline and a
// generatively-derived bootstrap context. Dependency-free on purpose: it only
// needs node's stdlib so it can run in any framework checkout.
//
// Both inputs are JSON arrays of { type, description } entries (the shape that
// `weave bootstrap --save` writes). For each curated entry we ask: did the
// generative pass re-derive something that means the same thing? We approximate
// "means the same thing" with normalised keyword (Jaccard) overlap, which is
// good enough for a headline metric without pulling in an embedding model.
//
// Usage: node scripts/lib/bootstrap_drift.mjs <baseline.json> <derived.json>

import { readFileSync } from 'node:fs';

const MATCH_THRESHOLD = 0.34; // Jaccard overlap above which two entries "match".

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is',
  'are', 'be', 'must', 'should', 'that', 'this', 'it', 'its', 'as', 'by', 'at',
  'from', 'into', 'via', 'no', 'not', 'but', 'has', 'have', 'than', 'so',
  'all', 'any', 'each', 'when', 'without', 'will', 'can', 'does',
]);

function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

function load(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    console.error(`error: cannot read ${path}: ${err.message}`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`error: ${path} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error(`error: ${path} must be a JSON array of {type, description}`);
    process.exit(1);
  }
  return data.map((e) => ({ type: e.type ?? 'unknown', description: e.description ?? '', _tok: tokens(e.description) }));
}

const [, , baselinePath, derivedPath] = process.argv;
if (!baselinePath || !derivedPath) {
  console.error('usage: bootstrap_drift.mjs <baseline.json> <derived.json>');
  process.exit(1);
}

const baseline = load(baselinePath);
const derived = load(derivedPath);

// Per-type rediscovery: a curated entry counts as rediscovered if any derived
// entry clears the match threshold.
const byType = new Map();
const derivedMatched = new Set();

for (const cur of baseline) {
  let best = 0;
  let bestIdx = -1;
  for (let i = 0; i < derived.length; i++) {
    const score = jaccard(cur._tok, derived[i]._tok);
    if (score > best) {
      best = score;
      bestIdx = i;
    }
  }
  const hit = best >= MATCH_THRESHOLD;
  if (hit && bestIdx >= 0) derivedMatched.add(bestIdx);
  const bucket = byType.get(cur.type) ?? { total: 0, found: 0 };
  bucket.total++;
  if (hit) bucket.found++;
  byType.set(cur.type, bucket);
}

// Emergent: derived entries that matched nothing in the baseline.
const emergent = derived.filter((_, i) => !derivedMatched.has(i));

let totalCur = 0;
let totalFound = 0;
const pad = (s, n) => String(s).padEnd(n);

console.log(pad('type', 16) + pad('rediscovered', 16) + 'rate');
console.log('-'.repeat(40));
for (const [type, { total, found }] of [...byType.entries()].sort()) {
  totalCur += total;
  totalFound += found;
  const rate = total ? ((found / total) * 100).toFixed(0) : '0';
  console.log(pad(type, 16) + pad(`${found}/${total}`, 16) + `${rate}%`);
}
console.log('-'.repeat(40));
const overall = totalCur ? ((totalFound / totalCur) * 100).toFixed(1) : '0.0';
console.log(pad('OVERALL', 16) + pad(`${totalFound}/${totalCur}`, 16) + `${overall}%`);

console.log('');
console.log(`Emergent (derived, not in curated baseline): ${emergent.length}`);
for (const e of emergent.slice(0, 12)) {
  const desc = e.description.length > 88 ? e.description.slice(0, 85) + '...' : e.description;
  console.log(`  [${e.type}] ${desc}`);
}
if (emergent.length > 12) console.log(`  ... and ${emergent.length - 12} more`);
