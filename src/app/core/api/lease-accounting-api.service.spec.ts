import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { LeaseContractRequest, LeaseRemeasureRequest } from '../models';
import { LeaseAccountingApiService } from './lease-accounting-api.service';

describe('LeaseAccountingApiService', () => {
  let service: LeaseAccountingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LeaseAccountingApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LeaseAccountingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('lists the leases with the page filters and gives a plain list a pagination block', () => {
    service.getContracts({ status: 'active', currency: 'CHF' }).subscribe((res) => {
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts') && r.params.get('status') === 'active' && r.params.get('currency') === 'CHF');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [{ id: 'l1' }] });
  });

  it('creates and changes a lease with the payload of the FormRequest', () => {
    const payload: LeaseContractRequest = {
      title: 'Sede di Milano',
      lessor_name: 'Immobiliare Rossi Srl',
      asset_class: 'real_estate',
      currency: 'EUR',
      commencement_date: '2027-01-01',
      term_months: 12,
      payment_amount: '1000.00',
      incremental_borrowing_rate_percent: '6.000000',
    };

    service.createContract(payload).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts') && r.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: { id: 'l1' } });

    service.updateContract('l1', { payment_amount: '1200.00' }).subscribe();
    const update = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1') && r.method === 'PUT');
    expect(update.request.body).toEqual({ payment_amount: '1200.00' });
    update.flush({ data: { id: 'l1' } });

    service.deleteContract('l1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1') && r.method === 'DELETE')).toBeTruthy();
  });

  it('previews, activates and cancels a lease', () => {
    service.previewContract('l1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/preview') && r.method === 'GET')).toBeTruthy();

    service.activateContract('l1', { post_recognition: false }).subscribe();
    const activate = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/activate'));
    expect(activate.request.method).toBe('POST');
    expect(activate.request.body).toEqual({ post_recognition: false });

    service.cancelContract('l1', { reason: 'Signed elsewhere' }).subscribe();
    const cancel = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/cancel'));
    expect(cancel.request.body).toEqual({ reason: 'Signed elsewhere' });
  });

  it('remeasures a lease', () => {
    const payload: LeaseRemeasureRequest = { effective_date: '2027-08-01', reason: 'index_change', new_payment_amount: '1050.00' };

    service.remeasureContract('l1', payload).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/remeasure'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
  });

  it('reads the schedule in force or the rows of a version, and the versions', () => {
    service.getSchedule('l1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/schedule') && !r.params.has('version_number'))).toBeTruthy();

    service.getSchedule('l1', 2).subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/schedule') && r.params.get('version_number') === '2')).toBeTruthy();

    service.getVersions('l1').subscribe();
    expect(httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/versions'))).toBeTruthy();
  });

  it('posts the periods of one lease and of every lease through a date', () => {
    service.postPeriods('l1', '2027-03-31').subscribe();
    const one = httpMock.expectOne((r) => r.url.endsWith('/leases/contracts/l1/post-periods'));
    expect(one.request.body).toEqual({ through_date: '2027-03-31' });

    service.runPostings('2027-03-31').subscribe();
    const all = httpMock.expectOne((r) => r.url.endsWith('/leases/postings/run'));
    expect(all.request.method).toBe('POST');
    expect(all.request.body).toEqual({ through_date: '2027-03-31' });
  });

  it('reads the maturity analysis at a date and currency', () => {
    service.getMaturityReport({ as_of: '2027-12-31', currency: 'CHF' }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/leases/reports/maturity') && r.params.get('as_of') === '2027-12-31' && r.params.get('currency') === 'CHF');
    expect(req.request.method).toBe('GET');
  });
});
