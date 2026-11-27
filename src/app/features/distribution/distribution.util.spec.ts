import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  alertColor,
  attempt,
  bucketLabel,
  errorKey,
  expectedArrival,
  failureOf,
  formatQuantity,
  isStockoutCell,
  needsResolution,
  numberOrNull,
  outstandingQuantity,
  proposalStatusColor,
  refLabel,
  shortageOf,
  toNumber,
  transferActions,
  transferStatusColor,
  TRANSFER_TABS,
} from './distribution.util';

describe('distribution util', () => {
  it('builds the error key from the problem code and reads the 422 field errors', () => {
    expect(errorKey('same_warehouse')).toBe('distribution.error.same_warehouse');
    expect(errorKey(null)).toBe('distribution.error.generic');

    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          code: 'insufficient_stock',
          errors: { 'lines.0.quantity': ['Too much'] },
          params: { sku: 'A1', skip: {} },
        },
      }),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('distribution.error.insufficient_stock');
    expect(outcome.detail).toBe('Too much');
    expect(outcome.params).toEqual({ sku: 'A1' });
    expect(failureOf(new Error('x')).errorKey).toBe('distribution.error.generic');
  });

  it('converts decimals and formats quantities', () => {
    expect(toNumber('12.5000')).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(formatQuantity('12.5000')).toBe('12.5');
    expect(formatQuantity('10.0000')).toBe('10');
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('4')).toBe(4);
  });

  it('allows the actions each transfer status permits and never a cancel in transit', () => {
    expect(transferActions('draft')).toEqual({
      approve: true,
      dispatch: false,
      receive: false,
      cancel: true,
    });
    expect(transferActions('approved')).toEqual({
      approve: false,
      dispatch: true,
      receive: false,
      cancel: true,
    });
    expect(transferActions('in_transit')).toEqual({
      approve: false,
      dispatch: false,
      receive: true,
      cancel: false,
    });
    expect(transferActions('partially_received').receive).toBe(true);
    expect(transferActions('received')).toEqual({
      approve: false,
      dispatch: false,
      receive: false,
      cancel: false,
    });
  });

  it('keeps the tabs of the list in the order of the workflow', () => {
    expect(TRANSFER_TABS).toEqual([
      null,
      'draft',
      'approved',
      'in_transit',
      'partially_received',
      'received',
      'cancelled',
    ]);
  });

  it('computes outstanding units and the shortage of a receipt', () => {
    const line = { quantity_shipped: '10', quantity_received: '4', quantity_damaged: '1' };
    expect(outstandingQuantity(line)).toBe(5);
    expect(shortageOf(5, 3, 1)).toBe(1);
    expect(shortageOf(5, 5, 1)).toBe(0);
    expect(needsResolution(0, 0)).toBe(false);
    expect(needsResolution(1, 0)).toBe(true);
    expect(needsResolution(0, 2)).toBe(true);
  });

  it('adds the lane lead time to the dispatch date', () => {
    expect(expectedArrival(new Date(2026, 0, 30), 3)).toBe('2026-02-02');
    expect(expectedArrival(new Date(2026, 0, 1), 1, 30)).toBe('2026-01-04');
  });

  it('flags the buckets under the safety stock or with a net requirement', () => {
    const cell = (projected: number, net: number) => ({
      index: 0,
      gross_requirements: 0,
      scheduled_receipts: 0,
      projected_available: projected,
      net_requirements: net,
      planned_receipts: 0,
      planned_releases: 0,
    });
    expect(isStockoutCell(cell(5, 0), 10)).toBe(true);
    expect(isStockoutCell(cell(20, 0), 10)).toBe(false);
    expect(isStockoutCell(cell(20, 3), 10)).toBe(true);
  });

  it('labels buckets and references', () => {
    const bucket = { index: 0, start: '2026-03-02', end: '2026-03-08' };
    expect(bucketLabel(bucket, 'daily')).toBe('02/03');
    expect(bucketLabel(bucket, 'weekly')).toBe('02/03 - 08/03');
    expect(refLabel({ code: 'MI', name: 'Milano' })).toBe('MI Milano');
    expect(refLabel({ sku: 'A1', name: 'Bolt' })).toBe('A1 Bolt');
    expect(refLabel(null)).toBe('—');
  });

  it('answers the outcome of a write call', async () => {
    expect((await attempt(() => Promise.resolve(1))).ok).toBe(true);
    const failed = await attempt(() =>
      Promise.reject(new HttpErrorResponse({ status: 409, error: { code: 'x' } })),
    );
    expect(failed.errorKey).toBe('distribution.error.x');
  });

  it('colours the statuses', () => {
    expect(transferStatusColor('discrepancy_pending')).toBe('red');
    expect(proposalStatusColor('shortfall')).toBe('red');
    expect(alertColor('stockout_risk')).toBe('red');
    expect(alertColor('excess_stock')).toBe('gold');
  });
});
