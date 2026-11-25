import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { IntercompanyApiService } from '@core';

interface Case {
  name: string;
  call: (s: IntercompanyApiService) => Observable<unknown>;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

const base = `${environment.apiBaseUrl}/intercompany`;

const CASES: Case[] = [
  { name: 'getLookups', call: (s) => s.getLookups(), method: 'GET', path: '/lookups' },
  {
    name: 'getSettings',
    call: (s) => s.getSettings('g1'),
    method: 'GET',
    path: '/groups/g1/settings',
  },
  {
    name: 'saveSettings',
    call: (s) =>
      s.saveSettings('g1', {
        mirror_mode: 'draft',
        auto_mirror: true,
        sync_payments: true,
        netting_enabled: false,
        amount_tolerance: '0.5000',
        date_tolerance_days: 3,
        default_standard: 'fer30',
      }),
    method: 'PUT',
    path: '/groups/g1/settings',
    body: {
      mirror_mode: 'draft',
      auto_mirror: true,
      sync_payments: true,
      netting_enabled: false,
      amount_tolerance: '0.5000',
      date_tolerance_days: 3,
      default_standard: 'fer30',
    },
  },
  {
    name: 'getPartyLinks',
    call: (s) => s.getPartyLinks('g1'),
    method: 'GET',
    path: '/groups/g1/party-links',
  },
  {
    name: 'createPartyLink',
    call: (s) =>
      s.createPartyLink('g1', {
        entity_tenant_id: 'a',
        counterparty_tenant_id: 'b',
        contact_id: 'c',
        role: 'customer',
      }),
    method: 'POST',
    path: '/groups/g1/party-links',
    body: { entity_tenant_id: 'a', counterparty_tenant_id: 'b', contact_id: 'c', role: 'customer' },
  },
  {
    name: 'deletePartyLink',
    call: (s) => s.deletePartyLink('p1'),
    method: 'DELETE',
    path: '/party-links/p1',
  },
  {
    name: 'getPeriodRates',
    call: (s) => s.getPeriodRates('g1', { currency: 'EUR', rate_type: 'closing' }),
    method: 'GET',
    path: '/groups/g1/period-rates',
    params: { currency: 'EUR', rate_type: 'closing' },
  },
  {
    name: 'savePeriodRate',
    call: (s) =>
      s.savePeriodRate('g1', {
        currency: 'EUR',
        rate_type: 'average',
        period_end: '2026-12-31',
        rate: '0.9400',
      }),
    method: 'POST',
    path: '/groups/g1/period-rates',
    body: { currency: 'EUR', rate_type: 'average', period_end: '2026-12-31', rate: '0.9400' },
  },
  {
    name: 'deletePeriodRate',
    call: (s) => s.deletePeriodRate('r1'),
    method: 'DELETE',
    path: '/period-rates/r1',
  },
  {
    name: 'getTransactions',
    call: (s) => s.getTransactions('g1', { status: 'drafted', payment_status: '', page: 2 }),
    method: 'GET',
    path: '/groups/g1/transactions',
    params: { status: 'drafted', page: '2' },
  },
  {
    name: 'getTransaction',
    call: (s) => s.getTransaction('t1'),
    method: 'GET',
    path: '/transactions/t1',
  },
  {
    name: 'scanTransactions',
    call: (s) => s.scanTransactions('g1', { from: '2026-01-01' }),
    method: 'POST',
    path: '/groups/g1/transactions/scan',
    body: { from: '2026-01-01' },
  },
  {
    name: 'mirrorTransaction',
    call: (s) => s.mirrorTransaction('t1', { mode: 'confirmed', expected_version: 2 }),
    method: 'POST',
    path: '/transactions/t1/mirror',
    body: { mode: 'confirmed', expected_version: 2 },
  },
  {
    name: 'confirmTransaction',
    call: (s) => s.confirmTransaction('t1', 3),
    method: 'POST',
    path: '/transactions/t1/confirm',
    body: { expected_version: 3 },
  },
  {
    name: 'reverseTransaction',
    call: (s) => s.reverseTransaction('t1', 'wrong entity', 3),
    method: 'POST',
    path: '/transactions/t1/reverse',
    body: { reason: 'wrong entity', expected_version: 3 },
  },
  {
    name: 'syncPayment',
    call: (s) => s.syncPayment('t1'),
    method: 'POST',
    path: '/transactions/t1/sync-payment',
    body: {},
  },
  {
    name: 'getNettingRuns',
    call: (s) => s.getNettingRuns('g1', 'draft'),
    method: 'GET',
    path: '/groups/g1/netting',
    params: { status: 'draft' },
  },
  {
    name: 'proposeNetting',
    call: (s) =>
      s.proposeNetting('g1', {
        entity_a_tenant_id: 'a',
        entity_b_tenant_id: 'b',
        as_of_date: '2026-12-31',
      }),
    method: 'POST',
    path: '/groups/g1/netting',
    body: { entity_a_tenant_id: 'a', entity_b_tenant_id: 'b', as_of_date: '2026-12-31' },
  },
  {
    name: 'confirmNetting',
    call: (s) => s.confirmNetting('n1', 1),
    method: 'POST',
    path: '/netting/n1/confirm',
    body: { expected_version: 1 },
  },
  {
    name: 'cancelNetting',
    call: (s) => s.cancelNetting('n1', 'no longer due'),
    method: 'POST',
    path: '/netting/n1/cancel',
    body: { reason: 'no longer due' },
  },
  {
    name: 'getBatches',
    call: (s) => s.getBatches('g1'),
    method: 'GET',
    path: '/groups/g1/reconciliation/batches',
  },
  {
    name: 'createBatch',
    call: (s) => s.createBatch('g1', '2026-12-31'),
    method: 'POST',
    path: '/groups/g1/reconciliation/batches',
    body: { as_of_date: '2026-12-31', auto_match: true },
  },
  {
    name: 'getBatch',
    call: (s) => s.getBatch('b1', { anomaly_type: 'fx', status: '' }),
    method: 'GET',
    path: '/reconciliation/batches/b1',
    params: { anomaly_type: 'fx' },
  },
  {
    name: 'getMatrix',
    call: (s) => s.getMatrix('g1', '2026-12-31'),
    method: 'GET',
    path: '/groups/g1/reconciliation/matrix',
    params: { as_of_date: '2026-12-31' },
  },
  {
    name: 'matchItem',
    call: (s) => s.matchItem('i1', 'd1'),
    method: 'POST',
    path: '/reconciliation/items/i1/match',
    body: { counterpart_document_id: 'd1' },
  },
  {
    name: 'unmatchItem',
    call: (s) => s.unmatchItem('i1'),
    method: 'POST',
    path: '/reconciliation/items/i1/unmatch',
    body: {},
  },
  {
    name: 'disputeItem',
    call: (s) => s.disputeItem('i1', 'wrong price'),
    method: 'POST',
    path: '/reconciliation/items/i1/dispute',
    body: { reason: 'wrong price' },
  },
  {
    name: 'writeOffItem',
    call: (s) => s.writeOffItem('i1', 'small'),
    method: 'POST',
    path: '/reconciliation/items/i1/write-off',
    body: { reason: 'small' },
  },
  {
    name: 'adjustItem',
    call: (s) => s.adjustItem('i1', 'rounding', '1.5000'),
    method: 'POST',
    path: '/reconciliation/items/i1/adjust',
    body: { reason: 'rounding', adjustment_amount: '1.5000' },
  },
  {
    name: 'getWorkflow',
    call: (s) => s.getWorkflow('r1'),
    method: 'GET',
    path: '/runs/r1/workflow',
  },
  {
    name: 'advanceRun',
    call: (s) => s.advanceRun('r1', 'review', 4),
    method: 'POST',
    path: '/runs/r1/workflow/advance',
    body: { to: 'review', expected_version: 4 },
  },
  {
    name: 'reopenRun',
    call: (s) => s.reopenRun('r1', 'a correction after the audit', 5),
    method: 'POST',
    path: '/runs/r1/reopen',
    body: { reason: 'a correction after the audit', expected_version: 5 },
  },
  {
    name: 'getScopeValidation',
    call: (s) => s.getScopeValidation('r1'),
    method: 'GET',
    path: '/runs/r1/scope-validation',
  },
  {
    name: 'getEliminationLedger',
    call: (s) => s.getEliminationLedger('r1', { type: 'unrealised_profit' }),
    method: 'GET',
    path: '/runs/r1/elimination-ledger',
    params: { type: 'unrealised_profit' },
  },
  {
    name: 'getNciSchedule',
    call: (s) => s.getNciSchedule('r1'),
    method: 'GET',
    path: '/runs/r1/nci-schedule',
  },
  {
    name: 'getShareholdings',
    call: (s) => s.getShareholdings('r1'),
    method: 'GET',
    path: '/runs/r1/shareholdings',
  },
  {
    name: 'getStatements',
    call: (s) => s.getStatements('r1', 'ifrs10'),
    method: 'GET',
    path: '/runs/r1/statements',
    params: { standard: 'ifrs10', statement: 'all' },
  },
  {
    name: 'getCashFlow',
    call: (s) => s.getCashFlow('r1', 'oic17'),
    method: 'GET',
    path: '/runs/r1/cash-flow',
    params: { standard: 'oic17' },
  },
  {
    name: 'getPackages',
    call: (s) => s.getPackages('r1'),
    method: 'GET',
    path: '/runs/r1/packages',
  },
  {
    name: 'createPackage',
    call: (s) => s.createPackage('r1', 'fer30'),
    method: 'POST',
    path: '/runs/r1/packages',
    body: { standard: 'fer30' },
  },
  { name: 'getPackage', call: (s) => s.getPackage('p1'), method: 'GET', path: '/packages/p1' },
];

describe('IntercompanyApiService', () => {
  let service: IntercompanyApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IntercompanyApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  for (const testCase of CASES) {
    it(`${testCase.name} calls ${testCase.method} ${testCase.path}`, () => {
      testCase.call(service).subscribe();

      const request = http.expectOne((candidate) => candidate.url === `${base}${testCase.path}`);
      expect(request.request.method).toBe(testCase.method);
      for (const [key, value] of Object.entries(testCase.params ?? {})) {
        expect(request.request.params.get(key)).toBe(value);
      }
      if (testCase.body !== undefined) {
        expect(request.request.body).toEqual(testCase.body);
      }
      request.flush({ success: true, message: 'ok', data: null });
    });
  }

  it('does not send empty filters', () => {
    service.getTransactions('g1', { status: '', payment_status: '' }).subscribe();

    const request = http.expectOne(
      (candidate) => candidate.url === `${base}/groups/g1/transactions`,
    );
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ success: true, message: 'ok', data: [] });
  });

  it('downloads a package as a blob in the chosen format', () => {
    let received: Blob | null = null;
    service.downloadPackage('p1', 'xlsx').subscribe((blob) => (received = blob));

    const request = http.expectOne((candidate) => candidate.url === `${base}/packages/p1/download`);
    expect(request.request.params.get('format')).toBe('xlsx');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['x']));
    expect(received).toBeInstanceOf(Blob);
  });
});
