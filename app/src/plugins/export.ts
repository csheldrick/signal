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

  private lastExportTs = 0;
  private static readonly MIN_EXPORT_INTERVAL_MS = 500;

  exportToMarkdown(): string {
    if (!this.context) return '';

    // Throttle exports to avoid repeated expensive list/cloning operations
    // that can overload the document store or plugin host. If called too
    // frequently, return a short empty export rather than blocking.
    const now = Date.now();
    if (now - this.lastExportTs < ExportPlugin.MIN_EXPORT_INTERVAL_MS) return '';
    this.lastExportTs = now;

    try {
      const all = this.context.listDocuments();
      const MAX_EXPORT = 500;
      let docs = all;
      let truncatedNote = '';
      if (all.length > MAX_EXPORT) {
        docs = all.slice(0, MAX_EXPORT);
        truncatedNote = `\n\n[Export truncated: ${all.length} documents, included first ${MAX_EXPORT}]\n`;
      }
      const docsTransformed = docs.map(d => ({
        ...d,
        links: Array.isArray((d as any).links) ? (d as any).links.map((l: any) => ({ ...l })) : [],
        tags: Array.isArray((d as any).tags) ? [...(d as any).tags] : [],
      }));
      const lines: string[] = [];

      for (const doc of docsTransformed) {
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

      if (truncatedNote) lines.push(truncatedNote);
      return lines.join('\n');
    } catch (_) {
      // Fail-safe: never throw from a plugin helper; return empty export on error.
      return '';
    }
  }
}

// sentinel moved to instance property (readonly usesPluginContext = true)

