import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AccessApiService, AdminApiService } from '@core';

const ok = { success: true, message: '', data: {} };

describe('AccessApiService', () => {
  let service: AccessApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccessApiService, AdminApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AccessApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('invites, resends and revokes an invitation', () => {
    service.invite({ email: 'a@example.test', custom_role_id: 'r1' }).subscribe();
    const invite = httpMock.expectOne(`${base}/invitations`);
    expect(invite.request.method).toBe('POST');
    expect(invite.request.body).toEqual({ email: 'a@example.test', custom_role_id: 'r1' });
    invite.flush(ok);

    service.resendInvitation('i1').subscribe();
    const resend = httpMock.expectOne(`${base}/invitations/i1/resend`);
    expect(resend.request.method).toBe('POST');
    resend.flush(ok);

    service.revokeInvitation('i1').subscribe();
    const revoke = httpMock.expectOne(`${base}/invitations/i1`);
    expect(revoke.request.method).toBe('DELETE');
    revoke.flush(ok);
  });

  it('suspends and reactivates a member', () => {
    service.suspendMember('u1').subscribe();
    httpMock.expectOne(`${base}/users/u1/suspend`).flush(ok);
    service.reactivateMember('u1').subscribe();
    httpMock.expectOne(`${base}/users/u1/reactivate`).flush(ok);
  });

  it('sends the import file as multipart with the dry run flag', () => {
    const file = new File(['email\na@example.test\n'], 'users.csv', { type: 'text/csv' });

    service.importUsers(file, true, 'member').subscribe();
    const req = httpMock.expectOne(`${base}/users/import`);

    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('dry_run')).toBe('1');
    expect(body.get('default_role')).toBe('member');
    req.flush(ok);

    service.importUsers(file, false).subscribe();
    const real = httpMock.expectOne(`${base}/users/import`);
    expect((real.request.body as FormData).get('dry_run')).toBe('0');
    expect((real.request.body as FormData).has('default_role')).toBe(false);
    real.flush(ok);
  });

  it('manages roles, teams and delegations', () => {
    service.createRole({ name: 'Bookkeeper', base_role: 'accountant', modules: { crm: 'read' } }).subscribe();
    const create = httpMock.expectOne(`${base}/access/roles`);
    expect(create.request.method).toBe('POST');
    create.flush(ok);

    service.updateRole('r1', { name: 'X' }).subscribe();
    const update = httpMock.expectOne(`${base}/access/roles/r1`);
    expect(update.request.method).toBe('PUT');
    update.flush(ok);

    service.setTeamMembers('t1', ['u1', 'u2']).subscribe();
    const members = httpMock.expectOne(`${base}/access/teams/t1/members`);
    expect(members.request.body).toEqual({ user_ids: ['u1', 'u2'] });
    members.flush(ok);

    service.revokeDelegation('d1').subscribe();
    const revoke = httpMock.expectOne(`${base}/access/delegations/d1`);
    expect(revoke.request.method).toBe('DELETE');
    revoke.flush(ok);
  });

  it('asks the audit by type and page', () => {
    service.getAudit({ type: 'access.role', per_page: 20, page: 2 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/access/audit`);

    expect(req.request.params.get('type')).toBe('access.role');
    expect(req.request.params.get('per_page')).toBe('20');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('previews and accepts an invitation on the public auth routes', () => {
    service.previewInvitation('tok/en').subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/invitations/tok%2Fen`).flush(ok);

    service.acceptInvitation('tok').subscribe();
    const session = httpMock.expectOne(`${environment.apiBaseUrl}/auth/invitations/tok/accept`);
    expect(session.request.body).toEqual({});
    session.flush(ok);

    const payload = { name: 'Eva', password: 'x', password_confirmation: 'x' };
    service.acceptInvitation('tok', payload).subscribe();
    const fresh = httpMock.expectOne(`${environment.apiBaseUrl}/auth/invitations/tok/accept`);
    expect(fresh.request.body).toEqual(payload);
    fresh.flush(ok);
  });

  it('sets the plan of a tenant (platform admin)', () => {
    TestBed.inject(AdminApiService).updateTenantPlan('t1', { plan_code: 'standard', max_users: null }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/admin/tenants/t1/plan`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ plan_code: 'standard', max_users: null });
    req.flush(ok);
  });
});
