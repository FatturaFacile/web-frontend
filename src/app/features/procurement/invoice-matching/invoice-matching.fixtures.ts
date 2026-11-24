import {
  InvoiceMatchGrIr,
  InvoiceMatchLine,
  InvoiceMatchResolution,
  InvoiceMatchRun,
  InvoiceMatchSummary,
  InvoiceMatchToleranceRule,
} from '@domain/procurement/invoice-matching.models';

/** Test data shared by the specs of the invoice matching feature. */
export function matchLine(id: string, overrides: Partial<InvoiceMatchLine> = {}): InvoiceMatchLine {
  return {
    id,
    line_number: 1,
    description: `Item ${id}`,
    purchase_order_line_id: `pol-${id}`,
    passive_invoice_line_id: `pil-${id}`,
    status: 'matched',
    is_blocking: false,
    receipt_required: true,
    ordered_quantity: 10,
    received_quantity: 10,
    previously_invoiced_quantity: 0,
    invoiced_quantity: 10,
    ordered_unit_price: 5,
    invoiced_unit_price: 5,
    quantity_variance: 0,
    price_variance: 0,
    price_variance_percent: 0,
    amount_variance: 0,
    allowed_quantity_variance: 0,
    allowed_amount_variance: 1,
    gr_ir_amount: 50,
    tolerance_rule_id: null,
    reasons: [],
    ...overrides,
  };
}

/** A line that stays inside the tolerance: small price variance, not blocking. */
export const withinToleranceLine = (id = 'l-within'): InvoiceMatchLine =>
  matchLine(id, {
    line_number: 2,
    status: 'within_tolerance',
    invoiced_unit_price: 5.05,
    price_variance: 0.05,
    price_variance_percent: 1,
    amount_variance: 0.5,
    allowed_amount_variance: 1,
  });

/** A line above the price tolerance: blocking. */
export const blockingPriceLine = (id = 'l-blocking'): InvoiceMatchLine =>
  matchLine(id, {
    line_number: 3,
    status: 'price_variance',
    is_blocking: true,
    invoiced_unit_price: 6,
    price_variance: 1,
    price_variance_percent: 20,
    amount_variance: 10,
    allowed_amount_variance: 1,
    reasons: ['price_above_tolerance'],
  });

/** A line invoiced above what was received: blocking on the quantity. */
export const blockingQuantityLine = (id = 'l-qty'): InvoiceMatchLine =>
  matchLine(id, {
    line_number: 4,
    status: 'quantity_variance',
    is_blocking: true,
    received_quantity: 8,
    invoiced_quantity: 10,
    quantity_variance: 2,
    amount_variance: 10,
    reasons: ['quantity_above_received'],
  });

export function matchRun(overrides: Partial<InvoiceMatchRun> = {}): InvoiceMatchRun {
  return {
    id: 'run-1',
    passive_invoice_id: 'inv-1',
    invoice_number: 'FA-2026-001',
    invoice_date: '2026-11-02',
    invoice_due_date: '2026-12-02',
    invoice_total_amount: 1100,
    supplier_id: 'sup-1',
    supplier_name: 'Acme Forniture',
    purchase_order_id: 'po-1',
    po_number: 'PO-0001',
    match_type: '3_way',
    status: 'blocked_discrepancy',
    is_blocking: true,
    trigger: 'auto',
    reference_source: 'xml',
    reference_value: 'PO-0001',
    currency: 'EUR',
    ordered_total: 1000,
    received_total: 800,
    invoiced_total: 1100,
    variance_amount: 100,
    variance_percent: 10,
    gr_ir_amount: 800,
    price_variance_amount: 50,
    line_count: 3,
    discrepancy_count: 2,
    is_current: true,
    reasons: ['price_above_tolerance', 'quantity_above_received'],
    tolerance_snapshot: [
      { name: 'Default', scope: 'tenant', price_tolerance_percent: 2, price_tolerance_amount: 5 },
    ],
    evaluated_at: '2026-11-03T08:00:00Z',
    blocked_at: '2026-11-03T08:00:00Z',
    released_at: null,
    lines: [matchLine('l-ok'), withinToleranceLine(), blockingPriceLine(), blockingQuantityLine()],
    resolutions: [],
    ...overrides,
  };
}

export function matchSummary(overrides: Partial<InvoiceMatchSummary> = {}): InvoiceMatchSummary {
  return {
    total: 12,
    by_status: {
      matched: 7,
      within_tolerance: 2,
      blocked_discrepancy: 2,
      pending_credit_note: 1,
      override_approved: 0,
      resolved: 0,
    },
    blocked_count: 2,
    blocked_amount: '2500.00',
    auto_match_rate: 75,
    gr_ir_cleared_amount: '9800.00',
    ...overrides,
  };
}

export function resolution(
  overrides: Partial<InvoiceMatchResolution> = {},
): InvoiceMatchResolution {
  return {
    id: 'res-1',
    run_id: 'run-1',
    action: 'override',
    from_status: 'blocked_discrepancy',
    to_status: 'override_approved',
    reason: 'Approved by the CFO',
    actor_id: 'u-1',
    actor_name: 'Giulia Bianchi',
    context: {},
    resolved_at: '2026-11-04T09:00:00Z',
    ...overrides,
  };
}

export function toleranceRule(
  id: string,
  overrides: Partial<InvoiceMatchToleranceRule> = {},
): InvoiceMatchToleranceRule {
  return {
    id,
    name: `Rule ${id}`,
    scope: 'tenant',
    supplier_id: null,
    item_category: null,
    match_type: null,
    priority: 0,
    price_tolerance_percent: 2,
    price_tolerance_amount: 5,
    quantity_tolerance_percent: null,
    quantity_tolerance_amount: null,
    currency: 'EUR',
    is_active: true,
    notes: null,
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

export function grIr(overrides: Partial<InvoiceMatchGrIr> = {}): InvoiceMatchGrIr {
  return {
    currency: 'EUR',
    expected_clearing_amount: '800.00',
    expected_variance_amount: '300.00',
    accrued_amount: '800.00',
    cleared_amount: '0.00',
    open_balance: '800.00',
    receipts: [
      {
        journal_entry_id: 'je-1',
        entry_number: 'JE-100',
        posting_date: '2026-11-01',
        status: 'posted',
        description: 'Goods receipt',
        receipt_id: 'gr-1',
        receipt_number: 'GR-1',
        clearing_amount: '800.00',
        lines: [
          {
            account_code: '1400',
            account_name: 'Inventory',
            debit_amount: 800,
            credit_amount: 0,
            description: null,
          },
          {
            account_code: '2150',
            account_name: 'GR/IR',
            debit_amount: 0,
            credit_amount: 800,
            description: null,
          },
        ],
      },
    ],
    invoice: null,
    ...overrides,
  };
}
