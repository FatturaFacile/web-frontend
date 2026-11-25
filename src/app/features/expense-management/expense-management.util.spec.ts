import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  canCancel,
  canConfirmReimbursement,
  canDecide,
  canExport,
  canStartReview,
  canSubmit,
  currentMonth,
  defaultCalculationSource,
  errorKey,
  failureOf,
  fiscalNotices,
  isEditable,
  isPositive,
  parseCardCsv,
  problemOf,
  reconciliationColor,
  severityColor,
  statusColor,
  toNumber,
  violationKey,
  worstSeverity,
} from './expense-management.util';
import { report } from './expense-management.testing';

describe('expense management util', () => {
  it('builds the error key from the problem code with a generic fallback', () => {
    expect(errorKey('report_empty')).toBe('expenseManagement.error.report_empty');
    expect(errorKey(null)).toBe('expenseManagement.error.generic');
  });

  it('reads the problem of a failed call, also from a blob', async () => {
    const plain = new HttpErrorResponse({ status: 422, error: { code: 'period_invalid' } });
    expect((await problemOf(plain))?.code).toBe('period_invalid');

    const blob = new HttpErrorResponse({
      status: 404,
      error: new Blob([JSON.stringify({ code: 'receipt_not_found' })]),
    });
    expect((await failureOf(blob)).errorKey).toBe('expenseManagement.error.receipt_not_found');
    expect(await problemOf(new Error('x'))).toBeNull();
  });

  it('keeps the first field error of a validation failure', async () => {
    const failure = await failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { errors: { period_end: ['After the start.'] } },
      }),
    );

    expect(failure.ok).toBe(false);
    expect(failure.detail).toBe('After the start.');
    expect(failure.errors).toEqual({ period_end: ['After the start.'] });
  });

  it('derives the abilities of the workflow from the status and the API abilities', () => {
    const draft = report('1');
    expect(isEditable(draft)).toBe(true);
    expect(canSubmit(draft)).toBe(true);
    expect(canCancel(draft)).toBe(true);
    expect(canDecide(draft)).toBe(false);

    const submitted = report('2', {
      status: 'submitted',
      abilities: { update: true, submit: false, approve: true, settle: false },
    });
    expect(isEditable(submitted)).toBe(false);
    expect(canDecide(submitted)).toBe(true);

    const approved = report('3', {
      status: 'approved',
      abilities: { update: false, submit: false, approve: false, settle: true },
    });
    expect(canExport(approved)).toBe(true);
    expect(canConfirmReimbursement(approved)).toBe(false);
    expect(canConfirmReimbursement({ ...approved, status: 'posted' })).toBe(true);

    expect(
      canSubmit(
        report('4', { abilities: { update: false, submit: false, approve: false, settle: false } }),
      ),
    ).toBe(false);
  });

  it('colours statuses, severities and reconciliation states', () => {
    expect(statusColor('draft')).toBe('geekblue');
    expect(statusColor('rejected')).toBe('red');
    expect(statusColor('reimbursed')).toBe('green');
    expect(severityColor('blocking')).toBe('red');
    expect(severityColor('warning')).toBe('orange');
    expect(reconciliationColor('matched')).toBe('green');
    expect(reconciliationColor('unmatched')).toBe('gold');
  });

  it('picks the fiscal notices and the default rate source of the jurisdiction', () => {
    expect(fiscalNotices('IT')).toContain('it_art51_tuir');
    expect(fiscalNotices('IT')).toContain('it_traceable_payment');
    expect(fiscalNotices('CH')).toEqual(['ch_spesenreglement', 'ch_tcs_mileage']);
    expect(defaultCalculationSource('IT')).toBe('IT_ACI_TABLE');
    expect(defaultCalculationSource('CH')).toBe('CH_TCS');
  });

  it('reads decimals and finds the worst severity', () => {
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(isPositive('0.01')).toBe(true);
    expect(isPositive('0.00')).toBe(false);

    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity([{ code: 'a', severity: 'warning' }])).toBe('warning');
    expect(
      worstSeverity([
        { code: 'a', severity: 'warning' },
        { code: 'b', severity: 'blocking' },
      ]),
    ).toBe('blocking');
    expect(violationKey({ code: 'future_date' })).toBe('expenseManagement.violation.future_date');
  });

  it('bounds the current month', () => {
    const { start, end } = currentMonth();

    expect(start.endsWith('-01')).toBe(true);
    expect(end >= start).toBe(true);
  });
});

describe('card statement import', () => {
  it('reads the rows of a CSV with a comma or a semicolon', () => {
    const comma = parseCardCsv(
      'external_id,merchant_name,transaction_date,amount,currency\nA1,Hotel,2028-01-10,120.50,EUR\n',
    );
    expect(comma).toEqual([
      {
        external_id: 'A1',
        merchant_name: 'Hotel',
        transaction_date: '2028-01-10',
        posting_date: null,
        amount: '120.50',
        currency: 'EUR',
      },
    ]);

    const semicolon = parseCardCsv(
      'merchant_name;transaction_date;amount\n"Taxi";2028-01-11;"15,40"',
    );
    expect(semicolon[0].amount).toBe('15.40');
    expect(semicolon[0].external_id).toBeNull();
  });

  it('skips the rows without a merchant, a date or a valid amount', () => {
    const rows = parseCardCsv(
      'merchant_name,transaction_date,amount\n,2028-01-10,10\nBar,,10\nBar,2028-01-10,abc\nBar,2028-01-10,5',
    );

    expect(rows).toHaveLength(1);
    expect(parseCardCsv('merchant_name')).toEqual([]);
  });

  it('lets an approver start the review of a submitted report only', () => {
    const approver = { approve: true, update: false, submit: false, settle: false };

    expect(canStartReview(report('1', { status: 'submitted', abilities: approver }))).toBe(true);
    expect(canStartReview(report('1', { status: 'under_review', abilities: approver }))).toBe(
      false,
    );
    expect(canStartReview(report('1', { status: 'submitted' }))).toBe(false);
  });
});
