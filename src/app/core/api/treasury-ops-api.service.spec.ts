import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { TreasuryOpsApiService } from '@core';

interface Case {
  name: string;
  call: (s: TreasuryOpsApiService) => Observable<unknown>;
  method: string;
  url: string;
  params?: Record<string, string>;
  body?: unknown;
  blob?: boolean;
}

const api = environment.apiBaseUrl;
const t = `${api}/treasury`;
const b = `${api}/banking`;

const CASES: Case[] = [
  { name: 'getBalances', call: (s) => s.getBalances('2026-11-01'), method: 'GET', url: `${t}/balances`, params: { date: '2026-11-01' } },
  {
    name: 'getBankAccountBalances',
    call: (s) => s.getBankAccountBalances('ba1', { from_date: '2026-01-01', to_date: '2026-01-31' }),
    method: 'GET',
    url: `${t}/bank-accounts/ba1/balances`,
    params: { from_date: '2026-01-01', to_date: '2026-01-31' },
  },
  {
    name: 'getMovements',
    call: (s) => s.getMovements({ movement_type: 'bank_fee', per_page: 20 }),
    method: 'GET',
    url: `${t}/movements`,
    params: { movement_type: 'bank_fee', per_page: '20' },
  },
  {
    name: 'transfer',
    call: (s) =>
      s.transfer({ from_bank_account_id: 'a', to_bank_account_id: 'b', amount: 10, transfer_date: '2026-11-01', idempotency_key: 'k1' }),
    method: 'POST',
    url: `${t}/transfers`,
    body: { from_bank_account_id: 'a', to_bank_account_id: 'b', amount: 10, transfer_date: '2026-11-01', idempotency_key: 'k1' },
  },
  {
    name: 'postBankCharge',
    call: (s) => s.postBankCharge('ba1', { movement_type: 'bank_fee', amount: 5, movement_date: '2026-11-01', idempotency_key: 'k2' }),
    method: 'POST',
    url: `${t}/bank-accounts/ba1/charges`,
    body: { movement_type: 'bank_fee', amount: 5, movement_date: '2026-11-01', idempotency_key: 'k2' },
  },
  { name: 'getCashRegisters', call: (s) => s.getCashRegisters(), method: 'GET', url: `${t}/cash-registers` },
  { name: 'getCashRegister', call: (s) => s.getCashRegister('c1'), method: 'GET', url: `${t}/cash-registers/c1` },
  {
    name: 'createCashRegister',
    call: (s) => s.createCashRegister({ code: 'C1', name: 'Shop', currency: 'EUR', gl_account_id: 'g1' }),
    method: 'POST',
    url: `${t}/cash-registers`,
    body: { code: 'C1', name: 'Shop', currency: 'EUR', gl_account_id: 'g1' },
  },
  { name: 'getCashRegisterMovements', call: (s) => s.getCashRegisterMovements('c1'), method: 'GET', url: `${t}/cash-registers/c1/movements` },
  {
    name: 'addCashRegisterMovement',
    call: (s) =>
      s.addCashRegisterMovement('c1', {
        movement_date: '2026-11-01',
        direction: 'in',
        amount: 20,
        counter_account_id: 'x',
        description: 'Sale',
        idempotency_key: 'k3',
      }),
    method: 'POST',
    url: `${t}/cash-registers/c1/movements`,
    body: { movement_date: '2026-11-01', direction: 'in', amount: 20, counter_account_id: 'x', description: 'Sale', idempotency_key: 'k3' },
  },
  {
    name: 'closeCashRegisterDay',
    call: (s) => s.closeCashRegisterDay('c1', { closing_date: '2026-11-01', counted_balance: 100 }),
    method: 'POST',
    url: `${t}/cash-registers/c1/close`,
    body: { closing_date: '2026-11-01', counted_balance: 100 },
  },
  { name: 'getCashRegisterClosings', call: (s) => s.getCashRegisterClosings('c1'), method: 'GET', url: `${t}/cash-registers/c1/closings` },
  {
    name: 'getPaymentProposals',
    call: (s) => s.getPaymentProposals('draft'),
    method: 'GET',
    url: `${t}/payment-proposals`,
    params: { status: 'draft' },
  },
  { name: 'getPaymentProposal', call: (s) => s.getPaymentProposal('p1'), method: 'GET', url: `${t}/payment-proposals/p1` },
  {
    name: 'createPaymentProposal',
    call: (s) =>
      s.createPaymentProposal({
        bank_account_id: 'ba1',
        execution_date: '2026-11-30',
        due_until: '2026-11-30',
        format: 'sepa_pain_001_it',
      }),
    method: 'POST',
    url: `${t}/payment-proposals`,
    body: { bank_account_id: 'ba1', execution_date: '2026-11-30', due_until: '2026-11-30', format: 'sepa_pain_001_it' },
  },
  { name: 'approvePaymentProposal', call: (s) => s.approvePaymentProposal('p1'), method: 'POST', url: `${t}/payment-proposals/p1/approve`, body: {} },
  {
    name: 'rejectPaymentProposal',
    call: (s) => s.rejectPaymentProposal('p1', 'no funds'),
    method: 'POST',
    url: `${t}/payment-proposals/p1/reject`,
    body: { reason: 'no funds' },
  },
  {
    name: 'confirmPaymentBatch',
    call: (s) => s.confirmPaymentBatch('pb1', { bank_reference: 'REF' }),
    method: 'POST',
    url: `${t}/payment-batches/pb1/confirm`,
    body: { bank_reference: 'REF' },
  },
  { name: 'applyPain002', call: (s) => s.applyPain002('pb1', '<xml/>'), method: 'POST', url: `${t}/payment-batches/pb1/pain002`, body: { xml: '<xml/>' } },
  { name: 'getReconciliationRules', call: (s) => s.getReconciliationRules(), method: 'GET', url: `${b}/reconciliation-rules` },
  {
    name: 'createReconciliationRule',
    call: (s) => s.createReconciliationRule({ name: 'Bank fees', category: 'bank_expense', ledger_account_code: '6100' }),
    method: 'POST',
    url: `${b}/reconciliation-rules`,
    body: { name: 'Bank fees', category: 'bank_expense', ledger_account_code: '6100' },
  },
  {
    name: 'updateReconciliationRule',
    call: (s) => s.updateReconciliationRule('r1', { name: 'Bank fees', category: 'bank_expense' }),
    method: 'PUT',
    url: `${b}/reconciliation-rules/r1`,
    body: { name: 'Bank fees', category: 'bank_expense' },
  },
  { name: 'deleteReconciliationRule', call: (s) => s.deleteReconciliationRule('r1'), method: 'DELETE', url: `${b}/reconciliation-rules/r1` },
  { name: 'getReconciliations', call: (s) => s.getReconciliations(), method: 'GET', url: `${t}/reconciliations` },
  {
    name: 'autoReconcileStatement',
    call: (s) => s.autoReconcileStatement('st1'),
    method: 'POST',
    url: `${t}/reconciliations/auto-reconcile`,
    body: { bank_statement_id: 'st1' },
  },
  {
    name: 'matchReconciliationLine',
    call: (s) => s.matchReconciliationLine('l1', { bank_reconciliation_id: 'r1', matched_entity_type: 'invoice', matched_entity_id: 'i1' }),
    method: 'POST',
    url: `${t}/reconciliations/lines/l1/match`,
    body: { bank_reconciliation_id: 'r1', matched_entity_type: 'invoice', matched_entity_id: 'i1' },
  },
  { name: 'approveReconciliation', call: (s) => s.approveReconciliation('r1'), method: 'POST', url: `${t}/reconciliations/r1/approve`, body: {} },
  { name: 'getFxExposure', call: (s) => s.getFxExposure({ as_of_date: '2026-11-01' }), method: 'GET', url: `${t}/fx/exposure`, params: { as_of_date: '2026-11-01' } },
  {
    name: 'revalueBankAccounts',
    call: (s) => s.revalueBankAccounts({ period_end_date: '2026-12-31', currency: 'USD' }),
    method: 'POST',
    url: `${t}/fx/revalue`,
    body: { period_end_date: '2026-12-31', currency: 'USD' },
  },
  {
    name: 'getLiquidityForecast',
    call: (s) => s.getLiquidityForecast({ horizon_days: 60, currency: 'EUR' }, ['base', 'stress']),
    method: 'GET',
    url: `${t}/liquidity/forecast`,
    params: { horizon_days: '60', currency: 'EUR' },
  },
  { name: 'getForecastScenarios', call: (s) => s.getForecastScenarios(), method: 'GET', url: `${t}/forecast-scenarios` },
  {
    name: 'createForecastScenario',
    call: (s) => s.createForecastScenario({ code: 'stress', name: 'Stress', collection_delay_days: 15 }),
    method: 'POST',
    url: `${t}/forecast-scenarios`,
    body: { code: 'stress', name: 'Stress', collection_delay_days: 15 },
  },
  { name: 'getRecurringItems', call: (s) => s.getRecurringItems(), method: 'GET', url: `${t}/recurring-items` },
  {
    name: 'createRecurringItem',
    call: (s) =>
      s.createRecurringItem({ name: 'Rent', direction: 'outflow', amount: 900, currency: 'EUR', frequency: 'monthly', next_date: '2026-12-01' }),
    method: 'POST',
    url: `${t}/recurring-items`,
    body: { name: 'Rent', direction: 'outflow', amount: 900, currency: 'EUR', frequency: 'monthly', next_date: '2026-12-01' },
  },
  { name: 'deleteRecurringItem', call: (s) => s.deleteRecurringItem('ri1'), method: 'DELETE', url: `${t}/recurring-items/ri1` },
  { name: 'evaluateForecastDeficits', call: (s) => s.evaluateForecastDeficits('f1'), method: 'GET', url: `${t}/cash-forecasts/f1/evaluate-deficits` },
  { name: 'getKpis', call: (s) => s.getKpis({ period_days: 90, currency: 'EUR' }), method: 'GET', url: `${t}/kpis`, params: { period_days: '90', currency: 'EUR' } },
  { name: 'getCashPosition', call: (s) => s.getCashPosition(), method: 'GET', url: `${t}/positions/cash` },
  { name: 'getIntradayPosition', call: (s) => s.getIntradayPosition({ currency: 'EUR' }), method: 'GET', url: `${t}/positions/intraday`, params: { currency: 'EUR' } },
  { name: 'getLiquidityBuffer', call: (s) => s.getLiquidityBuffer(), method: 'GET', url: `${t}/positions/buffer` },
  { name: 'getWorkingCapital', call: (s) => s.getWorkingCapital({ metric_date: '2026-11-01' }), method: 'GET', url: `${t}/liquidity/working-capital`, params: { metric_date: '2026-11-01' } },
  { name: 'sweepCashPool', call: (s) => s.sweepCashPool('pool1'), method: 'POST', url: `${t}/liquidity/pools/pool1/sweep`, body: {} },
  {
    name: 'intercompanyTransfer',
    call: (s) => s.intercompanyTransfer({ source_bank_account_id: 'a', destination_bank_account_id: 'b', amount: 50 }),
    method: 'POST',
    url: `${t}/liquidity/intercompany-transfer`,
    body: { source_bank_account_id: 'a', destination_bank_account_id: 'b', amount: 50 },
  },
  { name: 'checkIban', call: (s) => s.checkIban('IT60X0542811101000000123456'), method: 'POST', url: `${t}/iban/check`, body: { iban: 'IT60X0542811101000000123456' } },
  {
    name: 'importStatementLines',
    call: (s) => s.importStatementLines({ bank_account_id: 'ba1', lines: [] }),
    method: 'POST',
    url: `${t}/statements/import`,
    body: { bank_account_id: 'ba1', lines: [] },
  },
  { name: 'createOpenBankingConsent', call: (s) => s.createOpenBankingConsent('IT60'), method: 'POST', url: `${t}/open-banking/consents`, body: { iban: 'IT60' } },
  { name: 'getOpenBankingConsentAccount', call: (s) => s.getOpenBankingConsentAccount('cn1'), method: 'GET', url: `${t}/open-banking/consents/cn1/account` },
  {
    name: 'createOpenBankingPayment',
    call: (s) => s.createOpenBankingPayment({ consent_id: 'cn1', creditor_iban: 'IT60', creditor_name: 'ACME', amount: 10, currency: 'EUR' }),
    method: 'POST',
    url: `${t}/open-banking/payments`,
    body: { consent_id: 'cn1', creditor_iban: 'IT60', creditor_name: 'ACME', amount: 10, currency: 'EUR' },
  },
  { name: 'getOpenBankingPayment', call: (s) => s.getOpenBankingPayment('op1'), method: 'GET', url: `${t}/open-banking/payments/op1` },
  { name: 'getRibaBatches', call: (s) => s.getRibaBatches({ status: 'exported' }), method: 'GET', url: `${t}/riba/batches`, params: { status: 'exported' } },
  { name: 'getRibaBatch', call: (s) => s.getRibaBatch('rb1'), method: 'GET', url: `${t}/riba/batches/rb1` },
  {
    name: 'createRibaBatch',
    call: (s) => s.createRibaBatch({ bank_account_id: 'ba1', sia_code: 'AB123', receipts: [{ invoice_id: 'i1', due_date: '2026-12-31' }] }),
    method: 'POST',
    url: `${t}/riba/batches`,
    body: { bank_account_id: 'ba1', sia_code: 'AB123', receipts: [{ invoice_id: 'i1', due_date: '2026-12-31' }] },
  },
  { name: 'exportRibaBatch', call: (s) => s.exportRibaBatch('rb1'), method: 'POST', url: `${t}/riba/batches/rb1/export`, body: {} },
  { name: 'downloadRibaBatchFile', call: (s) => s.downloadRibaBatchFile('rb1'), method: 'GET', url: `${t}/riba/batches/rb1/file`, blob: true },
  { name: 'markRibaReceiptPaid', call: (s) => s.markRibaReceiptPaid('rc1', '2026-12-31'), method: 'POST', url: `${t}/riba/receipts/rc1/paid`, body: { paid_at: '2026-12-31' } },
  {
    name: 'markRibaReceiptUnpaid',
    call: (s) => s.markRibaReceiptUnpaid('rc1', { reason: 'insoluto', unpaid_at: '2026-12-31', fee: 5 }),
    method: 'POST',
    url: `${t}/riba/receipts/rc1/unpaid`,
    body: { reason: 'insoluto', unpaid_at: '2026-12-31', fee: 5 },
  },
  { name: 'getRibaPortfolio', call: (s) => s.getRibaPortfolio({ due_from: '2026-12-01' }), method: 'GET', url: `${t}/riba/portfolio`, params: { due_from: '2026-12-01' } },
  { name: 'getCollections', call: (s) => s.getCollections({ status: 'open' }), method: 'GET', url: `${t}/collections`, params: { status: 'open' } },
  { name: 'getCollectionsAging', call: (s) => s.getCollectionsAging(), method: 'GET', url: `${t}/collections/aging` },
  { name: 'getDunningReadiness', call: (s) => s.getDunningReadiness(), method: 'GET', url: `${t}/collections/dunning-readiness` },
  {
    name: 'recordCollection',
    call: (s) => s.recordCollection('co1', { amount: 100, collection_date: '2026-11-01' }),
    method: 'POST',
    url: `${t}/collections/co1/record`,
    body: { amount: 100, collection_date: '2026-11-01' },
  },
];

describe('TreasuryOpsApiService', () => {
  let service: TreasuryOpsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TreasuryOpsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TreasuryOpsApiService);
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
    req.flush(c.blob ? new Blob(['x']) : { success: true, message: 'ok', data: {} });
  });

  it('sends the scenario codes as scenarios[] query parameters', () => {
    service.getLiquidityForecast({ horizon_days: 30 }, ['base', 'stress']).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${t}/liquidity/forecast`);
    expect(req.request.params.getAll('scenarios[]')).toEqual(['base', 'stress']);
    req.flush({ success: true, message: 'ok', data: {} });
  });
});
