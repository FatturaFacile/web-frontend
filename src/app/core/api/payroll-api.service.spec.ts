import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { PayrollApiService } from '@core';

const ok = { success: true, message: '', data: [] };
const one = { success: true, message: '', data: {} };

describe('PayrollApiService', () => {
  let service: PayrollApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PayrollApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PayrollApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists and shows runs, calculates with a payment date', () => {
    service.getRuns({ year: 2026, per_page: 50 }).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${base}/runs`);
    expect(list.request.params.get('year')).toBe('2026');
    list.flush({ ...ok, meta: {} });

    service.getRun('r1').subscribe();
    httpMock.expectOne(`${base}/runs/r1`).flush(one);

    service.calculateRun({ year: 2026, month: 10, payment_date: '2026-10-27' }).subscribe();
    const calc = httpMock.expectOne(`${base}/runs/calculate`);
    expect(calc.request.method).toBe('POST');
    expect(calc.request.body).toEqual({ year: 2026, month: 10, payment_date: '2026-10-27' });
    calc.flush(one);
  });

  it('maps 409 (recalculating an approved run) and 422 (finalize needs Approved)', () => {
    const statuses: number[] = [];
    service.calculateRun({ year: 2026, month: 10 }).subscribe({ error: (e) => statuses.push(e.status) });
    httpMock.expectOne(`${base}/runs/calculate`).flush({ message: 'approved' }, { status: 409, statusText: 'Conflict' });
    service.finalizeRun('r1').subscribe({ error: (e) => statuses.push(e.status) });
    httpMock.expectOne(`${base}/runs/r1/finalize`).flush({ message: 'not approved' }, { status: 422, statusText: 'Unprocessable' });
    expect(statuses).toEqual([409, 422]);
  });

  it('approves, finalizes and reopens with a reason', () => {
    service.approveRun('r1').subscribe();
    const approve = httpMock.expectOne(`${base}/runs/r1/approve`);
    expect(approve.request.method).toBe('POST');
    approve.flush(one);
    service.finalizeRun('r1').subscribe();
    httpMock.expectOne(`${base}/runs/r1/finalize`).flush(one);
    service.reopenRun('r1', 'wrong hours').subscribe();
    const reopen = httpMock.expectOne(`${base}/runs/r1/reopen`);
    expect(reopen.request.body).toEqual({ reason: 'wrong hours' });
    reopen.flush(one);
  });

  it('reads cost allocation, downloads the labour book and year-end report', () => {
    service.getCostAllocation('r1').subscribe();
    httpMock.expectOne(`${base}/runs/r1/cost-allocation`).flush(one);
    service.downloadLabourBook('r1').subscribe();
    const book = httpMock.expectOne(`${base}/runs/r1/labour-book`);
    expect(book.request.responseType).toBe('blob');
    book.flush(new Blob(['x']));
    service.getYearEndReport(2026).subscribe();
    httpMock.expectOne((r) => r.url === `${base}/reports/year-end` && r.params.get('year') === '2026').flush(one);
    service.downloadYearEndReportCsv(2026).subscribe();
    const csv = httpMock.expectOne((r) => r.url === `${base}/reports/year-end`);
    expect(csv.request.headers.get('Accept')).toBe('text/csv');
    expect(csv.request.responseType).toBe('blob');
    csv.flush(new Blob(['a,b']));
    service.simulateRun({ year: 2026, month: 10 }).subscribe();
    httpMock.expectOne(`${base}/runs/simulate`).flush(ok);
    service.previewPay({ employee_id: 'e1' }).subscribe();
    httpMock.expectOne(`${base}/runs/preview`).flush(one);
  });

  it('payslips and salary certificates', () => {
    service.getPayslips({ year: 2026, month: 10 }).subscribe();
    const slips = httpMock.expectOne((r) => r.url === `${base}/payslips`);
    expect(slips.request.params.get('month')).toBe('10');
    slips.flush({ ...ok, meta: {} });
    service.getPayslip('p1').subscribe();
    httpMock.expectOne(`${base}/payslips/p1`).flush(one);
    service.downloadPayslipPdf('p1').subscribe();
    expect(httpMock.expectOne(`${base}/payslips/p1/pdf`).request.responseType).toBe('blob');
    httpMock.match(`${base}/payslips/p1/pdf`);

    service.getSalaryCertificates({ year: 2026 }).subscribe();
    httpMock.expectOne((r) => r.url === `${base}/salary-certificates`).flush({ ...ok, meta: {} });
    service.getSalaryCertificate('c1').subscribe();
    httpMock.expectOne(`${base}/salary-certificates/c1`).flush(one);
    service.generateSalaryCertificates(2026).subscribe();
    const gen = httpMock.expectOne(`${base}/salary-certificates/generate`);
    expect(gen.request.body).toEqual({ year: 2026 });
    gen.flush(ok);
    service.downloadSalaryCertificatePdf('c1').subscribe();
    httpMock.expectOne(`${base}/salary-certificates/c1/pdf`).flush(new Blob(['x']));
  });

  it('wage types, family allowances and settings keep decimals as strings', () => {
    service.getWageTypes().subscribe();
    httpMock.expectOne((r) => r.url === `${base}/wage-types`).flush({ ...ok, meta: {} });
    service.createWageType({ code: 'W1', name: 'Wage', kind: 'Earning' }).subscribe();
    httpMock.expectOne(`${base}/wage-types`).flush(one);
    service.updateWageType('w1', { name: 'X' }).subscribe();
    expect(httpMock.expectOne(`${base}/wage-types/w1`).request.method).toBe('PUT');
    service.deleteWageType('w2').subscribe();
    httpMock.expectOne(`${base}/wage-types/w2`).flush(null, { status: 204, statusText: 'No Content' });

    service.getFamilyAllowanceRates().subscribe();
    httpMock.expectOne((r) => r.url === `${base}/family-allowance-rates`).flush({ ...ok, meta: {} });
    const rate = { canton: 'TI', valid_from: '2026-01-01', child_allowance: '200.00', education_allowance: '250.00' };
    service.createFamilyAllowanceRate(rate).subscribe();
    const post = httpMock.expectOne(`${base}/family-allowance-rates`);
    expect(post.request.body.child_allowance).toBe('200.00');
    post.flush(one);
    service.updateFamilyAllowanceRate('f1', rate).subscribe();
    httpMock.expectOne(`${base}/family-allowance-rates/f1`).flush(one);
    service.deleteFamilyAllowanceRate('f1').subscribe();
    httpMock.expectOne(`${base}/family-allowance-rates/f1`).flush(null, { status: 204, statusText: 'No Content' });

    service.getSettings('swiss').subscribe();
    httpMock.expectOne(`${base}/settings/swiss`).flush(one);
    service.saveSettings('italian', { employee_inps_rate_percent: '9.1900' }).subscribe();
    const put = httpMock.expectOne(`${base}/settings/italian`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.employee_inps_rate_percent).toBe('9.1900');
    put.flush(one);
    service.setup().subscribe();
    httpMock.expectOne(`${base}/setup`).flush(one);
  });

  it('downloads a CSV export with year and month', () => {
    service.downloadExport('f24', { year: 2026, month: 10 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/exports/f24`);
    expect(req.request.params.get('month')).toBe('10');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });
});
