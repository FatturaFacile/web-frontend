import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { GeneralLedgerFiscalApiService } from '@core';

interface Case {
  name: string;
  call: (s: GeneralLedgerFiscalApiService) => Observable<unknown>;
  method: string;
  url: string;
  params?: Record<string, string>;
  body?: unknown;
  blob?: boolean;
}

const gl = `${environment.apiBaseUrl}/general-ledger`;
const acc = `${environment.apiBaseUrl}/accounting`;

const CASES: Case[] = [
  { name: 'getEnasarcoParameters', call: (s) => s.getEnasarcoParameters(), method: 'GET', url: `${gl}/enasarco/parameters` },
  {
    name: 'saveEnasarcoParameter',
    call: (s) =>
      s.saveEnasarcoParameter({ year: 2026, agent_type: 'single_mandate', rate_percent: 17, agent_share_percent: 50, annual_ceiling: 40000, source: 'fondazione' }),
    method: 'PUT',
    url: `${gl}/enasarco/parameters`,
    body: { year: 2026, agent_type: 'single_mandate', rate_percent: 17, agent_share_percent: 50, annual_ceiling: 40000, source: 'fondazione' },
  },
  { name: 'getEnasarcoSummary', call: (s) => s.getEnasarcoSummary({ year: 2026, quarter: 2 }), method: 'GET', url: `${gl}/enasarco/summary`, params: { year: '2026', quarter: '2' } },
  { name: 'getEnasarcoPrincipalStatement', call: (s) => s.getEnasarcoPrincipalStatement({ year: 2026, quarter: 2 }), method: 'GET', url: `${gl}/enasarco/principal-statements`, params: { year: '2026', quarter: '2' } },
  {
    name: 'postEnasarcoPrincipalStatement',
    call: (s) => s.postEnasarcoPrincipalStatement({ year: 2026, quarter: 2, agent_type: 'multi_mandate' }),
    method: 'POST',
    url: `${gl}/enasarco/principal-statements`,
    body: { year: 2026, quarter: 2, agent_type: 'multi_mandate' },
  },
  { name: 'getPayrollSettings', call: (s) => s.getPayrollSettings(), method: 'GET', url: `${gl}/payroll-settings` },
  {
    name: 'updatePayrollSettings',
    call: (s) => s.updatePayrollSettings({ salary_expense_account_id: 'a1' }),
    method: 'PUT',
    url: `${gl}/payroll-settings`,
    body: { salary_expense_account_id: 'a1' },
  },
  { name: 'getPayrollPostings', call: (s) => s.getPayrollPostings('failed'), method: 'GET', url: `${gl}/payroll-postings`, params: { status: 'failed' } },
  { name: 'postPayrollRun', call: (s) => s.postPayrollRun('r1'), method: 'POST', url: `${gl}/payroll-postings/r1/post`, body: {} },
  { name: 'getVatSettings', call: (s) => s.getVatSettings(), method: 'GET', url: `${gl}/tax-settings` },
  { name: 'updateVatSettings', call: (s) => s.updateVatSettings({ periodicity: 'quarterly' }), method: 'PUT', url: `${gl}/tax-settings`, body: { periodicity: 'quarterly' } },
  { name: 'downloadLipe', call: (s) => s.downloadLipe('t1'), method: 'GET', url: `${gl}/tax-settlements/t1/lipe`, blob: true },
  { name: 'getVatSettlementF24', call: (s) => s.getVatSettlementF24('t1'), method: 'GET', url: `${gl}/tax-settlements/t1/f24` },
  { name: 'downloadMwstStatement', call: (s) => s.downloadMwstStatement('t1'), method: 'GET', url: `${gl}/tax-settlements/t1/statement`, blob: true },
  { name: 'getWithholdingSettlements', call: (s) => s.getWithholdingSettlements({ year: '2026' }), method: 'GET', url: `${gl}/withholding-settlements`, params: { year: '2026' } },
  { name: 'getWithholdingSettlement', call: (s) => s.getWithholdingSettlement('w1'), method: 'GET', url: `${gl}/withholding-settlements/w1` },
  {
    name: 'calculateWithholdingSettlement',
    call: (s) => s.calculateWithholdingSettlement({ year: 2026, month: 10 }),
    method: 'POST',
    url: `${gl}/withholding-settlements/calculate`,
    body: { year: 2026, month: 10 },
  },
  { name: 'getWithholdingF24', call: (s) => s.getWithholdingF24('w1'), method: 'GET', url: `${gl}/withholding-settlements/w1/f24` },
  {
    name: 'payWithholdingSettlement',
    call: (s) => s.payWithholdingSettlement('w1', { payment_date: '2026-11-16' }),
    method: 'POST',
    url: `${gl}/withholding-settlements/w1/pay`,
    body: { payment_date: '2026-11-16' },
  },
  { name: 'exportWithholdingCertifications', call: (s) => s.exportWithholdingCertifications(2026), method: 'GET', url: `${gl}/withholding-settlements/certification-export`, params: { year: '2026' }, blob: true },
  { name: 'getStatementSchemes', call: (s) => s.getStatementSchemes(), method: 'GET', url: `${gl}/statement-schemes` },
  {
    name: 'createStatementScheme',
    call: (s) => s.createStatementScheme({ name: 'CEE', statement_type: 'balance_sheet', rows: [{ code: 'A', label: 'Assets', row_type: 'heading' }] }),
    method: 'POST',
    url: `${gl}/statement-schemes`,
    body: { name: 'CEE', statement_type: 'balance_sheet', rows: [{ code: 'A', label: 'Assets', row_type: 'heading' }] },
  },
  { name: 'deleteStatementScheme', call: (s) => s.deleteStatementScheme('s1'), method: 'DELETE', url: `${gl}/statement-schemes/s1` },
  { name: 'getComparativeStatements', call: (s) => s.getComparativeStatements('y1'), method: 'GET', url: `${gl}/financial-statements/comparative`, params: { fiscal_year_id: 'y1' } },
  { name: 'getReclassifiedStatement', call: (s) => s.getReclassifiedStatement('s1', 'y1'), method: 'GET', url: `${gl}/financial-statements/reclassified`, params: { scheme_id: 's1', fiscal_year_id: 'y1' } },
  { name: 'getCashFlowStatement', call: (s) => s.getCashFlowStatement('y1'), method: 'GET', url: `${gl}/financial-statements/cash-flow-statement`, params: { fiscal_year_id: 'y1' } },
  { name: 'getFinancialRatios', call: (s) => s.getFinancialRatios('y1'), method: 'GET', url: `${gl}/financial-statements/ratios`, params: { fiscal_year_id: 'y1' } },
  { name: 'getPeriodBalanceSheet', call: (s) => s.getPeriodBalanceSheet('p1'), method: 'GET', url: `${gl}/financial-statements/balance-sheet`, params: { fiscal_period_id: 'p1' } },
  { name: 'getPeriodIncomeStatement', call: (s) => s.getPeriodIncomeStatement('p1'), method: 'GET', url: `${gl}/financial-statements/income-statement`, params: { fiscal_period_id: 'p1' } },
  { name: 'getPeriodCashFlow', call: (s) => s.getPeriodCashFlow('p1'), method: 'GET', url: `${gl}/financial-statements/cash-flow`, params: { fiscal_period_id: 'p1' } },
  { name: 'getLedgerReconciliations', call: (s) => s.getLedgerReconciliations(), method: 'GET', url: `${gl}/reconciliations` },
  { name: 'getLedgerReconciliation', call: (s) => s.getLedgerReconciliation('r1'), method: 'GET', url: `${gl}/reconciliations/r1` },
  {
    name: 'createLedgerReconciliation',
    call: (s) => s.createLedgerReconciliation({ reconciliation_type: 'subledger_ar', fiscal_period_id: 'p1' }),
    method: 'POST',
    url: `${gl}/reconciliations`,
    body: { reconciliation_type: 'subledger_ar', fiscal_period_id: 'p1' },
  },
  { name: 'getCustomerSubledger', call: (s) => s.getCustomerSubledger({ status: 'open' }), method: 'GET', url: `${gl}/subledgers/customers`, params: { status: 'open' } },
  { name: 'getSupplierSubledger', call: (s) => s.getSupplierSubledger({ supplier_id: 'su1' }), method: 'GET', url: `${gl}/subledgers/suppliers`, params: { supplier_id: 'su1' } },
  {
    name: 'getLedgerPreview',
    call: (s) => s.getLedgerPreview({ from_date: '2026-01-01', to_date: '2026-03-31', source: 'invoices' }),
    method: 'GET',
    url: `${acc}/general-ledger`,
    params: { from_date: '2026-01-01', to_date: '2026-03-31', source: 'invoices', format: 'json' },
  },
  {
    name: 'exportLedger',
    call: (s) => s.exportLedger({ from_date: '2026-01-01', to_date: '2026-03-31' }),
    method: 'GET',
    url: `${acc}/general-ledger/export`,
    params: { from_date: '2026-01-01', to_date: '2026-03-31', format: 'csv' },
    blob: true,
  },
  { name: 'getVendorAging', call: (s) => s.getVendorAging({ as_of_date: '2026-11-01' }), method: 'GET', url: `${acc}/vendor-aging`, params: { as_of_date: '2026-11-01' } },
];

describe('GeneralLedgerFiscalApiService', () => {
  let service: GeneralLedgerFiscalApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GeneralLedgerFiscalApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GeneralLedgerFiscalApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(CASES)('$name sends $method $url', (c) => {
    c.call(service).subscribe();
    const req = httpMock.expectOne((r) => r.url === c.url);
    expect(req.request.method).toBe(c.method);
    for (const [key, value] of Object.entries(c.params ?? {})) {
      expect(req.request.params.get(key)).toBe(value);
    }
    if (c.body !== undefined) {
      expect(req.request.body).toEqual(c.body);
    }
    req.flush(c.blob ? new Blob(['x']) : { data: {} });
  });
});
