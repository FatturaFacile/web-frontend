import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AdminApiService } from '@core';

const ok = { success: true, message: '', data: {} };

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the tenant access requests filtered by status', () => {
    service.getTenantAccessRequests({ status: 'pending', per_page: 20 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/tenant-access-requests`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('per_page')).toBe('20');
    req.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('approves, moves and rejects a request', () => {
    service.approveTenantAccessRequest('r1', { role: 'admin', reason: 'ok' }).subscribe();
    const approve = httpMock.expectOne(`${base}/tenant-access-requests/r1/approve`);
    expect(approve.request.method).toBe('POST');
    expect(approve.request.body).toEqual({ role: 'admin', reason: 'ok' });
    approve.flush(ok);

    service.moveTenantAccessRequest('r1', { tenant_id: 't2' }).subscribe();
    const move = httpMock.expectOne(`${base}/tenant-access-requests/r1/move`);
    expect(move.request.body).toEqual({ tenant_id: 't2' });
    move.flush(ok);

    service.rejectTenantAccessRequest('r1', { reason: 'duplicate' }).subscribe();
    const reject = httpMock.expectOne(`${base}/tenant-access-requests/r1/reject`);
    expect(reject.request.body).toEqual({ reason: 'duplicate' });
    reject.flush(ok);
  });

  it('sets and removes the document quota of a tenant', () => {
    service.setDocumentQuota('t1', 500).subscribe();
    const set = httpMock.expectOne(`${base}/tenants/t1/document-quota`);
    expect(set.request.method).toBe('PUT');
    expect(set.request.body).toEqual({ document_quota_points: 500 });
    set.flush(ok);

    service.setDocumentQuota('t1', null).subscribe();
    expect(httpMock.expectOne(`${base}/tenants/t1/document-quota`).request.body).toEqual({ document_quota_points: null });
  });

  it('lists users and tenants of the platform with a search', () => {
    service.listUsers({ search: 'ros' }).subscribe();
    const users = httpMock.expectOne((r) => r.url === `${base}/users`);
    expect(users.request.params.get('search')).toBe('ros');
    users.flush({ success: true, message: '', data: [], meta: {} });

    service.listTenants({ search: 'alf' }).subscribe();
    const tenants = httpMock.expectOne((r) => r.url === `${base}/tenants`);
    expect(tenants.request.params.get('search')).toBe('alf');
    tenants.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('reads, saves and removes the tenant access of a user', () => {
    service.getUserTenants('u1').subscribe();
    httpMock.expectOne(`${base}/users/u1/tenants`).flush(ok);

    service.saveUserTenant('u1', 't1', { role: 'admin', modules: { crm: 'blocked' } }).subscribe();
    const save = httpMock.expectOne(`${base}/users/u1/tenants/t1`);
    expect(save.request.method).toBe('PUT');
    expect(save.request.body).toEqual({ role: 'admin', modules: { crm: 'blocked' } });
    save.flush(ok);

    service.removeUserTenant('u1', 't1').subscribe();
    const remove = httpMock.expectOne(`${base}/users/u1/tenants/t1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(ok);
  });
});
