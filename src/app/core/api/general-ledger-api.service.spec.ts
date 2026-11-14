import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { GeneralLedgerApiService } from '@core';

interface Case {
  name: string;
  call: (s: GeneralLedgerApiService) => Observable<unknown>;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

const range = { from: '2026-01-01', to: '2026-12-31' };

const CASES: Case[] = [
  { name: 'getSettings', call: (s) => s.getSettings(), method: 'GET', path: '/settings' },
  {
    name: 'updateSettings',
    call: (s) =>
      s.updateSettings({ posting_accounts: { fx_realised_gain: 'a1' }, manual_journal_approval_required: true }),
    method: 'PUT',
    path: '/settings',
    body: { posting_accounts: { fx_realised_gain: 'a1' }, manual_journal_approval_required: true },
  },
  { name: 'getAccountList', call: (s) => s.getAccountList({ per_page: 500 }), method: 'GET', path: '/accounts', params: { per_page: '500' } },
  { name: 'getJournals', call: (s) => s.getJournals({ status: 'pending_approval' }), method: 'GET', path: '/journals', params: { status: 'pending_approval' } },
  { name: 'getJournal', call: (s) => s.getJournal('j1'), method: 'GET', path: '/journals/j1' },
  { name: 'reverseJournalEntry', call: (s) => s.reverseJournalEntry('j1'), method: 'POST', path: '/journals/j1/reverse', body: {} },
  {
    name: 'createAccount',
    call: (s) => s.createAccount({ account_code: '2', name: 'Bank', account_type: 'asset', normal_balance: 'debit' }),
    method: 'POST',
    path: '/accounts',
    body: { account_code: '2', name: 'Bank', account_type: 'asset', normal_balance: 'debit' },
  },
  { name: 'getAccount', call: (s) => s.getAccount('a1'), method: 'GET', path: '/accounts/a1' },
  {
    name: 'updateAccount',
    call: (s) => s.updateAccount('a1', { account_code: '1', name: 'Cash', account_type: 'asset', normal_balance: 'debit' }),
    method: 'PUT',
    path: '/accounts/a1',
    body: { account_code: '1', name: 'Cash', account_type: 'asset', normal_balance: 'debit' },
  },
  { name: 'deleteAccount', call: (s) => s.deleteAccount('a1'), method: 'DELETE', path: '/accounts/a1' },
  { name: 'submitJournal', call: (s) => s.submitJournal('j1'), method: 'POST', path: '/journals/j1/submit', body: {} },
  { name: 'approveJournal', call: (s) => s.approveJournal('j1'), method: 'POST', path: '/journals/j1/approve', body: {} },
  {
    name: 'rejectJournal',
    call: (s) => s.rejectJournal('j1', 'wrong'),
    method: 'POST',
    path: '/journals/j1/reject',
    body: { reason: 'wrong' },
  },
  {
    name: 'getRecurringJournals',
    call: (s) => s.getRecurringJournals({ status: 'active' }),
    method: 'GET',
    path: '/recurring-journals',
    params: { status: 'active' },
  },
  { name: 'getRecurringJournal', call: (s) => s.getRecurringJournal('r1'), method: 'GET', path: '/recurring-journals/r1' },
  {
    name: 'createRecurringJournal',
    call: (s) =>
      s.createRecurringJournal({
        name: 'Rent',
        description: 'Rent',
        frequency: 'monthly',
        start_date: '2026-01-01',
        lines: [{ account_id: 'a1', debit_amount: 10, credit_amount: null }],
      }),
    method: 'POST',
    path: '/recurring-journals',
    body: {
      name: 'Rent',
      description: 'Rent',
      frequency: 'monthly',
      start_date: '2026-01-01',
      lines: [{ account_id: 'a1', debit_amount: 10, credit_amount: null }],
    },
  },
  {
    name: 'setRecurringJournalStatus',
    call: (s) => s.setRecurringJournalStatus('r1', 'paused'),
    method: 'POST',
    path: '/recurring-journals/r1/status',
    body: { status: 'paused' },
  },
  {
    name: 'runRecurringJournal',
    call: (s) => s.runRecurringJournal('r1', '2026-02-01'),
    method: 'POST',
    path: '/recurring-journals/r1/run',
    body: { as_of: '2026-02-01' },
  },
  {
    name: 'runScheduledJournals',
    call: (s) => s.runScheduledJournals(),
    method: 'POST',
    path: '/scheduled-journals/run',
    body: { as_of: null },
  },
  {
    name: 'getAccruals',
    call: (s) => s.getAccruals({ accrual_type: 'prepaid_expense', cutoff_date: '2026-12-31' }),
    method: 'GET',
    path: '/accruals',
    params: { accrual_type: 'prepaid_expense', cutoff_date: '2026-12-31' },
  },
  { name: 'getAccrual', call: (s) => s.getAccrual('c1'), method: 'GET', path: '/accruals/c1' },
  {
    name: 'createAccrual',
    call: (s) =>
      s.createAccrual({
        accrual_type: 'prepaid_expense',
        description: 'Insurance',
        total_amount: 1200,
        coverage_start: '2026-07-01',
        coverage_end: '2027-06-30',
        cutoff_date: '2026-12-31',
        income_statement_account_id: 'a1',
        balance_sheet_account_id: 'a2',
      }),
    method: 'POST',
    path: '/accruals',
    body: {
      accrual_type: 'prepaid_expense',
      description: 'Insurance',
      total_amount: 1200,
      coverage_start: '2026-07-01',
      coverage_end: '2027-06-30',
      cutoff_date: '2026-12-31',
      income_statement_account_id: 'a1',
      balance_sheet_account_id: 'a2',
    },
  },
  { name: 'getCloseChecklist', call: (s) => s.getCloseChecklist('p1'), method: 'GET', path: '/fiscal-periods/p1/close-checklist' },
  {
    name: 'addCloseTask',
    call: (s) => s.addCloseTask('p1', { title: 'Bank rec', is_blocking: true }),
    method: 'POST',
    path: '/fiscal-periods/p1/close-tasks',
    body: { title: 'Bank rec', is_blocking: true },
  },
  {
    name: 'setCloseTaskStatus',
    call: (s) => s.setCloseTaskStatus('p1', 't1', 'done', 'ok'),
    method: 'POST',
    path: '/fiscal-periods/p1/close-tasks/t1/status',
    body: { status: 'done', note: 'ok' },
  },
  { name: 'getFiscalYears', call: (s) => s.getFiscalYears(), method: 'GET', path: '/fiscal-years' },
  { name: 'getFiscalYear', call: (s) => s.getFiscalYear('y1'), method: 'GET', path: '/fiscal-years/y1' },
  {
    name: 'createFiscalYear',
    call: (s) => s.createFiscalYear({ year_code: '2027', start_date: '2027-01-01', end_date: '2027-12-31' }),
    method: 'POST',
    path: '/fiscal-years',
    body: { year_code: '2027', start_date: '2027-01-01', end_date: '2027-12-31' },
  },
  { name: 'closeFiscalYear', call: (s) => s.closeFiscalYear('y1'), method: 'POST', path: '/fiscal-years/y1/close', body: {} },
  {
    name: 'carryForwardFiscalYear',
    call: (s) => s.carryForwardFiscalYear('y1'),
    method: 'POST',
    path: '/fiscal-years/y1/carry-forward',
    body: {},
  },
  {
    name: 'getFxRevaluations',
    call: (s) => s.getFxRevaluations({ revaluation_date: '2026-12-31' }),
    method: 'GET',
    path: '/fx-revaluations',
    params: { revaluation_date: '2026-12-31' },
  },
  {
    name: 'runFxRevaluation',
    call: (s) => s.runFxRevaluation({ revaluation_date: '2026-12-31', currency: 'USD' }),
    method: 'POST',
    path: '/fx-revaluations',
    body: { revaluation_date: '2026-12-31', currency: 'USD' },
  },
  { name: 'getCostCenters', call: (s) => s.getCostCenters(), method: 'GET', path: '/cost-centers' },
  {
    name: 'createCostCenter',
    call: (s) => s.createCostCenter({ code: 'CC1', name: 'Sales' }),
    method: 'POST',
    path: '/cost-centers',
    body: { code: 'CC1', name: 'Sales' },
  },
  {
    name: 'updateCostCenter',
    call: (s) => s.updateCostCenter('c1', { code: 'CC1', name: 'Sales', is_active: false }),
    method: 'PUT',
    path: '/cost-centers/c1',
    body: { code: 'CC1', name: 'Sales', is_active: false },
  },
  { name: 'getProfitCenters', call: (s) => s.getProfitCenters(), method: 'GET', path: '/profit-centers' },
  {
    name: 'createProfitCenter',
    call: (s) => s.createProfitCenter({ code: 'PC1', name: 'North' }),
    method: 'POST',
    path: '/profit-centers',
    body: { code: 'PC1', name: 'North' },
  },
  {
    name: 'updateProfitCenter',
    call: (s) => s.updateProfitCenter('c1', { code: 'PC1', name: 'North' }),
    method: 'PUT',
    path: '/profit-centers/c1',
    body: { code: 'PC1', name: 'North' },
  },
  {
    name: 'getTrialBalanceReport',
    call: (s) => s.getTrialBalanceReport({ ...range, cost_center_id: 'c1' }),
    method: 'GET',
    path: '/reports/trial-balance',
    params: { ...range, cost_center_id: 'c1' },
  },
  {
    name: 'getAccountLedger',
    call: (s) => s.getAccountLedger({ account_id: 'a1', ...range, page: 2 }),
    method: 'GET',
    path: '/reports/account-ledger',
    params: { account_id: 'a1', ...range, page: '2' },
  },
  {
    name: 'getBalanceSheetReport',
    call: (s) => s.getBalanceSheetReport({ as_of: '2026-12-31', compare_as_of: '2025-12-31' }),
    method: 'GET',
    path: '/reports/balance-sheet',
    params: { as_of: '2026-12-31', compare_as_of: '2025-12-31' },
  },
  {
    name: 'getIncomeStatementReport',
    call: (s) => s.getIncomeStatementReport({ ...range, compare_from: '2025-01-01', compare_to: '2025-12-31' }),
    method: 'GET',
    path: '/reports/income-statement',
    params: { ...range, compare_from: '2025-01-01', compare_to: '2025-12-31' },
  },
  {
    name: 'getDimensionReport',
    call: (s) => s.getDimensionReport({ dimension: 'project', ...range }),
    method: 'GET',
    path: '/reports/dimensions',
    params: { dimension: 'project', ...range },
  },
  {
    name: 'exportAuditTrail',
    call: (s) => s.exportAuditTrail({ ...range, format: 'csv' }),
    method: 'GET',
    path: '/audit-trail/export',
    params: { ...range, format: 'csv' },
  },
  {
    name: 'exportJournalBook',
    call: (s) => s.exportJournalBook({ fiscal_year_id: 'y1' }),
    method: 'GET',
    path: '/journal-book/export',
    params: { fiscal_year_id: 'y1' },
  },
  {
    name: 'getVatRegister',
    call: (s) => s.getVatRegister('sales', range),
    method: 'GET',
    path: '/vat-registers/sales',
    params: { ...range, format: 'json' },
  },
  { name: 'getBudgets', call: (s) => s.getBudgets({ fiscal_year_id: 'y1' }), method: 'GET', path: '/budgets', params: { fiscal_year_id: 'y1' } },
  { name: 'getBudget', call: (s) => s.getBudget('b1'), method: 'GET', path: '/budgets/b1' },
  {
    name: 'createBudget',
    call: (s) => s.createBudget({ fiscal_year_id: 'y1', name: 'Budget 2027' }),
    method: 'POST',
    path: '/budgets',
    body: { fiscal_year_id: 'y1', name: 'Budget 2027' },
  },
  {
    name: 'replaceBudgetLines',
    call: (s) => s.replaceBudgetLines('b1', [{ account_id: 'a1', cost_center_id: null, period_number: 1, amount: 100 }]),
    method: 'PUT',
    path: '/budgets/b1/lines',
    body: { lines: [{ account_id: 'a1', cost_center_id: null, period_number: 1, amount: 100 }] },
  },
  { name: 'newBudgetVersion', call: (s) => s.newBudgetVersion('b1'), method: 'POST', path: '/budgets/b1/new-version', body: {} },
  { name: 'approveBudget', call: (s) => s.approveBudget('b1'), method: 'POST', path: '/budgets/b1/approve', body: {} },
  {
    name: 'getBudgetVariance',
    call: (s) => s.getBudgetVariance('b1', 'c1'),
    method: 'GET',
    path: '/budgets/b1/variance',
    params: { cost_center_id: 'c1' },
  },
  { name: 'getBudgetRollingForecast', call: (s) => s.getBudgetRollingForecast('b1'), method: 'GET', path: '/budgets/b1/rolling-forecast' },
];

describe('GeneralLedgerApiService', () => {
  let service: GeneralLedgerApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/general-ledger`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GeneralLedgerApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeneralLedgerApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(CASES)('$name sends $method $path', (c) => {
    c.call(service).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}${c.path}`);
    expect(req.request.method).toBe(c.method);
    for (const [key, value] of Object.entries(c.params ?? {})) {
      expect(req.request.params.get(key)).toBe(value);
    }
    if (c.body !== undefined) {
      expect(req.request.body).toEqual(c.body);
    }
    req.flush(c.name.startsWith('export') ? new Blob(['x']) : { success: true, message: 'ok', data: {} });
  });
});
