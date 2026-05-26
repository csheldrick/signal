// ── UI Renderer ─────────────────────────────────────────────
// Simple text-based rendering of documents and graphs.
// Adds another subsystem node and cross-module edges for Loom.

import type { Document } from '../core/types.js';
import type { AdjacencyList } from '../graph/builder.js';

export function renderDocument(doc: Document): string {
  const header = `[${doc.id}] ${doc.title}`;
  const tagsArray = Array.isArray((doc as any).tags) ? (doc as any).tags : [];
  const meta = `  tags: ${tagsArray.length > 0 ? tagsArray.join(', ') : '(none)'}`;
  const linksArray = Array.isArray((doc as any).links) ? (doc as any).links as Array<{targetId?: string; kind?: string}> : [];
  const links = linksArray.length > 0
    ? `  links: ${linksArray.map((l: {targetId?: string; kind?: string}) => `${l.targetId || '?'} (${l.kind || '?'})`).join(', ')}`
    : '  links: (none)';
  const content = typeof (doc as any).content === 'string' ? (doc as any).content : '';
  const body = content.split('\n').map((line: string) => `  ${line}`).join('\n');

  return [header, meta, links, '', body].join('\n');
}

export function renderDocumentList(docs: Document[]): string {
  if (docs.length === 0) return '(no documents)';
  return docs
    .map(d => `  ${d.id}  ${d.title}  [${d.tags.join(', ')}]`)
    .join('\n');
}

export function renderGraph(graph: AdjacencyList): string {
  const lines: string[] = [];
  lines.push(`Graph: ${graph.nodes.size} nodes`);
  lines.push('');

  for (const [nodeId, neighbors] of graph.edges) {
    const node = graph.nodes.get(nodeId);
    const label = node ? node.title : nodeId;
    const targets = Array.from(neighbors);
    if (targets.length > 0) {
      lines.push(`  ${label} → ${targets.join(', ')}`);
    } else {
      lines.push(`  ${label} (isolated)`);
    }
  }

  return lines.join('\n');
}
