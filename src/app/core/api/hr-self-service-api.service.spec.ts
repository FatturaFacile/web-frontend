import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HrLeaveApiService, HrSelfServiceApiService } from '@core';

describe('HrSelfServiceApiService', () => {
  let service: HrSelfServiceApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/hr/me`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HrSelfServiceApiService, HrLeaveApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HrSelfServiceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the own profile', () => {
    service.getProfile().subscribe((res) => expect(res.data.fte_ratio).toBe('1.00'));
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { id: 'e1', fte_ratio: '1.00' } });
  });

  it('loads leave balances for a year', () => {
    service.getLeaveBalances(2026).subscribe((res) => expect(res.data[0].available_hours).toBe('120.50'));
    const req = httpMock.expectOne((r) => r.url === `${base}/leave-balances`);
    expect(req.request.params.get('year')).toBe('2026');
    req.flush({ success: true, message: '', data: [{ id: 'b1', available_hours: '120.50' }] });
  });

  it('lists, submits and cancels own leave requests', () => {
    service.getLeaveRequests().subscribe();
    httpMock.expectOne(`${base}/leave-requests`).flush({ success: true, message: '', data: [] });

    const payload = {
      leave_type_id: 't1',
      start_date: '2026-12-01',
      end_date: '2026-12-02',
      total_hours: '16.00',
      reason: null,
    };
    service.submitLeaveRequest(payload).subscribe();
    const post = httpMock.expectOne(`${base}/leave-requests`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(payload);
    post.flush({ success: true, message: '', data: {} });

    service.cancelLeaveRequest('r1', 'changed plans').subscribe();
    const cancel = httpMock.expectOne(`${base}/leave-requests/r1/cancel`);
    expect(cancel.request.method).toBe('POST');
    expect(cancel.request.body).toEqual({ reason: 'changed plans' });
    cancel.flush({ success: true, message: '', data: {} });
  });

  it('loads training and documents and downloads a document as blob', () => {
    service.getTraining().subscribe((res) => expect(res.data.certifications).toHaveLength(1));
    httpMock
      .expectOne(`${base}/training`)
      .flush({ success: true, message: '', data: { training_records: [], certifications: [{ id: 'c1' }] } });

    service.getDocuments().subscribe();
    httpMock.expectOne(`${base}/documents`).flush({ success: true, message: '', data: [] });

    service.downloadDocument('d1', true).subscribe((blob) => expect(blob).toBeInstanceOf(Blob));
    const req = httpMock.expectOne((r) => r.url === `${base}/documents/d1/download`);
    expect(req.request.responseType).toBe('blob');
    expect(req.request.params.get('inline')).toBe('1');
    req.flush(new Blob(['x']));
  });

  it('maps a 403 for a user without an employee', () => {
    let status = 0;
    service.getProfile().subscribe({ error: (err) => (status = err.status) });
    httpMock.expectOne(base).flush({ message: 'no' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });

  it('leave types CRUD', () => {
    const leave = TestBed.inject(HrLeaveApiService);
    const url = `${environment.apiBaseUrl}/hr/leave-types`;
    leave.getLeaveTypes().subscribe();
    httpMock.expectOne(url).flush({ success: true, message: '', data: [] });
    leave
      .createLeaveType({ code: 'FER', name: 'Ferie', category: 'vacation', annual_entitlement_hours: '208.00' })
      .subscribe();
    const post = httpMock.expectOne(url);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.annual_entitlement_hours).toBe('208.00');
    post.flush({ success: true, message: '', data: {} });
    leave.updateLeaveType('t1', { name: 'Ferie 2' }).subscribe();
    const put = httpMock.expectOne(`${url}/t1`);
    expect(put.request.method).toBe('PUT');
    put.flush({ success: true, message: '', data: {} });
  });
});
