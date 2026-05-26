// ── Export Plugin ────────────────────────────────────────────
// Correct boundary usage — uses only PluginContext, no direct store import.
// Contrast with SearchPlugin for boundary detection validation.

import type { Plugin, PluginContext } from './host.js';

export class ExportPlugin implements Plugin {
  readonly id = 'export';
  readonly name = 'Markdown Export';
  readonly usesPluginContext = true;
  private context: PluginContext | undefined;

  activate(context: PluginContext): void {
    this.context = context;
  }

  deactivate(): void {
    this.context = undefined;
  }

  exportToMarkdown(): string {
    if (!this.context) return '';

    const docs = this.context.listDocuments().map(d => ({
      ...d,
      links: Array.isArray((d as any).links) ? (d as any).links.map((l: any) => ({ ...l })) : [],
      tags: Array.isArray((d as any).tags) ? [...(d as any).tags] : [],
    }));
    const lines: string[] = [];

    for (const doc of docs) {
      lines.push(`# ${doc.title}`);
      lines.push('');
      lines.push(doc.content);
      if (doc.tags.length > 0) {
        lines.push('');
        lines.push(`Tags: ${doc.tags.join(', ')}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }
}

// sentinel moved to instance property (readonly usesPluginContext = true)

