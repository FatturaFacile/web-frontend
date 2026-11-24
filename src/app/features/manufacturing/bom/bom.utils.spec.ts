import { describe, expect, it } from 'vitest';
import { BomExplosionLine } from '@core';
import {
  autoMapColumns,
  buildTree,
  detectDelimiter,
  diffRows,
  editsToChanges,
  expandableKeys,
  flattenVisible,
  mapRows,
  missingRequired,
  normalizeDecimal,
  parseCsv,
  previewEffectiveQuantity,
  reorderSequences,
  rollupCost,
  toNumber,
} from './bom.utils';
import { cellText } from './bom-spreadsheet';

const line = (over: Partial<BomExplosionLine>): BomExplosionLine => ({
  level: 1,
  item_code: 'X',
  net_quantity: '1',
  variable_waste_quantity: '0',
  fixed_waste_quantity: '0',
  effective_quantity: '1',
  is_phantom: false,
  has_bom: false,
  path: [],
  ...over,
});

const LINES: BomExplosionLine[] = [
  line({ level: 1, item_code: 'A', has_bom: true, effective_quantity: '2', path: ['A'] }),
  line({ level: 2, item_code: 'A1', effective_quantity: '4', unit_cost: '2.5', path: ['A', 'A1'] }),
  line({ level: 2, item_code: 'A2', effective_quantity: '1', unit_cost: '10', path: ['A', 'A2'] }),
  line({ level: 1, item_code: 'B', effective_quantity: '3', unit_cost: '1', path: ['B'] }),
];

describe('bom tree', () => {
  it('nests lines under the closest preceding line of the level above', () => {
    const tree = buildTree(LINES);

    expect(tree.map((n) => n.line.item_code)).toEqual(['A', 'B']);
    expect(tree[0].children.map((n) => n.line.item_code)).toEqual(['A1', 'A2']);
    expect(buildTree([])).toEqual([]);
  });

  it('handles explosions that start at level 0', () => {
    const tree = buildTree([line({ level: 0, item_code: 'R' }), line({ level: 1, item_code: 'C' })]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].line.item_code).toBe('C');
  });

  it('shows children only for expanded nodes', () => {
    const tree = buildTree(LINES);

    expect(flattenVisible(tree, new Set()).map((n) => n.line.item_code)).toEqual(['A', 'B']);
    expect(flattenVisible(tree, new Set(expandableKeys(tree))).map((n) => n.line.item_code)).toEqual(['A', 'A1', 'A2', 'B']);
  });

  it('rolls the cost up from the leaves', () => {
    const tree = buildTree(LINES);

    expect(rollupCost(tree[0])).toBe(20);
    expect(rollupCost(tree[1])).toBe(3);
  });

  it('previews the quantity with scrap, yield and fixed waste', () => {
    expect(
      previewEffectiveQuantity({ net_quantity: 10, scrap_percentage: 10, yield_percentage: 50, fixed_waste_quantity: 1 }),
    ).toBe(23);
    expect(
      previewEffectiveQuantity({ net_quantity: 10, scrap_percentage: 0, yield_percentage: 0, fixed_waste_quantity: 0 }),
    ).toBe(10);
  });

  it('renumbers sequences after a move', () => {
    const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

    expect(reorderSequences(items, 2, 0)).toEqual([
      { key: 'c', sequence: 10 },
      { key: 'a', sequence: 20 },
      { key: 'b', sequence: 30 },
    ]);
    expect(reorderSequences(items, 0, 9).map((i) => i.key)).toEqual(['a', 'b', 'c']);
  });

  it('turns edits into update changes and skips empty ones', () => {
    const edits = new Map([
      ['k1', { itemId: 'i1', edit: { quantity_per: '2' } }],
      ['k2', { itemId: 'i2', edit: {} }],
    ]);

    expect(editsToChanges(edits)).toEqual([{ action: 'update', component_item_id: 'i1', quantity_per: '2' }]);
  });

  it('parses decimals with comma', () => {
    expect(toNumber('1,5')).toBe(1.5);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });
});

describe('bom import parsing', () => {
  it('detects the delimiter and parses quoted cells', () => {
    const text = 'code;qty;notes\r\nA;1,5;"say ""hi""; ok"\r\n\r\nB;2;\r\n';

    expect(detectDelimiter(text)).toBe(';');
    expect(parseCsv(text)).toEqual([
      ['code', 'qty', 'notes'],
      ['A', '1,5', 'say "hi"; ok'],
      ['B', '2', ''],
    ]);
  });

  it('keeps newlines inside quotes and strips the BOM', () => {
    expect(parseCsv('﻿a,b\n"x\ny",z')).toEqual([
      ['a', 'b'],
      ['x\ny', 'z'],
    ]);
  });

  it('maps columns by header names in several languages', () => {
    const mapping = autoMapColumns(['Codice', 'Quantità', 'UM', 'Scarto %', 'Resa', 'Note']);

    expect(mapping.item_code).toBe(0);
    expect(mapping.quantity_per).toBe(1);
    expect(mapping.uom).toBe(2);
    expect(mapping.scrap_percentage).toBe(3);
    expect(mapping.yield_percentage).toBe(4);
    expect(mapping.fixed_scrap_quantity).toBeNull();
    expect(mapping.notes).toBe(5);
    expect(missingRequired(autoMapColumns(['foo', 'bar']))).toEqual(['item_code', 'quantity_per']);
  });

  it('normalises decimals and builds rows', () => {
    expect(normalizeDecimal('1.234,5')).toBe('1234.5');
    expect(normalizeDecimal('1,234.5')).toBe('1234.5');
    expect(normalizeDecimal('0,25')).toBe('0.25');

    const mapping = autoMapColumns(['item_code', 'quantity_per', 'scrap_percentage']);

    expect(mapRows([['A', '1,5', '2'], ['', '', ''], ['B', '3', '']], mapping)).toEqual([
      { item_code: 'A', quantity_per: '1.5', scrap_percentage: '2' },
      { item_code: 'B', quantity_per: '3' },
    ]);
  });

  it('reads spreadsheet cell values', () => {
    expect(cellText({ result: 5 })).toBe('5');
    expect(cellText({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab');
    expect(cellText(null)).toBe('');
    expect(cellText(new Date('2026-03-04T00:00:00Z'))).toBe('2026-03-04');
  });
});

describe('diff rows', () => {
  it('flattens added, removed and modified lines', () => {
    const rows = diffRows({
      added: [{ item_code: 'N', quantity_per: '1' }],
      removed: [{ item_code: 'O', quantity_per: '2' }],
      modified: [{ item_code: 'M', changes: { quantity_per: { from: '1', to: '3' }, scrap_percentage: { from: null, to: '2' } } }],
    });

    expect(rows).toEqual([
      { kind: 'added', code: 'N', field: null, from: null, to: '1' },
      { kind: 'removed', code: 'O', field: null, from: '2', to: null },
      { kind: 'modified', code: 'M', field: 'quantity_per', from: '1', to: '3' },
      { kind: 'modified', code: 'M', field: 'scrap_percentage', from: '', to: '2' },
    ]);
    expect(diffRows(null)).toEqual([]);
  });
});
