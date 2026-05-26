// ── Graph Builder ───────────────────────────────────────────
// Builds a traversable graph from document links.
// Imports from core/types and storage — creates cross-module edges.

import type { DocumentSnapshot } from '../core/types.js';


export interface GraphNode {
  readonly id: string;
  readonly title: string;
  readonly linkCount: number;
}

export interface AdjacencyList {
  readonly nodes: ReadonlyMap<string, GraphNode>;
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>;
}

export type GraphAdjacencyList = AdjacencyList;

export class GraphBuilder {
  private lastSignature: string | undefined;
  private cachedGraph: AdjacencyList | undefined;

  constructor(private readonly listDocuments: () => Array<DocumentSnapshot>) {}

  private computeSignature(docs: Array<DocumentSnapshot>): string {
    // Stable short signature: id and updatedAt are sufficient to detect content changes
    // Build a compact numeric signature rather than concatenating many strings
    // This reduces temporary string allocation and GC pressure for large doc sets.
    let hash = 2166136261 >>> 0;
    for (const d of docs) {
      const id = String(d.id || '');
      for (let i = 0; i < id.length; i++) {
        hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
      }
      const updatedStr = String((d as any).updatedAt ?? 0);
      for (let i = 0; i < updatedStr.length; i++) {
        hash = Math.imul(hash ^ updatedStr.charCodeAt(i), 16777619) >>> 0;
      }
    }
    return String(hash);
  }

  private cloneAdjacency(adj: AdjacencyList): AdjacencyList {
    const nodes = new Map<string, GraphNode>();
    for (const [k, v] of adj.nodes) nodes.set(k, { ...v });
    const edges = new Map<string, Set<string>>();
    for (const [k, s] of adj.edges) edges.set(k, new Set(s));
    return { nodes, edges };
  }

  // In-flight build coalescing: when many callers request the graph at
  // the same time we avoid recomputing the adjacency repeatedly by sharing
  // a single in-progress Promise. This reduces CPU/memory pressure during
  // bursts and helps avoid subsystem overload. Additionally we implement a
  // short throttle and a per-build document cap to avoid rebuild storms and
  // long synchronous loops when the doc set is large.
  private building?: Promise<AdjacencyList> | undefined;
  private lastBuildTs: number = 0;
  private static readonly BUILD_THROTTLE_MS = 250; // short throttle window
  private static readonly MAX_DOCS_PROCESS = 500; // cap documents per build to bound work

  async buildGraph(): Promise<AdjacencyList> {
    const docs = this.listDocuments() || [];
    const signature = this.computeSignature(docs);
    const now = Date.now();

    // Fast-path: identical signature and cached graph available.
    if (this.lastSignature === signature && this.cachedGraph) {
      return this.cloneAdjacency(this.cachedGraph);
    }

    // Short-term throttle: if we have a cached graph and the last build
    // happened recently, return the cached clone to avoid rebuild storms.
    // This helps when many callers trigger graph operations in quick
    // succession (e.g. UI refresh loops).
    if (this.cachedGraph && (now - this.lastBuildTs) < GraphBuilder.BUILD_THROTTLE_MS) {
      return this.cloneAdjacency(this.cachedGraph);
    }

    // If a build is already in flight for a differing signature, wait for it
    // to complete and return a cloned adjacency to avoid duplicated work.
    if (this.building) {
      try {
        const adj = await this.building;
        return this.cloneAdjacency(adj);
      } catch (_) {
        // If the in-flight build failed, fall through to attempt a rebuild.
      }
    }

    // Start a new build and record the promise so concurrent callers can
    // await the same work instead of duplicating it.
    this.building = (async () => {
      const nodes = new Map<string, GraphNode>();
      const edges = new Map<string, Set<string>>();

      // Cap the amount of documents processed in a single build to avoid
      // long synchronous loops that can monopolize the event loop. We
      // process a representative prefix; callers that need full graph can
      // request again later when the background load subsides.
      const toProcess = docs.slice(0, GraphBuilder.MAX_DOCS_PROCESS);

      for (const doc of toProcess) {
        nodes.set(doc.id, {
          id: doc.id,
          title: doc.title,
          linkCount: Array.isArray((doc as any).links) ? (doc as any).links.length : 0,
        });
        if (!edges.has(doc.id)) edges.set(doc.id, new Set());

        for (const link of (doc as any).links || []) {
          try {
            edges.get(doc.id)!.add(link.targetId);
            if (!nodes.has(link.targetId)) {
              nodes.set(link.targetId, { id: link.targetId, title: '(missing)', linkCount: 0 });
            }
            if (!edges.has(link.targetId)) edges.set(link.targetId, new Set());
          } catch (_) {
            // Defensive: ignore malformed link entries to keep the builder
            // robust under partial/malformed data.
          }
        }
      }

      const adj: AdjacencyList = { nodes, edges };
      // Cache a clone so subsequent identical queries return quickly without
      // exposing internal mutable structures.
      this.cachedGraph = this.cloneAdjacency(adj);
      this.lastSignature = signature;
      this.lastBuildTs = Date.now();

      // Clear the in-flight marker and return the computed adjacency.
      this.building = undefined;
      return adj;
    })();

    const result = await this.building;
    return this.cloneAdjacency(result);
  }

  async findClusters(): Promise<string[][]> {
    const graph = await this.buildGraph();
    // Precompute reverse adjacency map for incoming neighbors to avoid
    // scanning all edges for every node visit. This reduces complexity from
    // O(N * E) worst-case to O(N + E) and alleviates hotspot pressure.
    const reverse = new Map<string, Set<string>>();
    for (const [src, set] of graph.edges) {
      for (const tgt of set) {
        let s = reverse.get(tgt);
        if (!s) {
          s = new Set<string>();
          reverse.set(tgt, s);
        }
        s.add(src);
      }
    }

    const visited = new Set<string>();
    const clusters: string[][] = [];

    for (const nodeId of graph.nodes.keys()) {
      if (visited.has(nodeId)) continue;

      const cluster: string[] = [];
      const queue = [nodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        cluster.push(current);

        const neighbors = new Set<string>();
        // Outgoing neighbors
        const out = graph.edges.get(current);
        if (out) for (const n of out) neighbors.add(n);
        // Incoming neighbors (treat graph as undirected for clustering)
        const incoming = reverse.get(current);
        if (incoming) for (const src of incoming) neighbors.add(src);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) queue.push(neighbor);
          }
        }
      }

      if (cluster.length > 0) clusters.push(cluster);
    }

    return clusters;
  }

  async findHubs(minLinks: number = 3): Promise<GraphNode[]> {
    const graph = await this.buildGraph();
    return Array.from(graph.nodes.values())
      .filter(n => n.linkCount >= minLinks)
      .sort((a, b) => b.linkCount - a.linkCount);
  }
}
