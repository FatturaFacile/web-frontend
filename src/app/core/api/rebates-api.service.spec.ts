import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RebateAgreementRequest } from '../models';
import { RebatesApiService } from './rebates-api.service';

describe('RebatesApiService', () => {
  let service: RebatesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [RebatesApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RebatesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the agreements with the filters as query parameters and skips the empty ones', () => {
    service.getAgreements({ direction: 'sales', status: undefined, search: 'rb', per_page: 100 }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/rebates/agreements') && r.params.get('direction') === 'sales' && r.params.get('search') === 'rb' && r.params.get('per_page') === '100' && !r.params.has('status'));
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('creates an agreement and updates its structure', () => {
    const payload: RebateAgreementRequest = {
      code: 'RB-1',
      name: 'Annual',
      direction: 'sales',
      contact_id: 'c-1',
      starts_on: '2027-01-01',
      ends_on: '2027-12-31',
      tiers: [{ threshold_amount: '10000', rate_percent: '2' }],
    };

    service.createAgreement(payload).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/rebates/agreements') && r.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.updateAgreement('ag-1', { name: 'Renamed' }).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/rebates/agreements/ag-1') && r.method === 'PUT');
    expect(update.request.body).toEqual({ name: 'Renamed' });
    update.flush({ data: {} });
  });

  it('activates, calculates, settles and closes through the action endpoints', () => {
    service.activateAgreement('ag-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/activate') && r.method === 'POST').flush({ data: {} });

    service.calculateAccrual('ag-1', { as_of: '2027-06-30' }).subscribe();
    const calculate = httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/calculate'));
    expect(calculate.request.body).toEqual({ as_of: '2027-06-30' });
    calculate.flush({ data: {} });

    service.settleAgreement('ag-1', { tax_rate: '22' }).subscribe();
    const settle = httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/settle'));
    expect(settle.request.body).toEqual({ tax_rate: '22' });
    settle.flush({ data: {} });

    service.closeAgreement('ag-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/close') && r.method === 'POST').flush({ data: {} });
  });

  it('reads accruals, settlements and the dashboard and manages promotions', () => {
    service.getAccruals('ag-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/accruals')).flush({ data: [] });

    service.getSettlements({ agreement_id: 'ag-1' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/settlements') && r.params.get('agreement_id') === 'ag-1').flush({ data: [] });

    service.getDashboard().subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/dashboard')).flush({ data: {} });

    service.getPromotions({ state: 'active', on: '2027-06-15' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/promotions') && r.params.get('state') === 'active' && r.params.get('on') === '2027-06-15').flush({ data: [] });

    service.updatePromotion('pr-1', { is_active: false }).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/rebates/promotions/pr-1') && r.method === 'PUT');
    expect(update.request.body).toEqual({ is_active: false });
    update.flush({ data: {} });

    service.deletePromotion('pr-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/promotions/pr-1') && r.method === 'DELETE').flush(null);
  });

  it('reads the live progress up to a date and skips the date when it is blank', () => {
    service.getProgress('ag-1', '2027-06-30').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/progress') && r.params.get('as_of') === '2027-06-30').flush({ data: {} });

    service.getProgress('ag-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/progress') && !r.params.has('as_of')).flush({ data: {} });
  });

  it('manages the contributions of an agreement', () => {
    service.getContributions('ag-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/contributions') && r.method === 'GET').flush({ data: [] });

    const payload = { kind: 'marketing' as const, description: 'Catalogue', amount: '500', due_on: '2027-09-30' };
    service.createContribution('ag-1', payload).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/contributions') && r.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.updateContribution('co-1', { amount: '600' }).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/rebates/contributions/co-1') && r.method === 'PUT');
    expect(update.request.body).toEqual({ amount: '600' });
    update.flush({ data: {} });

    service.deleteContribution('co-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/contributions/co-1') && r.method === 'DELETE').flush(null);
  });

  it('lists, runs and reverses the accrual runs', () => {
    service.getAccrualRuns('ag-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/accrual-runs') && r.method === 'GET').flush({ data: [] });

    service.createAccrualRun('ag-1', { period_end: '2027-03-31' }).subscribe();
    const run = httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/accrual-runs') && r.method === 'POST');
    expect(run.request.body).toEqual({ period_end: '2027-03-31' });
    run.flush({ data: {} });

    service.reverseAccrualRun('run-1', 'Wrong period').subscribe();
    const reverse = httpMock.expectOne((r) => r.url.endsWith('/accrual-runs/run-1/reverse') && r.method === 'POST');
    expect(reverse.request.body).toEqual({ reason: 'Wrong period' });
    reverse.flush({ data: {} });
  });

  it('lists, reads and proposes settlements', () => {
    service.getSettlementProposals({ agreement_id: 'ag-1', status: 'draft' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/settlement-proposals') && r.params.get('agreement_id') === 'ag-1' && r.params.get('status') === 'draft').flush({ data: [] });

    service.getSettlementProposal('sp-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/rebates/settlement-proposals/sp-1') && r.method === 'GET').flush({ data: {} });

    service.createSettlementProposal('ag-1', { execution_mode: 'ap_set_off', passive_invoice_id: 'pi-1' }).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/agreements/ag-1/settlement-proposals') && r.method === 'POST');
    expect(create.request.body).toEqual({ execution_mode: 'ap_set_off', passive_invoice_id: 'pi-1' });
    create.flush({ data: {} });
  });

  it('moves a proposal through submit, approve, execute and cancel', () => {
    for (const action of ['submit', 'approve', 'execute', 'cancel'] as const) {
      service.transitionSettlementProposal('sp-1', action, { version: 2 }).subscribe();
      const request = httpMock.expectOne((r) => r.url.endsWith(`/settlement-proposals/sp-1/${action}`) && r.method === 'POST');
      expect(request.request.body).toEqual({ version: 2 });
      request.flush({ data: {} });
    }

    service.transitionSettlementProposal('sp-1', 'execute').subscribe();
    const bare = httpMock.expectOne((r) => r.url.endsWith('/settlement-proposals/sp-1/execute'));
    expect(bare.request.body).toEqual({});
    bare.flush({ data: {} });
  });
});
