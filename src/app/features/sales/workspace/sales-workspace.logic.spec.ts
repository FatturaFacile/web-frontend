import { describe, expect, it } from 'vitest';
import {
  atpBadge,
  atpPromiseDate,
  backorderTree,
  canShip,
  creditLevel,
  percentOf,
  shippableLines,
  tabFilters,
  validateCallOffQuantity,
} from './sales-workspace.logic';
import { CreditExposure, WorkspaceOrderLine } from './sales-workspace.models';

const exposure = (overrides: Partial<CreditExposure> = {}): CreditExposure => ({
  credit_limit: '10000.00',
  open_receivables: '2000.00',
  committed_orders: '1000.00',
  overdue_amount: '0.00',
  overdue_invoices_count: 0,
  max_overdue_days: 0,
  order_total: '1000.00',
  total_exposure: '4000.00',
  over_limit: false,
  has_overdue: false,
  block_reason: null,
  ...overrides,
});

const line = (overrides: Partial<WorkspaceOrderLine> = {}): WorkspaceOrderLine => ({
  id: 'l1',
  product_id: 'p1',
  warehouse_id: null,
  blanket_agreement_line_id: null,
  parent_line_id: null,
  is_backorder: false,
  backorder_sequence: 0,
  description: 'Pump',
  unit_of_measure: 'EA',
  ordered_quantity: '10.0000',
  reserved_quantity: '0.0000',
  delivered_quantity: '0.0000',
  invoiced_quantity: '0.0000',
  cancelled_quantity: '0.0000',
  backorder_quantity: '10.0000',
  requested_date: null,
  atp_promised_date: null,
  atp_status: null,
  replenishment_triggered: false,
  replenishment_reference_type: null,
  replenishment_reference_id: null,
  unit_price: '100.0000',
  discount_percent: '0.0000',
  tax_rate: '22.0000',
  line_subtotal: '1000.00',
  ...overrides,
});

describe('atpBadge', () => {
  it('maps each ATP status to its traffic light', () => {
    expect(atpBadge('available_on_time')).toEqual({ color: 'green', labelKey: 'SWK.ATP.IN_STOCK' });
    expect(atpBadge('partial_availability').color).toBe('gold');
    expect(atpBadge('delayed_atp').color).toBe('gold');
    expect(atpBadge('ctp_required').color).toBe('blue');
    expect(atpBadge('shortage')).toEqual({ color: 'red', labelKey: 'SWK.ATP.SHORTAGE' });
    expect(atpBadge(null).labelKey).toBe('SWK.ATP.UNKNOWN');
  });

  it('shows the ATP date before the CTP date', () => {
    expect(
      atpPromiseDate({ earliest_atp_date: '2026-12-01', ctp_estimated_date: '2026-12-20' }),
    ).toBe('2026-12-01');
    expect(atpPromiseDate({ earliest_atp_date: null, ctp_estimated_date: '2026-12-20' })).toBe(
      '2026-12-20',
    );
    expect(atpPromiseDate({ earliest_atp_date: null, ctp_estimated_date: null })).toBeNull();
  });
});

describe('creditLevel', () => {
  it('is blocked over the limit or with overdue invoices', () => {
    expect(creditLevel(exposure({ over_limit: true }))).toBe('blocked');
    expect(creditLevel(exposure({ has_overdue: true }))).toBe('blocked');
  });

  it('warns from 90% of the limit and is ok below it or without a limit', () => {
    expect(creditLevel(exposure({ total_exposure: '9000.00' }))).toBe('warning');
    expect(creditLevel(exposure({ total_exposure: '8999.00' }))).toBe('ok');
    expect(creditLevel(exposure({ credit_limit: '0.00', total_exposure: '99999.00' }))).toBe('ok');
    expect(creditLevel(undefined)).toBe('ok');
  });
});

describe('validateCallOffQuantity', () => {
  const agreementLine = { target_quantity: '100.0000', called_off_quantity: '60.0000' };

  it('accepts a release within the remaining balance', () => {
    expect(validateCallOffQuantity(agreementLine, 40)).toBe('ok');
  });

  it('refuses a release above the balance, or a non positive one', () => {
    expect(validateCallOffQuantity(agreementLine, 41)).toBe('exceeds_balance');
    expect(validateCallOffQuantity(agreementLine, 0)).toBe('invalid');
    expect(validateCallOffQuantity(agreementLine, Number.NaN)).toBe('invalid');
  });

  it('lets the tolerance percent over-release', () => {
    expect(validateCallOffQuantity(agreementLine, 50, 10)).toBe('ok');
    expect(validateCallOffQuantity(agreementLine, 51, 10)).toBe('exceeds_balance');
  });
});

describe('order helpers', () => {
  it('maps list tabs to API filters', () => {
    expect(tabFilters('all')).toEqual({});
    expect(tabFilters('credit_blocked')).toEqual({ credit_blocked: true });
    expect(tabFilters('partially_delivered')).toEqual({ status: 'in_fulfillment' });
  });

  it('clamps progress percentages', () => {
    expect(percentOf('40.00')).toBe(40);
    expect(percentOf('140')).toBe(100);
    expect(percentOf(null)).toBe(0);
    expect(percentOf('abc')).toBe(0);
  });

  it('ships only confirmed orders with open quantity', () => {
    const open = line();
    const done = line({ id: 'l2', backorder_quantity: '0.0000' });
    expect(shippableLines({ lines: [open, done] })).toEqual([open]);
    expect(canShip({ status: 'confirmed', lines: [open] })).toBe(true);
    expect(canShip({ status: 'on_hold', lines: [open] })).toBe(false);
    expect(canShip({ status: 'confirmed', lines: [done] })).toBe(false);
  });

  it('builds the backorder tree in sequence order', () => {
    const second = line({
      id: 'b2',
      parent_line_id: 'l1',
      is_backorder: true,
      backorder_sequence: 2,
    });
    const first = line({
      id: 'b1',
      parent_line_id: 'l1',
      is_backorder: true,
      backorder_sequence: 1,
    });
    const tree = backorderTree([line(), second, first]);
    expect(tree.get('l1')?.map((child) => child.id)).toEqual(['b1', 'b2']);
  });
});
