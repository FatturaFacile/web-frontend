import type { CopilotCitation, EntityCitation, RegulatoryCitation } from './copilot.models';

/**
 * Minimal Markdown to token-tree parser. It never produces HTML: the templates render the tokens with Angular
 * bindings, so raw HTML in a model answer is shown as text and cannot execute. Only `http(s)` and `mailto` links
 * are kept as links.
 */
export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: InlineToken[] }
  | { kind: 'em'; children: InlineToken[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: InlineToken[] }
  | { kind: 'regulatory'; label: string; citation: RegulatoryCitation }
  | { kind: 'entity'; label: string; citation: EntityCitation };

export type BlockToken =
  | { kind: 'paragraph'; children: InlineToken[] }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; children: InlineToken[] }
  | { kind: 'list'; ordered: boolean; items: InlineToken[][] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; children: InlineToken[] }
  | { kind: 'table'; header: InlineToken[][]; rows: InlineToken[][][] }
  | { kind: 'rule' };

interface Matchers {
  regulatory: Map<string, RegulatoryCitation>;
  entity: Map<string, EntityCitation>;
}

const stripBrackets = (label: string): string => label.trim().replace(/^\[|\]$/g, '').trim();
const stripHash = (label: string): string => label.trim().replace(/^#/, '');

function buildMatchers(citations: readonly CopilotCitation[]): Matchers {
  const regulatory = new Map<string, RegulatoryCitation>();
  const entity = new Map<string, EntityCitation>();
  for (const citation of citations) {
    if (citation.type === 'regulatory') {
      regulatory.set(stripBrackets(citation.label), citation);
    } else {
      entity.set(stripHash(citation.label), citation);
    }
  }

  return { regulatory, entity };
}

export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href.trim());
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\[[^\]\n]+\])|(#[A-Za-z][\w-]*-[\w-]+(?:\.[\w-]+)*)/g;

function parseInline(text: string, m: Matchers): InlineToken[] {
  const out: InlineToken[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index) });
    const raw = match[0];
    last = index + raw.length;

    if (match[1]) {
      out.push({ kind: 'code', text: raw.slice(1, -1) });
    } else if (match[2]) {
      out.push({ kind: 'strong', children: parseInline(raw.slice(2, -2), m) });
    } else if (match[3]) {
      out.push({ kind: 'em', children: parseInline(raw.slice(1, -1), m) });
    } else if (match[4]) {
      const close = raw.indexOf('](');
      const label = raw.slice(1, close);
      const href = raw.slice(close + 2, -1);
      out.push(isSafeHref(href) ? { kind: 'link', href, children: parseInline(label, m) } : { kind: 'text', text: label });
    } else if (match[5]) {
      const citation = m.regulatory.get(stripBrackets(raw));
      out.push(citation ? { kind: 'regulatory', label: stripBrackets(raw), citation } : { kind: 'text', text: raw });
    } else {
      const citation = m.entity.get(stripHash(raw));
      out.push(citation ? { kind: 'entity', label: raw, citation } : { kind: 'text', text: raw });
    }
  }

  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });

  return out;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

const isTableSeparator = (line: string): boolean => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(source: string, citations: readonly CopilotCitation[] = []): BlockToken[] {
  const m = buildMatchers(citations);
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
    } else if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push({ kind: 'code', text: code.join('\n') });
    } else if (/^#{1,4}\s/.test(line)) {
      const level = line.indexOf(' ') as 1 | 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, children: parseInline(line.slice(level + 1).trim(), m) });
      i++;
    } else if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
    } else if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: InlineToken[][] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''), m));
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
    } else if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', children: parseInline(quote.join(' '), m) });
    } else if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line).map((c) => parseInline(c, m));
      i += 2;
      const rows: InlineToken[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i++]).map((c) => parseInline(c, m)));
      }
      blocks.push({ kind: 'table', header, rows });
    } else {
      const paragraph: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].startsWith('```') &&
        !/^#{1,4}\s/.test(lines[i]) &&
        !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])
      ) {
        paragraph.push(lines[i++].trim());
      }
      blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' '), m) });
    }
  }

  return blocks;
}
