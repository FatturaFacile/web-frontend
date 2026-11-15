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
});
