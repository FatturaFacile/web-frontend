/** Maps the UI language and the tenant jurisdiction to a locale accepted by the Academy API. */
export function academyLocale(language: string, jurisdiction: 'IT' | 'CH'): string {
  if (language === 'en') {
    return 'en';
  }
  if (jurisdiction === 'CH' && ['it', 'de', 'fr'].includes(language)) {
    return `${language}-CH`;
  }
  return language === 'it' ? 'it-IT' : language;
}

/** Minimal, safe Markdown to HTML-free blocks: paragraphs and `- ` bullet lists (no raw HTML is ever produced). */
export interface MarkdownBlock {
  type: 'paragraph' | 'list' | 'heading';
  lines: string[];
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  for (const chunk of source.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      blocks.push({ type: 'list', lines: lines.map((l) => l.replace(/^\s*[-*]\s+/, '')) });
    } else if (/^#{1,6}\s+/.test(lines[0]) && lines.length === 1) {
      blocks.push({ type: 'heading', lines: [lines[0].replace(/^#{1,6}\s+/, '')] });
    } else {
      blocks.push({ type: 'paragraph', lines });
    }
  }
  return blocks;
}
