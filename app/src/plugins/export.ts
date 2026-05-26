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
      const MAX_EXPORT = 100; // hard cap for exported documents
      const CONTENT_MAX = 10_000; // cap per-document content size to limit memory

      const total = Array.isArray(all) ? all.length : 0;
      const docs = Array.isArray(all) ? all.slice(0, MAX_EXPORT) : [];
      const truncatedNote = total > MAX_EXPORT ? `\n\n[Export truncated: ${total} documents, included first ${MAX_EXPORT}]\n` : '';

      const lines: string[] = [];

      for (const d of docs) {
        try {
          const title = typeof (d as any).title === 'string' ? (d as any).title : '';
          let content = typeof (d as any).content === 'string' ? (d as any).content : '';
          if (content.length > CONTENT_MAX) {
            content = content.slice(0, CONTENT_MAX) + '\n\n[content truncated]';
          }

          const tagsArr = Array.isArray((d as any).tags) ? (d as any).tags.filter((t: any) => typeof t === 'string').slice(0, 10) : [];

          lines.push(`# ${title}`);
          lines.push('');
          lines.push(content);

          if (tagsArr.length > 0) {
            lines.push('');
            lines.push(`Tags: ${tagsArr.join(', ')}`);
          }

          lines.push('');
          lines.push('---');
          lines.push('');
        } catch (_) {
          // If transforming a single doc fails, skip it but continue the export.
          continue;
        }
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

