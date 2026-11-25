import { ExmCardTransaction, ExmLine, ExmReport } from '@core';

/** Fixtures shared by the specs of the expense management feature. */

export const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });

export const pageMeta = { current_page: 1, last_page: 1, per_page: 25, total: 2 };

export function report(id: string, overrides: Partial<ExmReport> = {}): ExmReport {
  return {
    id,
    report_number: `ER-2028-000${id}`,
    title: null,
    employee_id: 'emp-1',
    employee: { id: 'emp-1', name: 'Anna Rossi' },
    user_id: 'user-1',
    cost_center_id: null,
    company_id: null,
    jurisdiction: 'IT',
    period_start: '2028-01-01',
    period_end: '2028-01-31',
    currency: 'EUR',
    status: 'draft',
    total_amount: '100.00',
    approved_amount: null,
    reimbursable_amount: '100.00',
    non_reimbursable_amount: '0.00',
    taxable_amount: '0.00',
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    posted_at: null,
    reimbursed_at: null,
    violations_count: 0,
    blocking_violations_count: 0,
    abilities: { update: true, submit: true, approve: false, settle: false },
    ...overrides,
  };
}

export function line(id: string, overrides: Partial<ExmLine> = {}): ExmLine {
  return {
    id,
    expense_report_id: '1',
    expense_date: '2028-01-10',
    category_id: 'cat-meals',
    category: { id: 'cat-meals', code: 'meals', name_key: 'expenseManagement.category.meals' },
    merchant_name: 'Trattoria',
    merchant_tax_id: null,
    description: null,
    original_amount: '40.00',
    original_currency: 'EUR',
    exchange_rate: null,
    exchange_rate_date: null,
    amount_in_base_currency: '40.00',
    vat_rate: '10.00',
    vat_amount: '3.64',
    vat_recoverable_amount: '3.64',
    payment_method: 'employee_out_of_pocket',
    corporate_card_transaction_id: null,
    is_traceable_payment: true,
    is_taxable_benefit: false,
    is_reimbursable: true,
    policy_violations: [],
    project_id: null,
    billable_to_customer: false,
    receipt_id: null,
    receipt_sha256: null,
    has_receipt: false,
    mileage: null,
    ...overrides,
  };
}

export function transaction(
  id: string,
  overrides: Partial<ExmCardTransaction> = {},
): ExmCardTransaction {
  return {
    id,
    card_account_id: 'card-1',
    merchant_name: 'Hotel Centrale',
    transaction_date: '2028-01-11',
    posting_date: '2028-01-12',
    amount: '120.00',
    currency: 'EUR',
    card_last4: '4242',
    holder_name: 'Anna Rossi',
    status: 'unmatched',
    matched_amount: '0.00',
    remaining_amount: '120.00',
    matched_lines: [],
    ...overrides,
  };
}
