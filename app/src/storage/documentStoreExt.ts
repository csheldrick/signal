import { DocumentStore } from './store.js';

// Module augmentation so TypeScript callers can see the added methods on
// DocumentStore instances. Runtime implementations are attached to the
// prototype below.
declare module './store.js' {
  interface DocumentStore {
    /**
     * Append an offline/buffered mutation to the durable mutation log. Returns
     * the assigned monotonic sequence number for ordering.
     *
     * Note: this function is best-effort and only updates in-memory state; callers
     * should call store.save(filePath) when they want to persist immediately.
     */
    enqueueOfflineMutation(op: string, id: string, payload: any): number;

    /** Return a readonly snapshot of the mutation log sorted by seq (ascending). */
    getMutationLog(): ReadonlyArray<{ seq: number; id: string; op: string; payload: any }>;

    /**
     * Replay the mutation log in monotonic seq order. For each entry the provided
     * replayer will be called with the entry. If the replayer resolves successfully
     * the entry will be recorded in appliedMutationIds so duplicate application
     * on subsequent replays is a no-op. Replayer may be async; replay will await
     * each call in-order. If replayer throws for an entry that entry will be left
     * unmarked so future replays can retry.
     */
    replayMutationLog(
      replayer: (entry: { seq: number; id: string; op: string; payload: any }) => Promise<void> | void,
    ): Promise<void>;

    /** Mark a specific mutation id as applied (idempotency marker). */
    markMutationApplied(id: string): void;

    /** Trim mutation-log entries that are recorded as applied. Useful to compact persisted store. */
    trimAppliedMutations(): void;
  }
}

// Runtime implementations. We intentionally avoid touching saved files here
// — callers should invoke store.save(filePath) when they wish to persist.

function ensureInternal(this: any) {
  if (!this.mutationLog) this.mutationLog = [];
  if (!this.appliedMutationIds) this.appliedMutationIds = new Set<string>();
  if (typeof this.seqCounter !== 'number') this.seqCounter = 0;
}

(DocumentStore.prototype as any).enqueueOfflineMutation = function (op: string, id: string, payload: any): number {
  try {
    ensureInternal.call(this);
    // Ensure monotonic sequence number. We increment and persist in-memory state.
    this.seqCounter = (typeof this.seqCounter === 'number') ? Math.max(0, this.seqCounter) + 1 : 1;
    const seq = this.seqCounter;
    const entry = { seq, id: String(id), op: String(op), payload };
    this.mutationLog.push(entry);
    return seq;
  } catch (_) {
    // On any unexpected error, attempt to fallback to a best-effort id of 0.
    try { return 0; } catch (_) { return 0; }
  }
};

(DocumentStore.prototype as any).getMutationLog = function () {
  try {
    ensureInternal.call(this);
    // Return a shallow-cloned and sorted snapshot to avoid exposing internal
    // mutable arrays to callers.
    const copy = Array.isArray(this.mutationLog) ? this.mutationLog.slice() : [];
    copy.sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));
    return copy.map((e: any) => ({ seq: e.seq, id: e.id, op: e.op, payload: e.payload }));
  } catch (_) {
    return [];
  }
};

(DocumentStore.prototype as any).markMutationApplied = function (id: string) {
  try {
    ensureInternal.call(this);
    this.appliedMutationIds.add(String(id));
  } catch (_) { /* swallow */ }
};

(DocumentStore.prototype as any).trimAppliedMutations = function () {
  try {
    ensureInternal.call(this);
    if (!Array.isArray(this.mutationLog) || this.mutationLog.length === 0) return;
    const applied = this.appliedMutationIds || new Set<string>();
    // Keep entries that are not recorded applied yet.
    this.mutationLog = this.mutationLog.filter((e: any) => !applied.has(String(e.id)));
  } catch (_) { /* swallow */ }
};

(DocumentStore.prototype as any).replayMutationLog = async function (replayer: (entry: { seq: number; id: string; op: string; payload: any }) => Promise<void> | void) {
  try {
    ensureInternal.call(this);
    if (!Array.isArray(this.mutationLog) || this.mutationLog.length === 0) return;

    // Sort deterministically by seq ascending and replay in-order.
    const entries = this.mutationLog.slice().sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0));

    for (const e of entries) {
      try {
        // If this entry's id is already recorded as applied, skip it silently
        // to ensure idempotent replay semantics.
        if (this.appliedMutationIds && this.appliedMutationIds.has(String(e.id))) continue;

        // Allow replayer to be either sync or async. Await to preserve order.
        await Promise.resolve(replayer({ seq: e.seq, id: String(e.id), op: String(e.op), payload: e.payload }));

        // If replayer succeeds, mark as applied so duplicates become no-ops.
        try { this.appliedMutationIds.add(String(e.id)); } catch (_) { /* swallow */ }
      } catch (err) {
        // If a particular entry fails to apply, leave it unmarked so future
        // replays can retry. Do not abort the whole replay; continue to allow
        // best-effort progress (but we do not mark failing entries).
        try { /* log debug if available */ } catch (_) { }
      }
    }

    // Optionally trim the log to remove applied entries to keep the log small.
    try {
      this.mutationLog = (this.mutationLog || []).filter((entry: any) => !this.appliedMutationIds.has(String(entry.id)));
    } catch (_) { /* swallow */ }
  } catch (_) {
    /* swallow outer errors to avoid breaking callers */
  }
};

export {};
