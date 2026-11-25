import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DebtCollectionApiService } from './debt-collection-api.service';

describe('DebtCollectionApiService', () => {
  let service: DebtCollectionApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/debt-collection`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DebtCollectionApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DebtCollectionApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads the lookups and the dashboard', () => {
    service.getLookups().subscribe();
    httpTesting.expectOne(`${base}/lookups`).flush({ data: {} });
    service.getDashboard().subscribe();
    httpTesting.expectOne(`${base}/dashboard`).flush({ data: {} });
  });

  it('lists the proposals with the filters, dropping the empty ones', () => {
    service
      .listProposals({
        as_of: '2026-05-01',
        jurisdiction: 'CH',
        level: 2,
        include_excluded: 1,
        search: '',
      })
      .subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/proposals`);
    expect(request.request.params.get('as_of')).toBe('2026-05-01');
    expect(request.request.params.get('jurisdiction')).toBe('CH');
    expect(request.request.params.get('level')).toBe('2');
    expect(request.request.params.get('include_excluded')).toBe('1');
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ data: { items: [], groups: [] } });
  });

  it('posts the calculation and the notice generation', () => {
    service.calculate({ receivable_item_id: 'r-1', as_of: '2026-05-01' }).subscribe();
    const calc = httpTesting.expectOne(`${base}/calculate`);
    expect(calc.request.method).toBe('POST');
    expect(calc.request.body).toEqual({ receivable_item_id: 'r-1', as_of: '2026-05-01' });
    calc.flush({ data: {} });

    const payload = {
      groups: [
        { customer_id: 'c-1', currency: 'CHF', level: 1 as const, receivable_item_ids: ['r-1'] },
      ],
      as_of: '2026-05-01',
      channel: 'email' as const,
      post_charges: true,
      dispatch: false,
    };
    service.generate(payload).subscribe();
    const generate = httpTesting.expectOne(`${base}/proposals/generate`);
    expect(generate.request.body).toEqual(payload);
    generate.flush({ data: { notices: [], batch: null } });
  });

  it('works with notices: list, send, cancel, receipts and binary downloads', () => {
    service.listNotices({ status: 'sent', page: 2 }).subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/notices`);
    expect(list.request.params.get('status')).toBe('sent');
    expect(list.request.params.get('page')).toBe('2');
    list.flush({ data: [], meta: {} });

    service.sendNotice('n-1', 'pec').subscribe();
    expect(httpTesting.expectOne(`${base}/notices/n-1/send`).request.body).toEqual({
      channel: 'pec',
    });

    service.sendNotice('n-1').subscribe();
    const bare = httpTesting.expectOne(`${base}/notices/n-1/send`);
    expect(bare.request.body).toEqual({});
    bare.flush({ data: {} });

    service.cancelNotice('n-1').subscribe();
    expect(httpTesting.expectOne(`${base}/notices/n-1/cancel`).request.method).toBe('POST');

    service
      .registerReceipt('n-1', { kind: 'consegna', received_at: '2026-05-02T10:00:00Z' })
      .subscribe();
    expect(httpTesting.expectOne(`${base}/notices/n-1/pec-receipts`).request.body.kind).toBe(
      'consegna',
    );

    service.downloadNoticePdf('n-1').subscribe();
    expect(httpTesting.expectOne(`${base}/notices/n-1/pdf`).request.responseType).toBe('blob');
    service.exportNotice('n-1').subscribe();
    expect(httpTesting.expectOne(`${base}/notices/n-1/export`).request.responseType).toBe('blob');
  });

  it('manages batches', () => {
    service.listBatches().subscribe();
    httpTesting.expectOne(`${base}/batches`).flush({ data: [], meta: {} });
    service.createBatch(['n-1', 'n-2'], 'email').subscribe();
    expect(httpTesting.expectOne(`${base}/batches`).request.body).toEqual({
      notice_ids: ['n-1', 'n-2'],
      channel: 'email',
    });
    service.retryBatch('b-1').subscribe();
    expect(httpTesting.expectOne(`${base}/batches/b-1/retry`).request.method).toBe('POST');
    service.getBatch('b-1').subscribe();
    expect(httpTesting.expectOne(`${base}/batches/b-1`).request.method).toBe('GET');
  });

  it('maintains policies, interest rates, templates and enforcement offices', () => {
    service.listPolicies().subscribe();
    httpTesting.expectOne(`${base}/policies`);
    service.deletePolicy('p-1').subscribe();
    expect(httpTesting.expectOne(`${base}/policies/p-1`).request.method).toBe('DELETE');

    service.listInterestRates('IT').subscribe();
    expect(
      httpTesting
        .expectOne((req) => req.url === `${base}/interest-rates`)
        .request.params.get('jurisdiction'),
    ).toBe('IT');
    service.deleteInterestRate('i-1').subscribe();
    expect(httpTesting.expectOne(`${base}/interest-rates/i-1`).request.method).toBe('DELETE');

    service.listTemplates({ code: 'reminder_1', locale: 'de' }).subscribe();
    const templates = httpTesting.expectOne((req) => req.url === `${base}/templates`);
    expect(templates.request.params.get('locale')).toBe('de');
    service.updateTemplate('t-1', { subject: 's', body: 'b' }).subscribe();
    expect(httpTesting.expectOne(`${base}/templates/t-1`).request.method).toBe('PUT');

    service.deleteEnforcementOffice('o-1').subscribe();
    expect(httpTesting.expectOne(`${base}/enforcement-offices/o-1`).request.method).toBe('DELETE');
  });

  it('manages exclusions and payment plans', () => {
    service.listExclusions({ customer_id: 'c-1', active: 1 }).subscribe();
    const list = httpTesting.expectOne((req) => req.url === `${base}/exclusions`);
    expect(list.request.params.get('active')).toBe('1');
    service.releaseExclusion('e-1', 'settled').subscribe();
    expect(httpTesting.expectOne(`${base}/exclusions/e-1/release`).request.body).toEqual({
      note: 'settled',
    });
    service.transitionPaymentPlan('pp-1', 'complete').subscribe();
    expect(httpTesting.expectOne(`${base}/payment-plans/pp-1/complete`).request.method).toBe(
      'POST',
    );
    service.listPaymentPlans('c-1').subscribe();
    expect(
      httpTesting
        .expectOne((req) => req.url === `${base}/payment-plans`)
        .request.params.get('customer_id'),
    ).toBe('c-1');
  });

  it('works with dossiers, the messa in mora and the customer history', () => {
    service.createDossier({ customer_id: 'c-1', receivable_item_ids: ['r-1'] }).subscribe();
    expect(httpTesting.expectOne(`${base}/dossiers`).request.method).toBe('POST');
    service.downloadDossierPdf('d-1').subscribe();
    expect(httpTesting.expectOne(`${base}/dossiers/d-1/pdf`).request.responseType).toBe('blob');
    service.downloadDossierBundle('d-1').subscribe();
    expect(httpTesting.expectOne(`${base}/dossiers/d-1/bundle`).request.responseType).toBe('blob');
    service.submitDossier('d-1').subscribe();
    expect(httpTesting.expectOne(`${base}/dossiers/d-1/submit`).request.method).toBe('POST');
    service
      .createMessaInMora({ customer_id: 'c-1', receivable_item_ids: ['r-1'], send_pec: true })
      .subscribe();
    expect(httpTesting.expectOne(`${base}/messa-in-mora`).request.body.send_pec).toBe(true);
    service.getCustomerHistory('c-1').subscribe();
    expect(httpTesting.expectOne(`${base}/customers/c-1/history`).request.method).toBe('GET');
  });
});
