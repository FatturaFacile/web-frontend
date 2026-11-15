import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { GeneralLedgerConsolidationApiService } from '@core';

interface Case {
  name: string;
  call: (s: GeneralLedgerConsolidationApiService) => Observable<unknown>;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

const base = `${environment.apiBaseUrl}/general-ledger/consolidation`;

const CASES: Case[] = [
  { name: 'getGroups', call: (s) => s.getGroups(), method: 'GET', path: '/groups' },
  { name: 'getGroup', call: (s) => s.getGroup('g1'), method: 'GET', path: '/groups/g1' },
  {
    name: 'createGroup',
    call: (s) => s.createGroup({ name: 'Group', group_currency: 'EUR', goodwill_method: 'straight_line', goodwill_amortisation_years: 10 }),
    method: 'POST',
    path: '/groups',
    body: { name: 'Group', group_currency: 'EUR', goodwill_method: 'straight_line', goodwill_amortisation_years: 10 },
  },
  { name: 'updateGroup', call: (s) => s.updateGroup('g1', { is_active: false }), method: 'PUT', path: '/groups/g1', body: { is_active: false } },
  { name: 'deleteGroup', call: (s) => s.deleteGroup('g1'), method: 'DELETE', path: '/groups/g1' },
  {
    name: 'addMember',
    call: (s) => s.addMember('g1', { member_tenant_id: 't1', ownership_percentage: 80, consolidation_method: 'full' }),
    method: 'POST',
    path: '/groups/g1/members',
    body: { member_tenant_id: 't1', ownership_percentage: 80, consolidation_method: 'full' },
  },
  {
    name: 'updateMember',
    call: (s) => s.updateMember('g1', 'm1', { ownership_percentage: 60, consolidation_method: 'proportional' }),
    method: 'PUT',
    path: '/groups/g1/members/m1',
    body: { ownership_percentage: 60, consolidation_method: 'proportional' },
  },
  { name: 'removeMember', call: (s) => s.removeMember('g1', 'm1'), method: 'DELETE', path: '/groups/g1/members/m1' },
  {
    name: 'createRelation',
    call: (s) => s.createRelation('g1', { entity_a_tenant_id: 'a', entity_b_tenant_id: 'b', tolerance_amount: 1 }),
    method: 'POST',
    path: '/groups/g1/relations',
    body: { entity_a_tenant_id: 'a', entity_b_tenant_id: 'b', tolerance_amount: 1 },
  },
  { name: 'deleteRelation', call: (s) => s.deleteRelation('r1'), method: 'DELETE', path: '/relations/r1' },
  {
    name: 'createRelationMapping',
    call: (s) => s.createRelationMapping('r1', { mapping_type: 'receivable_payable', account_a_id: 'x', account_b_id: 'y' }),
    method: 'POST',
    path: '/relations/r1/mappings',
    body: { mapping_type: 'receivable_payable', account_a_id: 'x', account_b_id: 'y' },
  },
  { name: 'deleteRelationMapping', call: (s) => s.deleteRelationMapping('p1'), method: 'DELETE', path: '/mappings/p1' },
  { name: 'getAccountMappings', call: (s) => s.getAccountMappings('g1'), method: 'GET', path: '/groups/g1/account-mappings' },
  {
    name: 'createAccountMapping',
    call: (s) => s.createAccountMapping('g1', { member_tenant_id: 't1', account_id: 'a1', group_account_code: '1000' }),
    method: 'POST',
    path: '/groups/g1/account-mappings',
    body: { member_tenant_id: 't1', account_id: 'a1', group_account_code: '1000' },
  },
  { name: 'deleteAccountMapping', call: (s) => s.deleteAccountMapping('p1'), method: 'DELETE', path: '/account-mappings/p1' },
  { name: 'getAcquisitions', call: (s) => s.getAcquisitions('g1'), method: 'GET', path: '/groups/g1/acquisitions' },
  {
    name: 'createAcquisition',
    call: (s) =>
      s.createAcquisition('g1', {
        member_tenant_id: 't1',
        acquisition_date: '2026-01-01',
        net_assets_at_acquisition: 1000,
        fair_value_adjustments: [{ account_code: '1200', account_type: 'asset', amount: 50, useful_life_years: 5 }],
      }),
    method: 'POST',
    path: '/groups/g1/acquisitions',
    body: {
      member_tenant_id: 't1',
      acquisition_date: '2026-01-01',
      net_assets_at_acquisition: 1000,
      fair_value_adjustments: [{ account_code: '1200', account_type: 'asset', amount: 50, useful_life_years: 5 }],
    },
  },
  {
    name: 'createGoodwillImpairment',
    call: (s) => s.createGoodwillImpairment('q1', { fiscal_year: 2026, amount: 10 }),
    method: 'POST',
    path: '/acquisitions/q1/impairments',
    body: { fiscal_year: 2026, amount: 10 },
  },
  { name: 'deleteAcquisition', call: (s) => s.deleteAcquisition('q1'), method: 'DELETE', path: '/acquisitions/q1' },
  { name: 'getIntragroupTransactions', call: (s) => s.getIntragroupTransactions('g1'), method: 'GET', path: '/groups/g1/intragroup-transactions' },
  {
    name: 'createIntragroupTransaction',
    call: (s) =>
      s.createIntragroupTransaction('g1', {
        seller_tenant_id: 's',
        buyer_tenant_id: 'b',
        asset_type: 'inventory',
        transaction_date: '2026-02-01',
        margin_amount: 20,
        asset_account_id: 'a',
        profit_account_id: 'p',
      }),
    method: 'POST',
    path: '/groups/g1/intragroup-transactions',
    body: {
      seller_tenant_id: 's',
      buyer_tenant_id: 'b',
      asset_type: 'inventory',
      transaction_date: '2026-02-01',
      margin_amount: 20,
      asset_account_id: 'a',
      profit_account_id: 'p',
    },
  },
  { name: 'deleteIntragroupTransaction', call: (s) => s.deleteIntragroupTransaction('x1'), method: 'DELETE', path: '/intragroup-transactions/x1' },
  { name: 'getIntragroupDividends', call: (s) => s.getIntragroupDividends('g1'), method: 'GET', path: '/groups/g1/intragroup-dividends' },
  {
    name: 'createIntragroupDividend',
    call: (s) =>
      s.createIntragroupDividend('g1', {
        payer_tenant_id: 'p',
        receiver_tenant_id: 'r',
        dividend_date: '2026-03-01',
        amount: 100,
        income_account_id: 'i',
        equity_account_id: 'e',
      }),
    method: 'POST',
    path: '/groups/g1/intragroup-dividends',
    body: {
      payer_tenant_id: 'p',
      receiver_tenant_id: 'r',
      dividend_date: '2026-03-01',
      amount: 100,
      income_account_id: 'i',
      equity_account_id: 'e',
    },
  },
  { name: 'deleteIntragroupDividend', call: (s) => s.deleteIntragroupDividend('d1'), method: 'DELETE', path: '/intragroup-dividends/d1' },
  {
    name: 'getIntercompanyReconciliation',
    call: (s) => s.getIntercompanyReconciliation('g1', 'per1'),
    method: 'GET',
    path: '/groups/g1/intercompany-reconciliation',
    params: { fiscal_period_id: 'per1' },
  },
  { name: 'getRuns', call: (s) => s.getRuns('g1', 'per1'), method: 'GET', path: '/groups/g1/runs', params: { fiscal_period_id: 'per1' } },
  { name: 'runConsolidation', call: (s) => s.runConsolidation('g1', 'per1'), method: 'POST', path: '/groups/g1/runs', body: { fiscal_period_id: 'per1' } },
  { name: 'getRun', call: (s) => s.getRun('u1'), method: 'GET', path: '/runs/u1' },
  { name: 'verifyRun', call: (s) => s.verifyRun('u1'), method: 'GET', path: '/runs/u1/verify' },
  { name: 'lockRun', call: (s) => s.lockRun('u1'), method: 'POST', path: '/runs/u1/lock', body: {} },
  { name: 'deleteRun', call: (s) => s.deleteRun('u1'), method: 'DELETE', path: '/runs/u1' },
  { name: 'getRunTrialBalance', call: (s) => s.getRunTrialBalance('u1'), method: 'GET', path: '/runs/u1/trial-balance' },
  { name: 'getRunBalanceSheet', call: (s) => s.getRunBalanceSheet('u1'), method: 'GET', path: '/runs/u1/balance-sheet' },
  { name: 'getRunIncomeStatement', call: (s) => s.getRunIncomeStatement('u1'), method: 'GET', path: '/runs/u1/income-statement' },
  { name: 'getRunGoodwillSchedule', call: (s) => s.getRunGoodwillSchedule('u1'), method: 'GET', path: '/runs/u1/goodwill-schedule' },
  {
    name: 'getRunReclassified',
    call: (s) => s.getRunReclassified('u1', 'sch1'),
    method: 'GET',
    path: '/runs/u1/reclassified',
    params: { scheme_id: 'sch1' },
  },
];

describe('GeneralLedgerConsolidationApiService', () => {
  let service: GeneralLedgerConsolidationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [GeneralLedgerConsolidationApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(GeneralLedgerConsolidationApiService);
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
    req.flush({ data: {} });
  });

  it('getRuns without a period sends no filter', () => {
    service.getRuns('g1').subscribe();
    const req = httpMock.expectOne(`${base}/groups/g1/runs`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ data: [] });
  });

  it('getMemberAccounts reads the chart of the member entity through its tenant header', () => {
    service.getMemberAccounts('tenant-7').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiBaseUrl}/general-ledger/accounts`);
    expect(req.request.headers.get('X-Tenant-Id')).toBe('tenant-7');
    expect(req.request.params.get('per_page')).toBe('500');
    req.flush({ data: [] });
  });
});
