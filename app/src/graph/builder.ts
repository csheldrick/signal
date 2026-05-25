// ── Graph Builder ───────────────────────────────────────────
// Builds a traversable graph from document links.
// Imports from core/types and storage — creates cross-module edges.

import type { Document, DocumentLink } from '../core/types.js';
import type { DocumentStore } from '../storage/store.js';

export interface GraphNode {
  id: string;
  title: string;
  linkCount: number;
}

export interface AdjacencyList {
  nodes: Map<string, GraphNode>;
  edges: Map<string, Set<string>>;
}

export class GraphBuilder {
  constructor(private readonly store: DocumentStore) {}

  async buildGraph(): Promise<AdjacencyList> {
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, Set<string>>();
    const docs = this.store.list();

    for (const doc of docs) {
      nodes.set(doc.id, {
        id: doc.id,
        title: doc.title,
        linkCount: doc.links.length,
      });
      if (!edges.has(doc.id)) edges.set(doc.id, new Set());

      for (const link of doc.links) {
        edges.get(doc.id)!.add(link.targetId);
      }
    }

    return { nodes, edges };
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

        const neighbors = graph.edges.get(current);
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
