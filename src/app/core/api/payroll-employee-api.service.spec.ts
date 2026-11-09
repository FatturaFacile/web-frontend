import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { PayrollEmployeeApiService } from '@core';

const ok = { success: true, message: '', data: [], meta: {} };
const one = { success: true, message: '', data: {} };

describe('PayrollEmployeeApiService', () => {
  let service: PayrollEmployeeApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/payroll`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PayrollEmployeeApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PayrollEmployeeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('profiles: list with filter, show and save (decimals as strings)', () => {
    service.getProfiles({ employee_id: 'e1', per_page: 100 }).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${base}/employee-profiles`);
    expect(list.request.params.get('employee_id')).toBe('e1');
    list.flush(ok);
    service.getProfile('e1').subscribe();
    httpMock.expectOne(`${base}/employee-profiles/e1`).flush(one);
    service.saveProfile('e1', { weekly_hours: '42.00', pay_type: 'monthly' }).subscribe();
    const put = httpMock.expectOne(`${base}/employee-profiles/e1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.weekly_hours).toBe('42.00');
    put.flush(one);
  });

  it('inputs, absences and children CRUD', () => {
    service.getInputs({ year: 2026, month: 10 }).subscribe();
    httpMock.expectOne((r) => r.url === `${base}/inputs`).flush(ok);
    service
      .createInput({ year: 2026, month: 10, employee_id: 'e1', wage_type_code: 'OT', amount: '120.00' })
      .subscribe();
    const post = httpMock.expectOne(`${base}/inputs`);
    expect(post.request.body.amount).toBe('120.00');
    post.flush(one);
    service.updateInput('i1', { year: 2026, month: 10, employee_id: 'e1', wage_type_code: 'OT' }).subscribe();
    expect(httpMock.expectOne(`${base}/inputs/i1`).request.method).toBe('PUT');
    service.deleteInput('i1').subscribe();
    const del = httpMock.match(`${base}/inputs/i1`);
    expect(del.length).toBe(1);

    service.getAbsences().subscribe();
    httpMock.expectOne(`${base}/absences`).flush(ok);
    const absence = { employee_id: 'e1', absence_type: 'Sickness' as const, start_date: '2026-10-01', end_date: '2026-10-05' };
    service.createAbsence(absence).subscribe();
    httpMock.expectOne(`${base}/absences`).flush(one);
    service.updateAbsence('a1', absence).subscribe();
    httpMock.expectOne(`${base}/absences/a1`).flush(one);
    service.deleteAbsence('a1').subscribe();
    httpMock.expectOne(`${base}/absences/a1`).flush(null, { status: 204, statusText: 'No Content' });

    service.getChildren().subscribe();
    httpMock.expectOne(`${base}/children`).flush(ok);
    const child = { employee_id: 'e1', first_name: 'Luca', date_of_birth: '2020-05-01' };
    service.createChild(child).subscribe();
    httpMock.expectOne(`${base}/children`).flush(one);
    service.updateChild('c1', child).subscribe();
    httpMock.expectOne(`${base}/children/c1`).flush(one);
    service.deleteChild('c1').subscribe();
    httpMock.expectOne(`${base}/children/c1`).flush(null, { status: 204, statusText: 'No Content' });
  });
});
