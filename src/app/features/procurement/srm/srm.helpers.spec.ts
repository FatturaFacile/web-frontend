import { describe, expect, it } from 'vitest';
import {
  coverage,
  documentLink,
  nodeStatusColor,
  nodeStatusKey,
  scoreStatus,
  tierColor,
  toNumber,
} from './srm.helpers';

describe('srm helpers', () => {
  it('colours the supplier tiers', () => {
    expect(tierColor('A')).toBe('success');
    expect(tierColor('B')).toBe('processing');
    expect(tierColor('C')).toBe('warning');
    expect(tierColor('D')).toBe('error');
    expect(tierColor(null)).toBe('default');
  });

  it('maps a score to a progress status at the tier thresholds', () => {
    expect(scoreStatus('75.00')).toBe('success');
    expect(scoreStatus('74.99')).toBe('normal');
    expect(scoreStatus('60')).toBe('normal');
    expect(scoreStatus('59.99')).toBe('exception');
    expect(scoreStatus(null)).toBe('normal');
  });

  it('parses decimal strings and rejects missing or invalid values', () => {
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(3)).toBe(3);
    expect(toNumber(null)).toBeNull();
    expect(toNumber('')).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });

  it('computes the covered share of the ordered quantity, capped at 100', () => {
    expect(coverage('5', '10')).toBe(50);
    expect(coverage('12', '10')).toBe(100);
    expect(coverage('3', '0')).toBe(0);
    expect(coverage('x', '10')).toBe(0);
  });

  it('labels only the statuses that have a seeded translation', () => {
    expect(nodeStatusKey({ status: 'blocked_discrepancy' })).toBe(
      'srm.flow.status.blocked_discrepancy',
    );
    expect(nodeStatusKey({ status: 'something_new' })).toBeNull();
    expect(nodeStatusKey({ status: null })).toBeNull();
  });

  it('colours blocking, waiting and completed statuses', () => {
    const colour = (status: string): string => nodeStatusColor({ type: 'purchase_order', status });
    expect(colour('blocked_discrepancy')).toBe('red');
    expect(colour('pending_approval')).toBe('orange');
    expect(colour('approved')).toBe('green');
    expect(colour('sent')).toBe('blue');
  });

  it('links each document type to its detail page', () => {
    expect(documentLink({ type: 'purchase_order', id: 'po-1' })).toEqual([
      '/procurement/purchase-orders',
      'po-1',
    ]);
    expect(documentLink({ type: 'requisition', id: 'r-1' })).toEqual([
      '/procurement/requisitions',
      'r-1',
    ]);
    expect(documentLink({ type: 'framework_agreement', id: 'c-1' })).toEqual([
      '/procurement/contracts',
      'c-1',
      'balance',
    ]);
    expect(documentLink({ type: 'supplier_invoice', id: 'i-1' })).toEqual(['/purchases/invoices']);
  });
});
