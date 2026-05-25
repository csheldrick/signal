// ── Export Plugin ────────────────────────────────────────────
// Correct boundary usage — uses only PluginContext, no direct store import.
// Contrast with SearchPlugin for boundary detection validation.

import type { Plugin, PluginContext } from './host.js';

export class ExportPlugin implements Plugin {
  readonly id = 'export';
  readonly name = 'Markdown Export';
  private context: PluginContext | undefined;

  activate(context: PluginContext): void {
    this.context = context;
  }

  deactivate(): void {
    this.context = undefined;
  }

  exportToMarkdown(): string {
    if (!this.context) return '';

    const docs = this.context.listDocuments();
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
