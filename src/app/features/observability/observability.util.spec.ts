import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { obsSlowQuery } from '../../../testing/observability-fixtures';
import {
  copyText,
  failureKey,
  flattenPlan,
  formatMs,
  formatPercent,
  latencyColor,
  rootPlanNode,
  statusColor,
  statusKey,
  statusSignature,
} from './observability.util';

describe('observability util', () => {
  it('maps a status to a colour and a translation key', () => {
    expect(statusColor('operational')).toBe('green');
    expect(statusColor('outage')).toBe('red');
    expect(statusColor('unknown')).toBe('default');
    expect(statusKey('degraded')).toBe('OBSERVABILITY.STATUS.DEGRADED');
  });

  it('turns a failed call into a forbidden or a generic error key', () => {
    expect(failureKey(new HttpErrorResponse({ status: 403 }))).toBe('OBSERVABILITY.ERROR.FORBIDDEN');
    expect(failureKey(new HttpErrorResponse({ status: 500 }))).toBe('OBSERVABILITY.ERROR.GENERIC');
    expect(failureKey(new Error('x'))).toBe('OBSERVABILITY.ERROR.GENERIC');
  });

  it('formats milliseconds and percentages', () => {
    expect(formatMs(12.345)).toBe('12.3');
    expect(formatMs(412.6)).toBe('413');
    expect(formatMs(null)).toBe('—');
    expect(formatPercent(99.456, 2)).toBe('99.46%');
    expect(formatPercent(undefined)).toBe('—');
  });

  it('colours a latency against the threshold', () => {
    expect(latencyColor(1200, 1000)).toBe('red');
    expect(latencyColor(600, 1000)).toBe('gold');
    expect(latencyColor(100, 1000)).toBe('default');
  });

  it('reads the root of a plan however it is wrapped', () => {
    const query = obsSlowQuery();
    expect(rootPlanNode(query.plan)?.['Node Type']).toBe('Sort');
    expect(rootPlanNode({ Plan: { 'Node Type': 'Result' } })?.['Node Type']).toBe('Result');
    expect(rootPlanNode({ 'Node Type': 'Limit' })?.['Node Type']).toBe('Limit');
    expect(rootPlanNode(null)).toBeNull();
  });

  it('flattens the plan depth-first and flags sequential scans', () => {
    const rows = flattenPlan(obsSlowQuery().plan);

    expect(rows.map((row) => [row.nodeType, row.depth, row.seqScan])).toEqual([
      ['Sort', 0, false],
      ['Seq Scan', 1, true],
    ]);
    expect(rows[1]).toMatchObject({ target: 'invoices', rows: 1200, filter: '(status = ?)' });
    expect(flattenPlan(null)).toEqual([]);
  });

  it('builds a stable signature of the connectors that are not operational', () => {
    expect(
      statusSignature([
        { key: 'vies', status: 'outage' },
        { key: 'sdi', status: 'degraded' },
        { key: 'ecb', status: 'operational' },
      ]),
    ).toBe('sdi:degraded|vies:outage');
    expect(statusSignature([{ key: 'sdi', status: 'operational' }])).toBe('');
  });

  it('copies to the clipboard and reports a refusal', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyText('select 1')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('select 1');

    writeText.mockRejectedValue(new Error('denied'));
    await expect(copyText('select 1')).resolves.toBe(false);
  });
});
