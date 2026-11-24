import { describe, expect, it } from 'vitest';
import {
  confirmationLineHasVariance,
  dropshipStatusColor,
  effectiveDiscountPercent,
  parseDiscountCascade,
  PurchaseOrderConfirmationLine,
} from './purchase-order-fulfilment.models';

function line(overrides: Partial<PurchaseOrderConfirmationLine> = {}): PurchaseOrderConfirmationLine {
  return {
    purchase_order_line_id: 'l-1',
    ordered_quantity: '10.0000',
    confirmed_quantity: '10.0000',
    ordered_unit_price: '5.0000',
    confirmed_unit_price: '5.0000',
    requested_delivery_date: '2026-12-01',
    confirmed_delivery_date: '2026-12-01',
    quantity_variance: '0.0000',
    quantity_variance_base: '0.0000',
    price_variance: '0.0000',
    price_variance_percent: '0.00',
    line_total_variance: '0.00',
    delivery_delay_days: 0,
    variance_reason: null,
    ...overrides,
  };
}

describe('purchase order fulfilment models', () => {
  it('detects quantity, price and date variances on a confirmation line', () => {
    expect(confirmationLineHasVariance(line())).toBe(false);
    expect(confirmationLineHasVariance(line({ quantity_variance: '-2.0000' }))).toBe(true);
    expect(confirmationLineHasVariance(line({ price_variance: '0.5000' }))).toBe(true);
    expect(confirmationLineHasVariance(line({ delivery_delay_days: 3 }))).toBe(true);
  });

  it('parses a discount cascade typed as text', () => {
    expect(parseDiscountCascade('')).toEqual([]);
    expect(parseDiscountCascade(null)).toEqual([]);
    expect(parseDiscountCascade('10 5')).toEqual([10, 5]);
    expect(parseDiscountCascade('10; 2,5 + 1')).toEqual([10, 2.5, 1]);
    expect(parseDiscountCascade('10 abc')).toBeNull();
    expect(parseDiscountCascade('101')).toBeNull();
    expect(parseDiscountCascade('-1')).toBeNull();
  });

  it('combines a cascade into its effective percentage', () => {
    expect(effectiveDiscountPercent([])).toBe(0);
    expect(effectiveDiscountPercent([10, 5])).toBe(14.5);
    expect(effectiveDiscountPercent([100, 20])).toBe(100);
  });

  it('maps dropshipment statuses to tag colours', () => {
    expect(dropshipStatusColor('pending')).toBe('default');
    expect(dropshipStatusColor('ddt_issued')).toBe('blue');
    expect(dropshipStatusColor('partially_delivered')).toBe('warning');
    expect(dropshipStatusColor('delivered')).toBe('success');
  });
});
