import { describe, expect, it } from 'vitest';
import { visualizationToCsv } from './copilot-csv';
import { contextFromUrl } from './copilot-context';
import { getByPath, coerceLike } from './copilot-action-path';
import type { CopilotCitation } from './copilot.models';
import { parseMarkdown } from './markdown';

const citations: CopilotCitation[] = [
  { type: 'regulatory', label: 'LIVA Art. 25', title: 'Tax rates', section_ref: 'Art. 25', jurisdiction: 'CH' },
  { type: 'entity', label: '#Invoice-INV-1', entity_type: 'invoice', entity_id: 'INV-1', route: '/sales/invoices/INV-1' },
];

describe('parseMarkdown', () => {
  it('turns bracketed labels and hash labels into citation badges and entity chips', () => {
    const [block] = parseMarkdown('See [LIVA Art. 25] and #Invoice-INV-1.', citations);

    expect(block.kind).toBe('paragraph');
    const kinds = block.kind === 'paragraph' ? block.children.map((t) => t.kind) : [];
    expect(kinds).toEqual(['text', 'regulatory', 'text', 'entity', 'text']);
  });

  it('keeps unknown brackets as text', () => {
    const [block] = parseMarkdown('[unknown ref]', citations);

    expect(block.kind === 'paragraph' && block.children[0]).toEqual({ kind: 'text', text: '[unknown ref]' });
  });

  it('never emits HTML or unsafe links', () => {
    const [block] = parseMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) [ok](https://example.com)');
    const children = block.kind === 'paragraph' ? block.children : [];

    expect(children.some((t) => t.kind === 'link' && t.href.startsWith('javascript'))).toBe(false);
    expect(children.find((t) => t.kind === 'link')).toMatchObject({ href: 'https://example.com' });
    expect(JSON.stringify(children)).toContain('<script>alert(1)</script>');
  });

  it('parses headings, lists, code and tables', () => {
    const blocks = parseMarkdown('# Title\n\n- a\n- b\n\n1. x\n\n```\ncode\n```\n\n| A | B |\n|---|---|\n| 1 | 2 |');

    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'list', 'list', 'code', 'table']);
  });
});

describe('visualizationToCsv', () => {
  it('follows column order, quotes values and neutralizes formulas', () => {
    const csv = visualizationToCsv({ columns: ['name', 'total'], rows: [{ total: 5, name: 'A, "B"' }, { name: '=SUM(A1)', total: -3 }] });

    expect(csv).toBe(['name,total', '"A, ""B""",5', "'=SUM(A1),-3"].join('\r\n'));
  });
});

describe('contextFromUrl', () => {
  it('derives the entity from a detail route', () => {
    expect(contextFromUrl('/sales/invoices/42?tab=1')).toEqual({ route: '/sales/invoices/42', entity_type: 'invoice', entity_id: '42' });
  });

  it('has no entity on a list route', () => {
    expect(contextFromUrl('/sales/invoices')).toEqual({ route: '/sales/invoices', entity_type: null, entity_id: null });
  });
});

describe('action path helpers', () => {
  it('reads dotted paths through arrays and coerces by original type', () => {
    expect(getByPath({ items: [{ quantity: 2 }] }, 'items.0.quantity')).toBe(2);
    expect(getByPath({}, 'a.b')).toBeUndefined();
    expect(coerceLike(2, '3,5')).toBe(3.5);
    expect(coerceLike(2, '')).toBeNaN();
    expect(coerceLike('x', 'y')).toBe('y');
  });
});
