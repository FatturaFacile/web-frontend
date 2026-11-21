import { describe, expect, it } from 'vitest';
import { diffRows } from './cpq-quotes.diff';
import { EditorLine, EditorSection, RevisionDiff } from './cpq-quotes.models';
import {
  defaultHeader,
  emptyLine,
  emptySection,
  includedLines,
  moveLine,
  moveSection,
  priceQuote,
  toPayload,
} from './cpq-quotes.utils';

function line(
  key: string,
  sectionKey: string,
  price: number,
  extra: Partial<EditorLine> = {},
): EditorLine {
  return {
    ...emptyLine('product', sectionKey),
    key,
    description: key,
    unit_price: price,
    tax_rate: 22,
    ...extra,
  };
}

const section = (key: string, discount = 0): EditorSection => ({
  ...emptySection(key),
  key,
  discount_percent: discount,
});
const header = {
  header_discount_percent: 0,
  jurisdiction: 'IT' as const,
  currency: 'EUR' as const,
};

describe('priceQuote', () => {
  it('prices mandatory lines with VAT per rate', () => {
    const totals = priceQuote(
      [section('s1')],
      [line('a', 's1', 100, { quantity: 3 }), line('b', 's1', 50, { tax_rate: 10 })],
      header,
    );

    expect(totals).toMatchObject({ net: 350, tax: 71, gross: 421, payable: 421, rounding: 0 });
    expect(totals.taxBreakdown).toEqual([
      { rate: 10, net: 50, tax: 5 },
      { rate: 22, net: 300, tax: 66 },
    ]);
  });

  it('counts an optional line only when it is on by default and exactly one alternative per group', () => {
    const lines = [
      line('base', 's1', 100),
      line('opt', 's1', 40, { selection_mode: 'optional', is_default_selected: false }),
      line('a', 's1', 10, {
        selection_mode: 'alternative_group',
        alternative_group: 'w',
        is_default_selected: false,
      }),
      line('b', 's1', 20, {
        selection_mode: 'alternative_group',
        alternative_group: 'w',
        is_default_selected: true,
      }),
    ];

    expect([...includedLines(lines)].sort()).toEqual(['b', 'base']);
    expect(priceQuote([section('s1')], lines, header).net).toBe(120);
  });

  it('cascades line, section and header discounts like the server', () => {
    const totals = priceQuote(
      [section('s1', 10)],
      [line('a', 's1', 100, { quantity: 2, discount_percent: 10, discount_fixed: 5 })],
      { ...header, header_discount_percent: 5 },
    );

    expect(totals.lineNet['a']).toBe(149.63);
    expect(totals.sectionSubtotals['s1']).toBe(149.63);
  });

  it('uses the tier price of the highest threshold reached', () => {
    const tiers = [
      { min_qty: 10, unit_price: 90 },
      { min_qty: 50, unit_price: 80 },
    ];
    const net = (quantity: number) =>
      priceQuote([section('s1')], [line('a', 's1', 100, { quantity, tier_prices: tiers })], header)
        .net;

    expect([net(5), net(10), net(60)]).toEqual([500, 900, 4800]);
  });

  it('rounds the Swiss payable total to 0.05', () => {
    const totals = priceQuote([section('s1')], [line('a', 's1', 33.33, { tax_rate: 8.1 })], {
      ...header,
      jurisdiction: 'CH',
      currency: 'CHF',
    });

    expect(totals).toMatchObject({
      net: 33.33,
      tax: 2.7,
      gross: 36.03,
      payable: 36.05,
      rounding: 0.02,
    });
  });

  it('computes the margin on the included lines and the running subtotal of a subtotal row', () => {
    const lines = [
      line('a', 's1', 100, { unit_cost: 60 }),
      { ...emptyLine('subtotal', 's1'), key: 'sub' },
      line('b', 's1', 50, { unit_cost: 20 }),
    ];
    const totals = priceQuote([section('s1')], lines, header);

    expect(totals).toMatchObject({ cost: 80, margin: 70, marginPercent: 46.67 });
    expect(totals.runningSubtotal['sub']).toBe(100);
  });
});

describe('reordering', () => {
  const lines = [line('a', 's1', 1), line('b', 's1', 1), line('c', 's2', 1), line('d', 's2', 1)];
  const order = (all: EditorLine[], sectionKey: string) =>
    all.filter((l) => l.sectionKey === sectionKey).map((l) => l.key);

  it('moves a line within its section', () => {
    expect(order(moveLine(lines, 'a', 's1', 1), 's1')).toEqual(['b', 'a']);
  });

  it('moves a line into another section at the requested position', () => {
    const moved = moveLine(lines, 'a', 's2', 1);

    expect(order(moved, 's1')).toEqual(['b']);
    expect(order(moved, 's2')).toEqual(['c', 'a', 'd']);
  });

  it('appends to the end of a section and fills an empty one', () => {
    expect(order(moveLine(lines, 'a', 's2', 99), 's2')).toEqual(['c', 'd', 'a']);
    expect(order(moveLine(lines, 'a', 's3', 0), 's3')).toEqual(['a']);
  });

  it('recalculates the section subtotals after a move', () => {
    const sections = [section('s1'), section('s2')];
    const priced = [line('a', 's1', 100), line('b', 's2', 50)];

    expect(priceQuote(sections, priced, header).sectionSubtotals).toEqual({ s1: 100, s2: 50 });
    expect(priceQuote(sections, moveLine(priced, 'a', 's2', 0), header).sectionSubtotals).toEqual({
      s2: 150,
    });
  });

  it('reorders whole sections', () => {
    expect(moveSection([section('x'), section('y'), section('z')], 0, 2).map((s) => s.key)).toEqual(
      ['y', 'z', 'x'],
    );
  });
});

describe('toPayload', () => {
  it('sends the ids back so a revision keeps its lineage, and drops the group of non-alternative lines', () => {
    const payload = toPayload(
      defaultHeader(),
      [{ ...section('s1'), id: 'sec-1' }],
      [{ ...line('a', 's1', 10), id: 'line-1', alternative_group: 'stale' }],
    ) as {
      sections: { id?: string }[];
      lines: { id?: string; alternative_group: string | null; section_key: string | null }[];
    };

    expect(payload.sections[0].id).toBe('sec-1');
    expect(payload.lines[0]).toMatchObject({
      id: 'line-1',
      alternative_group: null,
      section_key: 's1',
    });
  });
});

describe('diffRows', () => {
  it('flattens sections then lines into added, removed and modified rows', () => {
    const diff: RevisionDiff = {
      from: 'OFF-1.01',
      to: 'OFF-1.02',
      sections: { added: [{ title: 'Services' }], removed: [], modified: [] },
      lines: {
        added: [{ description: 'Setup' }],
        removed: [{ description: 'Cable' }],
        modified: [
          {
            key: 'l1',
            label: 'Server',
            changes: {
              quantity: { from: '1.0000', to: '2.0000' },
              is_default_selected: { from: true, to: false },
            },
          },
        ],
      },
      totals: {},
    };

    const rows = diffRows(diff);

    expect(rows.map((r) => `${r.scope}:${r.kind}:${r.label}`)).toEqual([
      'SECTION:added:Services',
      'LINE:added:Setup',
      'LINE:removed:Cable',
      'LINE:modified:Server',
    ]);
    expect(rows[3].changes).toEqual([
      { field: 'quantity', from: '1.0000', to: '2.0000' },
      { field: 'is_default_selected', from: '✓', to: '✗' },
    ]);
  });
});
