import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseManagementApiService } from '@core';
import { pageMeta, report, wrap } from './expense-management.testing';
import { ReportsStore } from './reports.store';

const lookups = {
  categories: [],
  statuses: [],
  payment_methods: [],
  calculation_sources: [],
  destination_types: [],
  allowance_methods: [],
  reconciliation_statuses: [],
  jurisdiction: 'IT',
  base_currency: 'EUR',
  fiscal_notice_codes: ['it_art51_tuir'],
  employees: [{ id: 'emp-1', name: 'Anna Rossi' }],
};

const balance = {
  open_reports: 1,
  open_amount: '100.00',
  approved_unpaid_amount: '0.00',
  advances_outstanding: '0.00',
  per_diem_taxable_ytd: '0.00',
  currency: 'EUR',
};

describe('ReportsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ReportsStore>;

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getBalance: vi.fn(() => of(wrap(balance))),
      listReports: vi.fn(() => of({ ...wrap([report('1'), report('2')]), meta: pageMeta })),
      createReport: vi.fn(() => of(wrap(report('3')))),
      deleteReport: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({
      providers: [ReportsStore, { provide: ExpenseManagementApiService, useValue: api }],
    });
    store = TestBed.inject(ReportsStore);
  });

  it('loads the reports, the lookups and the balance', async () => {
    await store.init();

    expect(store.reports()).toHaveLength(2);
    expect(store.total()).toBe(2);
    expect(store.employees()).toEqual([{ id: 'emp-1', name: 'Anna Rossi' }]);
    expect(store.jurisdiction()).toBe('IT');
    expect(store.fiscalNoticeCodes()).toEqual(['it_art51_tuir']);
    expect(store.balance()?.open_reports).toBe(1);
    expect(api['listReports']).toHaveBeenCalledWith({ per_page: 25, page: 1 });
  });

  it('applies the filters from the first page and pages on', async () => {
    await store.init();
    await store.setPage(2);
    expect(api['listReports']).toHaveBeenLastCalledWith({ per_page: 25, page: 2 });

    await store.setFilters({ status: 'approved', q: 'rossi' });
    expect(api['listReports']).toHaveBeenLastCalledWith({
      per_page: 25,
      page: 1,
      status: 'approved',
      q: 'rossi',
    });
  });

  it('creates a report, remembers it and reloads the list', async () => {
    await store.init();
    const outcome = await store.create({ period_start: '2028-01-01', period_end: '2028-01-31' });

    expect(outcome.ok).toBe(true);
    expect(store.created()?.id).toBe('3');
    expect(api['listReports']).toHaveBeenCalledTimes(2);
  });

  it('answers the translated refusal of a failed creation', async () => {
    api['createReport'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'period_invalid' } })),
    );

    const outcome = await store.create({ period_start: '2028-02-01', period_end: '2028-01-01' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('expenseManagement.error.period_invalid');
    expect(store.saving()).toBe(false);
  });

  it('keeps the error key when the list cannot be read', async () => {
    api['listReports'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );

    await store.load();

    expect(store.error()).toBe('expenseManagement.error.generic');
    expect(store.loading()).toBe(false);
  });
});
