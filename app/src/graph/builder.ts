// ── Graph Builder ───────────────────────────────────────────
// Builds a traversable graph from document links.
// Imports from core/types and storage — creates cross-module edges.

import type { DocumentSnapshot, Document } from '../core/types.js';


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

  constructor(private readonly listDocuments: () => Array<Document | DocumentSnapshot>) {}

  private computeSignature(docs: Array<Document | DocumentSnapshot>): string {
    // Stable short signature: id and updatedAt are sufficient to detect content changes
    return docs.map(d => `${d.id}:${d.updatedAt}`).join('|');
  }

  private cloneAdjacency(adj: AdjacencyList): AdjacencyList {
    const nodes = new Map<string, GraphNode>();
    for (const [k, v] of adj.nodes) nodes.set(k, { ...v });
    const edges = new Map<string, Set<string>>();
    for (const [k, s] of adj.edges) edges.set(k, new Set(s));
    return { nodes, edges };
  }

  async buildGraph(): Promise<AdjacencyList> {
    const docs = this.listDocuments();
    const signature = this.computeSignature(docs as Array<Document | DocumentSnapshot>);
    if (this.lastSignature === signature && this.cachedGraph) {
      return this.cloneAdjacency(this.cachedGraph);
    }

    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, Set<string>>();

    for (const doc of docs) {
      nodes.set(doc.id, {
        id: doc.id,
        title: doc.title,
        linkCount: Array.isArray((doc as any).links) ? (doc as any).links.length : 0,
      });
      if (!edges.has(doc.id)) edges.set(doc.id, new Set());

      for (const link of (doc as any).links || []) {
        edges.get(doc.id)!.add(link.targetId);
        // Ensure the referenced target exists in the nodes map so graph
        // traversals and clustering consider referenced-but-missing nodes.
        if (!nodes.has(link.targetId)) {
          nodes.set(link.targetId, { id: link.targetId, title: '(missing)', linkCount: 0 });
        }
        // Ensure adjacency entry for the target exists so incoming edges are
        // represented consistently (helps undirected traversals).
        if (!edges.has(link.targetId)) edges.set(link.targetId, new Set());
      }
    }

    const adj: AdjacencyList = { nodes, edges };
    // Cache a clone so subsequent identical queries return quickly without
    // exposing internal mutable structures.
    this.cachedGraph = this.cloneAdjacency(adj);
    this.lastSignature = signature;
    return adj;
  }

  async findClusters(): Promise<string[][]> {
    const graph = await this.buildGraph();
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
        for (const [src, set] of graph.edges) {
          if (set.has(current)) neighbors.add(src);
        }
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
