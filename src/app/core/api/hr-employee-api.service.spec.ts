import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HrEmployeeApiService, PayrollAgreementApiService } from '@core';

const ok = { success: true, message: '', data: [] };

describe('HrEmployeeApiService', () => {
  let service: HrEmployeeApiService;
  let httpMock: HttpTestingController;
  const hr = `${environment.apiBaseUrl}/hr`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HrEmployeeApiService, PayrollAgreementApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HrEmployeeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists contracts and starts a new one with decimal strings', () => {
    service.getContracts('e1').subscribe();
    httpMock.expectOne(`${hr}/employees/e1/contracts`).flush(ok);

    service
      .createContract('e1', {
        contract_type: 'permanent',
        job_title: 'Developer',
        start_date: '2026-01-01',
        weekly_hours: '40.00',
        base_annual_salary: '85000.00',
      })
      .subscribe();
    const req = httpMock.expectOne(`${hr}/employees/e1/contracts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.base_annual_salary).toBe('85000.00');
    req.flush({ success: true, message: '', data: {} });
  });

  it('updates a contract and manages salary components', () => {
    service.updateContract('c1', { job_title: 'Lead' }).subscribe();
    const put = httpMock.expectOne(`${hr}/contracts/c1`);
    expect(put.request.method).toBe('PUT');
    put.flush({ success: true, message: '', data: {} });

    const component = { wage_type_code: 'BONUS', description: 'Bonus', amount: '100.00' };
    service.addSalaryComponent('c1', component).subscribe();
    const post = httpMock.expectOne(`${hr}/contracts/c1/salary-components`);
    expect(post.request.method).toBe('POST');
    post.flush({ success: true, message: '', data: {} });

    service.updateSalaryComponent('s1', component).subscribe();
    const putReq = httpMock.expectOne(`${hr}/salary-components/s1`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, message: '', data: {} });

    service.deleteSalaryComponent('s1').subscribe();
    const del = httpMock.expectOne(`${hr}/salary-components/s1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('uploads a document as multipart with boolean flags', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    service
      .uploadEmployeeDocument('e1', {
        file,
        document_type: 'medical_fitness',
        title: 'Fitness',
        retention_until: '2036-01-01',
        contains_health_data: true,
        visible_to_employee: false,
      })
      .subscribe();
    const req = httpMock.expectOne(`${hr}/employees/e1/documents`);
    const body = req.request.body as FormData;
    expect(body.get('document_type')).toBe('medical_fitness');
    expect(body.get('retention_until')).toBe('2036-01-01');
    expect(body.get('contains_health_data')).toBe('1');
    expect(body.get('visible_to_employee')).toBe('0');
    expect(body.get('expiry_date')).toBeNull();
    req.flush({ success: true, message: '', data: {} });
  });

  it('lists, downloads and deletes documents', () => {
    service.getEmployeeDocuments('e1').subscribe();
    httpMock.expectOne(`${hr}/employees/e1/documents`).flush(ok);
    service.downloadEmployeeDocument('d1').subscribe();
    const dl = httpMock.expectOne(`${hr}/employee-documents/d1/download`);
    expect(dl.request.responseType).toBe('blob');
    dl.flush(new Blob(['x']));
    service.deleteEmployeeDocument('d1').subscribe();
    const del = httpMock.expectOne(`${hr}/employee-documents/d1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('transfers an employee, reads and writes the org chart', () => {
    service.transferEmployee('e1', { to_department_id: 'd1', reason: 'move' }).subscribe();
    const tr = httpMock.expectOne(`${hr}/employees/e1/transfer`);
    expect(tr.request.body).toEqual({ to_department_id: 'd1', reason: 'move' });
    tr.flush({ success: true, message: '', data: {} });

    service.getDepartments().subscribe();
    httpMock.expectOne(`${hr}/departments`).flush(ok);
    service.createDepartment({ code: 'IT', name: 'IT' }).subscribe();
    httpMock.expectOne(`${hr}/departments`).flush({ success: true, message: '', data: {} });
    service.updateDepartment('d1', { code: 'IT', name: 'IT', parent_id: 'd0' }).subscribe();
    const putReq = httpMock.expectOne(`${hr}/departments/d1`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, message: '', data: {} });

    service.getPositions().subscribe();
    httpMock.expectOne(`${hr}/positions`).flush(ok);
    service.createPosition({ code: 'DEV', title: 'Developer' }).subscribe();
    httpMock.expectOne(`${hr}/positions`).flush({ success: true, message: '', data: {} });
    service.updatePosition('p1', { code: 'DEV', title: 'Dev' }).subscribe();
    httpMock.expectOne(`${hr}/positions/p1`).flush({ success: true, message: '', data: {} });
    service.getOrgChart().subscribe();
    httpMock.expectOne(`${hr}/org-chart`).flush(ok);
  });

  it('collective agreements and levels', () => {
    const ccnl = TestBed.inject(PayrollAgreementApiService);
    const base = `${environment.apiBaseUrl}/payroll/collective-agreements`;
    ccnl.getAgreements({ per_page: 100 }).subscribe();
    const list = httpMock.expectOne((r) => r.url === base);
    expect(list.request.params.get('per_page')).toBe('100');
    list.flush({ success: true, message: '', data: [], meta: {} });
    ccnl.getAgreement('a1').subscribe();
    httpMock.expectOne(`${base}/a1`).flush({ success: true, message: '', data: {} });
    ccnl.createAgreement({ code: 'C', name: 'N' }).subscribe();
    httpMock.expectOne(base).flush({ success: true, message: '', data: {} });
    ccnl.updateAgreement('a1', { code: 'C', name: 'N' }).subscribe();
    httpMock.expectOne(`${base}/a1`).flush({ success: true, message: '', data: {} });
    ccnl.deleteAgreement('a1').subscribe();
    httpMock.expectOne(`${base}/a1`).flush(null, { status: 204, statusText: 'No Content' });
    ccnl.addLevel('a1', { level: '3', monthly_minimum: '1800.00' }).subscribe();
    const add = httpMock.expectOne(`${base}/a1/levels`);
    expect(add.request.body.monthly_minimum).toBe('1800.00');
    add.flush({ success: true, message: '', data: {} });
    ccnl.updateLevel('a1', 'l1', { level: '3', monthly_minimum: '1900.00' }).subscribe();
    const putReq = httpMock.expectOne(`${base}/a1/levels/l1`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, message: '', data: {} });
    ccnl.deleteLevel('a1', 'l1').subscribe();
    httpMock.expectOne(`${base}/a1/levels/l1`).flush(null, { status: 204, statusText: 'No Content' });
  });
});
