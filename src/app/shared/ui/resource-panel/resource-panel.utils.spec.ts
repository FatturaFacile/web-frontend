import { describe, expect, it } from 'vitest';
import { act, rf, req, whenIn } from './resource-config.helpers';
import {
  buildRequestBody,
  getByPath,
  humanize,
  initialFormValue,
  isPathResolvable,
  resolvePath,
  rowIdAliases,
} from './resource-panel.utils';

describe('resource panel utils', () => {
  it('reads dotted paths', () => {
    expect(getByPath({ occupancy: { items: 3 } }, 'occupancy.items')).toBe(3);
    expect(getByPath({}, 'a.b')).toBeUndefined();
  });

  it('resolves placeholders from the first source that has a value', () => {
    expect(resolvePath('/x/{id}/y/{warehouse_id}', { id: 'r1' }, { warehouse_id: 'w1', id: 'no' })).toBe('/x/r1/y/w1');
    expect(isPathResolvable('/x/{warehouse_id}/zones', { warehouse_id: null })).toBe(false);
    expect(isPathResolvable('/x/{warehouse_id}/zones', { warehouse_id: 'w1' })).toBe(true);
    expect(isPathResolvable('/x/zones')).toBe(true);
  });

  it('aliases `...Id` placeholders to the row id', () => {
    expect(rowIdAliases('/variants/{variantId}', { id: 'v1' })).toEqual({ variantId: 'v1' });
    expect(resolvePath('/variants/{variantId}', {}, rowIdAliases('/variants/{variantId}', { id: 'v1' }))).toBe('/variants/v1');
  });

  it('humanizes enum codes', () => {
    expect(humanize('partially_received')).toBe('Partially received');
  });

  it('builds a clean request body: blanks dropped, decimals kept as strings, json parsed, lines cleaned', () => {
    const fields = [
      req(rf.decimal('quantity')),
      rf.text('notes'),
      rf.bool('is_locked'),
      rf.integer('priority'),
      rf.datetime('expires_at'),
      rf.json('recipient'),
      rf.lines('lines', [rf.uuid('lot_id'), rf.decimal('quantity')]),
    ];
    const body = buildRequestBody(fields, {
      quantity: '12.500',
      notes: '',
      is_locked: false,
      priority: '3',
      expires_at: '2026-05-01T10:30',
      recipient: '{"name":"ACME"}',
      lines: [{ lot_id: '', quantity: '1.0' }, { lot_id: '', quantity: '' }],
    });
    expect(body).toEqual({
      quantity: '12.500',
      is_locked: false,
      priority: 3,
      expires_at: '2026-05-01T10:30:00',
      recipient: { name: 'ACME' },
      lines: [{ quantity: '1.0' }],
    });
  });

  it('pre-fills a form from a row', () => {
    const fields = [rf.text('name'), rf.bool('is_active', { defaultValue: true }), rf.date('requested_date'), rf.json('attributes')];
    expect(initialFormValue(fields, { name: 'A', requested_date: '2026-01-02T00:00:00Z', attributes: ['S'] })).toEqual({
      name: 'A',
      is_active: true,
      requested_date: '2026-01-02',
      attributes: '["S"]',
    });
    expect(initialFormValue([rf.tags('sales_order_ids')])).toEqual({ sales_order_ids: [] });
  });

  it('keeps files and multiselect values in the request body', () => {
    const file = new File(['x'], 'a.csv');
    const fields = [rf.file('file'), rf.multiselect('legal_bases', ['consent', 'contract'])];
    expect(initialFormValue(fields)).toEqual({ file: '', legal_bases: [] });
    expect(buildRequestBody(fields, { file, legal_bases: ['consent'] })).toEqual({ file, legal_bases: ['consent'] });
    expect(buildRequestBody(fields, { file: '', legal_bases: [] })).toEqual({});
  });

  it('helpers build actions and visibility predicates', () => {
    const action = act('POST', 'RES.ACTION.CANCEL', '/x/{id}/cancel', { confirm: true, danger: true });
    expect(action.method).toBe('POST');
    expect(action.confirmKey).toBe('RES.CONFIRM.GENERIC');
    expect(whenIn('status', 'open', 'draft')({ status: 'draft' })).toBe(true);
    expect(whenIn('status', 'open')({ status: 'closed' })).toBe(false);
  });
});
