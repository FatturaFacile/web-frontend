import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseManagementApiService } from '@core';
import { line, report, wrap } from './expense-management.testing';
import { ReportDetailStore } from './report-detail.store';

function detail(overrides: Partial<ReturnType<typeof report>> = {}, lines = [line('l-1')]) {
  return { ...report('1', overrides), lines, per_diems: [], audit: [], payouts: [] };
}

describe('ReportDetailStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ReportDetailStore>;

  beforeEach(() => {
    api = {
      getReport: vi.fn(() => of(wrap(detail()))),
      getLookups: vi.fn(() =>
        of(
          wrap({
            categories: [{ id: 'cat-meals', code: 'meals' }],
            jurisdiction: 'IT',
            fiscal_notice_codes: ['it_art51_tuir'],
          }),
        ),
      ),
      addLine: vi.fn(() => of(wrap({}))),
      updateLine: vi.fn(() => of(wrap({}))),
      removeLine: vi.fn(() => of(wrap({}))),
      addMileageClaim: vi.fn(() => of(wrap({}))),
      addPerDiem: vi.fn(() => of(wrap({}))),
      removePerDiem: vi.fn(() => of(wrap(null))),
      submit: vi.fn(() => of(wrap(report('1', { status: 'submitted' })))),
      approve: vi.fn(() => of(wrap(report('1', { status: 'approved' })))),
      reject: vi.fn(() => of(wrap(report('1', { status: 'rejected' })))),
      exportPayout: vi.fn(() => of(wrap({}))),
      confirmReimbursement: vi.fn(() => of(wrap({}))),
      cancel: vi.fn(() => of(wrap({}))),
      downloadPayout: vi.fn(() => of(new Blob(['<xml/>']))),
    };
    TestBed.configureTestingModule({
      providers: [ReportDetailStore, { provide: ExpenseManagementApiService, useValue: api }],
    });
    store = TestBed.inject(ReportDetailStore);
  });

  it('loads the report with the lookups of its jurisdiction', async () => {
    await store.load('1');

    expect(store.report()?.report_number).toBe('ER-2028-0001');
    expect(store.lines()).toHaveLength(1);
    expect(store.jurisdiction()).toBe('IT');
    expect(store.fiscalNoticeCodes()).toEqual(['it_art51_tuir']);
    expect(store.editable()).toBe(true);
    expect(store.canSubmit()).toBe(true);
    expect(store.canDecide()).toBe(false);
  });

  it('counts the lines with a blocking violation', async () => {
    api['getReport'].mockReturnValue(
      of(
        wrap(
          detail({}, [
            line('l-1', {
              policy_violations: [{ code: 'receipt_required', severity: 'blocking' }],
            }),
            line('l-2', {
              policy_violations: [{ code: 'non_traceable_payment', severity: 'warning' }],
            }),
          ]),
        ),
      ),
    );

    await store.load('1');

    expect(store.blockingCount()).toBe(1);
  });

  it('adds or updates a line and re-reads the report', async () => {
    await store.load('1');
    const payload = {
      expense_date: '2028-01-10',
      category_id: 'cat-meals',
      merchant_name: 'Trattoria',
      original_amount: 40,
      original_currency: 'EUR',
      payment_method: 'employee_out_of_pocket' as const,
      is_traceable_payment: false,
    };

    expect((await store.saveLine(payload)).ok).toBe(true);
    expect(api['addLine']).toHaveBeenCalledWith('1', payload);

    await store.saveLine(payload, 'l-1');
    expect(api['updateLine']).toHaveBeenCalledWith('1', 'l-1', payload);
    expect(api['getReport']).toHaveBeenCalledTimes(3);
  });

  it('runs the workflow actions on the loaded report', async () => {
    await store.load('1');

    await store.submit();
    await store.approve({ approved_amount: '90.00' });
    await store.reject('No receipt');
    await store.exportPayout('pain001', '2028-02-01');
    await store.confirmReimbursement();
    await store.cancel();

    expect(api['submit']).toHaveBeenCalledWith('1');
    expect(api['approve']).toHaveBeenCalledWith('1', { approved_amount: '90.00' });
    expect(api['reject']).toHaveBeenCalledWith('1', 'No receipt');
    expect(api['exportPayout']).toHaveBeenCalledWith('1', {
      channel: 'pain001',
      execution_date: '2028-02-01',
    });
    expect(api['confirmReimbursement']).toHaveBeenCalledWith('1');
    expect(api['cancel']).toHaveBeenCalledWith('1');
  });

  it('answers the refusal and frees the buttons', async () => {
    await store.load('1');
    api['submit'].mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'blocking_violations' } }),
      ),
    );

    const outcome = await store.submit();

    expect(outcome.errorKey).toBe('expenseManagement.error.blocking_violations');
    expect(store.busy()).toBe(false);
  });

  it('downloads the payout file with a fallback name', async () => {
    await store.load('1');
    const file = await store.downloadPayout({
      id: 'p-1',
      channel: 'pain001',
      status: 'exported',
      total_amount: '90.00',
      taxable_amount: '0.00',
      exempt_amount: '90.00',
      file_name: null,
    });

    expect(file?.fileName).toBe('payout-p-1.xml');
    expect(api['downloadPayout']).toHaveBeenCalledWith('1', 'p-1');
  });
});
