import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ShortTimeApiService } from '@core';

const ok = { success: true, message: '', data: {} };

describe('ShortTimeApiService', () => {
  let service: ShortTimeApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShortTimeApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ShortTimeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists and opens cases', () => {
    service.getCases().subscribe();
    httpMock.expectOne(`${base}/short-time/cases`).flush({ ...ok, data: [] });

    service.createCase({ kind: 'bad_weather', cause: 'Neve', starts_on: '2026-01-10' }).subscribe();
    const post = httpMock.expectOne(`${base}/short-time/cases`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ kind: 'bad_weather', cause: 'Neve', starts_on: '2026-01-10' });
    post.flush(ok);
  });

  it('calculates a claim and reads it back', () => {
    service
      .calculateClaim('c1', { year: 2026, month: 1, employees: [{ employee_id: 'e1', worked_hours: 80, consented: true }] })
      .subscribe();
    const calc = httpMock.expectOne(`${base}/short-time/cases/c1/claims`);
    expect(calc.request.method).toBe('POST');
    expect(calc.request.body.employees[0].worked_hours).toBe(80);
    calc.flush(ok);

    service.getClaim('cl1').subscribe();
    expect(httpMock.expectOne(`${base}/short-time/claims/cl1`).request.method).toBe('GET');
  });

  it('moves a claim through submit, apply and reimbursement', () => {
    service.submitClaim('cl1').subscribe();
    const submit = httpMock.expectOne(`${base}/short-time/claims/cl1/submit`);
    expect(submit.request.method).toBe('POST');
    submit.flush(ok);

    service.applyClaim('cl1').subscribe();
    httpMock.expectOne(`${base}/short-time/claims/cl1/apply`).flush(ok);

    service.recordReimbursement('cl1', { amount: 1234.5, paid_on: '2026-03-01' }).subscribe();
    const paid = httpMock.expectOne(`${base}/short-time/claims/cl1/reimbursement`);
    expect(paid.request.body).toEqual({ amount: 1234.5, paid_on: '2026-03-01' });
    paid.flush(ok);
  });

  it('downloads the figures of a claim as a blob', () => {
    service.downloadClaim('cl1').subscribe((blob) => expect(blob.size).toBeGreaterThan(0));
    const req = httpMock.expectOne(`${base}/short-time/claims/cl1/export`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['a;b']));
  });

  it('manages the construction parameters and calendar', () => {
    const parameters = {
      agreement_code: 'CCL-EDILIZIA',
      valid_from: '2026-01-01',
      annual_hours: 2112,
      accounting_year_start_month: 1,
      minimum_wages: { A: { Z1: { monthly: 6000, hourly: 30 } } },
      source: 'CCL 2026',
    };
    service.addConstructionParameters(parameters).subscribe();
    const post = httpMock.expectOne(`${base}/construction/parameters`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.minimum_wages.A.Z1.hourly).toBe(30);
    post.flush(ok);

    service
      .saveConstructionCalendar({ agreement_code: 'CCL-EDILIZIA', months: [{ year: 2026, month: 1, planned_hours: 176 }] })
      .subscribe();
    const put = httpMock.expectOne(`${base}/construction/calendar`);
    expect(put.request.method).toBe('PUT');
    put.flush({ ...ok, data: { saved: 1 } });
  });

  it('reads construction hours and the joint commission report', () => {
    service.getConstructionHours({ agreement_code: 'X', accounting_year: 2026, employee_id: 'e1' }).subscribe();
    const hours = httpMock.expectOne((r) => r.url === `${base}/construction/hours`);
    expect(hours.request.params.get('accounting_year')).toBe('2026');
    expect(hours.request.params.get('employee_id')).toBe('e1');
    hours.flush(ok);

    service.getJointCommissionReport({ agreement_code: 'X', accounting_year: 2026 }).subscribe();
    const report = httpMock.expectOne((r) => r.url === `${base}/construction/joint-commission-report`);
    expect(report.request.params.has('employee_id')).toBe(false);
    report.flush(ok);
  });
});
