import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { PayrollComplianceApiService } from '@core';

const ok = { success: true, message: '', data: {} };

describe('PayrollComplianceApiService', () => {
  let service: PayrollComplianceApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PayrollComplianceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PayrollComplianceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists and saves the legal parameters of a topic and year', () => {
    service.getLegalParameters().subscribe();
    const list = httpMock.expectOne(`${base}/legal-parameters`);
    expect(list.request.method).toBe('GET');
    list.flush({ ...ok, data: [] });

    service.saveLegalParameters('frontier_italy', 2026, { parameters: { threshold: 10000 }, source: 'Accordo 2023' }).subscribe();
    const put = httpMock.expectOne(`${base}/legal-parameters/frontier_italy/2026`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ parameters: { threshold: 10000 }, source: 'Accordo 2023' });
    put.flush(ok);
  });

  it('lists and saves the annual parameters of a country', () => {
    service.getAnnualParameters().subscribe();
    httpMock.expectOne(`${base}/annual-parameters`).flush({ ...ok, data: [] });

    service.saveAnnualParameters('CH', 2026, { parameters: { ahv_employee_rate: 5.3 }, legal_reference: 'AHVG' }).subscribe();
    const put = httpMock.expectOne(`${base}/annual-parameters/CH/2026`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.parameters).toEqual({ ahv_employee_rate: 5.3 });
    put.flush(ok);
  });

  it('summarizes and imports the withholding tax tariffs from a file or from text', () => {
    service.getWithholdingTaxTariffs().subscribe();
    httpMock.expectOne(`${base}/withholding-tax-tariffs`).flush({ ...ok, data: [] });

    const file = new File(['x'], 'tarif.txt');
    service.importWithholdingTaxTariffs({ file }).subscribe();
    const upload = httpMock.expectOne(`${base}/withholding-tax-tariffs/import`);
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body instanceof FormData).toBe(true);
    expect((upload.request.body as FormData).get('file')).toBeTruthy();
    upload.flush({ ...ok, data: { imported: 3 } });

    service.importWithholdingTaxTariffs({ content: 'rows' }).subscribe();
    const text = httpMock.expectOne(`${base}/withholding-tax-tariffs/import`);
    expect(text.request.body).toEqual({ content: 'rows' });
    text.flush({ ...ok, data: { imported: 1 } });
  });

  it('reads and closes the withholding statement of a period', () => {
    service.getWithholdingStatements({ year: 2026, period_type: 'quarterly', period: 2, canton: null }).subscribe();
    const get = httpMock.expectOne((r) => r.url === `${base}/withholding-statements`);
    expect(get.request.method).toBe('GET');
    expect(get.request.params.get('period_type')).toBe('quarterly');
    expect(get.request.params.has('canton')).toBe(false);
    get.flush(ok);

    service.closeWithholdingStatement({ year: 2026, period_type: 'monthly', period: 3, canton: 'TI' }).subscribe();
    const post = httpMock.expectOne(`${base}/withholding-statements`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ year: 2026, period_type: 'monthly', period: 3, canton: 'TI' });
    post.flush(ok);
  });

  it('records the nights away of a frontier worker', () => {
    service.saveFrontierNights('emp1', { year: 2026, nights_away: 12 }).subscribe();
    const put = httpMock.expectOne(`${base}/frontier-workers/emp1/nights`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ year: 2026, nights_away: 12 });
    put.flush(ok);
  });

  it('reads the Swissdec status, declaration and readiness and requests a transmission', () => {
    service.getSwissdecStatus().subscribe();
    httpMock.expectOne(`${base}/swissdec/status`).flush(ok);

    service.getSwissdecDeclaration(2026, '6.0').subscribe();
    const declaration = httpMock.expectOne((r) => r.url === `${base}/swissdec/declaration`);
    expect(declaration.request.params.get('year')).toBe('2026');
    expect(declaration.request.params.get('version')).toBe('6.0');
    declaration.flush(ok);

    service.getSwissdecReadiness(2026).subscribe();
    const readiness = httpMock.expectOne((r) => r.url === `${base}/swissdec/readiness`);
    expect(readiness.request.params.has('version')).toBe(false);
    readiness.flush(ok);

    service.transmitSwissdec(2026, '5.0').subscribe();
    const post = httpMock.expectOne(`${base}/swissdec/transmissions`);
    expect(post.request.body).toEqual({ year: 2026, version: '5.0' });
    post.flush(ok);

    service.transmitSwissdec(2026).subscribe();
    expect(httpMock.expectOne(`${base}/swissdec/transmissions`).request.body).toEqual({ year: 2026 });
  });

  it('reads the labour cost and the child allowances', () => {
    service.getLabourCostReport({ year: 2026, month: 5, group_by: 'department' }).subscribe();
    const cost = httpMock.expectOne((r) => r.url === `${base}/reports/labour-cost`);
    expect(cost.request.params.get('group_by')).toBe('department');
    expect(cost.request.params.get('month')).toBe('5');
    cost.flush(ok);

    service.getChildAllowances({ year: 2026, month: 5, employee_id: 'e1' }).subscribe();
    const children = httpMock.expectOne((r) => r.url === `${base}/children/allowances`);
    expect(children.request.params.get('employee_id')).toBe('e1');
    children.flush({ ...ok, data: [] });
  });

  it('simulates a hiring', () => {
    service.simulateHiring({ year: 2026, annual_gross: 90000, fte_ratio: 1 }).subscribe((res) => {
      expect(res.data.monthly_net).toBe('5800.00');
    });
    const post = httpMock.expectOne(`${base}/hiring-simulations`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ year: 2026, annual_gross: 90000, fte_ratio: 1 });
    post.flush({ ...ok, data: { monthly_net: '5800.00' } });
  });
});
