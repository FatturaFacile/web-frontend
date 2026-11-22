import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { GeneralLedgerApiService, GeneralLedgerPrimaNotaApiService } from '@core';

interface Case {
  name: string;
  call: (s: GeneralLedgerPrimaNotaApiService) => Observable<unknown>;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

const CASES: Case[] = [
  {
    name: 'getTemplates',
    call: (s) => s.getTemplates(),
    method: 'GET',
    path: '/accounting-templates',
  },
  {
    name: 'getTemplates by category',
    call: (s) => s.getTemplates('expense'),
    method: 'GET',
    path: '/accounting-templates',
    params: { category: 'expense' },
  },
  {
    name: 'getTemplate',
    call: (s) => s.getTemplate('t1'),
    method: 'GET',
    path: '/accounting-templates/t1',
  },
  {
    name: 'deleteTemplate',
    call: (s) => s.deleteTemplate('t1'),
    method: 'DELETE',
    path: '/accounting-templates/t1',
  },
  {
    name: 'previewTemplate',
    call: (s) =>
      s.previewTemplate('t1', { amount: '100', tax_rate: '8.1', accounts: { expense: '6000' } }),
    method: 'POST',
    path: '/accounting-templates/t1/preview',
    body: { amount: '100', tax_rate: '8.1', accounts: { expense: '6000' } },
  },
  {
    name: 'postTemplate',
    call: (s) =>
      s.postTemplate('t1', { amount: '100', posting_date: '2026-06-15', post_to_ledgers: ['02'] }),
    method: 'POST',
    path: '/accounting-templates/t1/post',
    body: { amount: '100', posting_date: '2026-06-15', post_to_ledgers: ['02'] },
  },
  {
    name: 'createJournal',
    call: (s) =>
      s.createJournal({
        posting_date: '2026-04-10',
        description: 'Adjustment',
        ledger_type: 'statutory',
        post_to_ledgers: ['02', '03'],
        status: 'posted',
        lines: [{ account_id: 'a1', debit_amount: 120, credit_amount: 0 }],
      }),
    method: 'POST',
    path: '/journals',
    body: {
      posting_date: '2026-04-10',
      description: 'Adjustment',
      ledger_type: 'statutory',
      post_to_ledgers: ['02', '03'],
      status: 'posted',
      lines: [{ account_id: 'a1', debit_amount: 120, credit_amount: 0 }],
    },
  },
  {
    name: 'getClosingWorkflow',
    call: (s) => s.getClosingWorkflow('y1', '02'),
    method: 'GET',
    path: '/fiscal-years/y1/closing-workflow',
    params: { ledger: '02' },
  },
  {
    name: 'runClosingStage',
    call: (s) => s.runClosingStage('y1', 3, '03'),
    method: 'POST',
    path: '/fiscal-years/y1/closing-workflow/stages/3',
    body: { ledger: '03' },
  },
];

describe('GeneralLedgerPrimaNotaApiService', () => {
  let service: GeneralLedgerPrimaNotaApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/general-ledger`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GeneralLedgerPrimaNotaApiService,
        GeneralLedgerApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(GeneralLedgerPrimaNotaApiService);
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
    req.flush({ success: true, message: 'ok', data: {} });
  });

  it('sends the ledger book and the layout to the trial balance and the reversal date to the storno', () => {
    const glApi = TestBed.inject(GeneralLedgerApiService);
    glApi
      .getTrialBalanceReport({
        from: '2026-01-01',
        to: '2026-12-31',
        ledger: '02',
        columns: 2,
        profit_center_id: 'd1',
      })
      .subscribe();
    const tb = httpMock.expectOne((r) => r.url === `${base}/reports/trial-balance`);
    expect(tb.request.params.get('ledger')).toBe('02');
    expect(tb.request.params.get('columns')).toBe('2');
    expect(tb.request.params.get('profit_center_id')).toBe('d1');
    tb.flush({ success: true, message: '', data: {} });

    glApi
      .reverseJournalEntry('j1', { reversal_date: '2026-05-20', reason: 'Wrong account' })
      .subscribe();
    const reverse = httpMock.expectOne(`${base}/journals/j1/reverse`);
    expect(reverse.request.body).toEqual({ reversal_date: '2026-05-20', reason: 'Wrong account' });
    reverse.flush({ success: true, message: '', data: {} });
  });
});
