import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessApiService, AuthStore, EnterpriseAuthApiService, IamApiService, PermissionsService, SettingsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { TenantUsersComponent } from './users.component';

const members = [
  { id: 'me', name: 'Ada Owner', email: 'ada@example.test', role: 'owner', is_active: true, modules: {} },
  { id: 'u2', name: 'Bruno Member', email: 'bruno@example.test', role: 'member', is_active: true, modules: { crm: 'blocked' } },
  { id: 'u3', name: 'Carla Suspended', email: 'carla@example.test', role: 'member', is_active: true, suspended: true, modules: {} },
  { id: 'u4', name: 'Dario Custom', email: 'dario@example.test', role: 'accountant', custom_role_id: 'r1', is_active: true, modules: {} },
  {
    id: 'u5',
    name: 'Elena Locked',
    email: 'elena@example.test',
    role: 'member',
    is_active: true,
    locked: true,
    locked_until: '2026-11-26T10:30:00Z',
    failed_attempts: 5,
    modules: {},
  },
];
const limits = { plan_code: 'starter', max_users: 5, active_users: 4, pending_invitations: 1, max_custom_roles: 2, custom_roles: 1 };
const roles = { roles: [{ id: 'r1', key: 'bookkeeper', name: 'Bookkeeper', description: null, base_role: 'accountant', modules: {}, members: 1 }], base_roles: [], modules: [], levels: [] };
const options = { roles: ['owner', 'admin', 'member'], modules: ['crm', 'treasury'], levels: ['default', 'blocked', 'read', 'write'] };

interface Page {
  dialog(): { member: { id: string } | null } | null;
  openAdd(): void;
  openEdit(member: (typeof members)[number]): void;
  save(payload: object): void;
  remove(member: (typeof members)[number]): void;
  customModules(member: (typeof members)[number]): string;
  suspend(member: (typeof members)[number]): void;
  reactivate(member: (typeof members)[number]): void;
  confirmUnlock(member: (typeof members)[number]): void;
  confirmRevokeSessions(member: (typeof members)[number]): void;
  lockedDetail(member: (typeof members)[number]): string | null;
  memberRoleLabel(member: (typeof members)[number]): string;
}

describe('TenantUsersComponent', () => {
  const api = {
    getTenantUsers: vi.fn(),
    getAccessOptions: vi.fn(),
    addTenantUser: vi.fn(),
    updateTenantUser: vi.fn(),
    removeTenantUser: vi.fn(),
  };
  const accessApi = { getRoles: vi.fn(), getLimits: vi.fn(), suspendMember: vi.fn(), reactivateMember: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const enterpriseAuth = { unlockUser: vi.fn() };
  const iam = { revokeUserSessions: vi.fn() };
  const confirm = vi.fn();

  function setup(platformAdmin = false): { page: Page; fixture: ReturnType<typeof TestBed.createComponent<TenantUsersComponent>> } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: SettingsApiService, useValue: api },
        { provide: AccessApiService, useValue: accessApi },
        { provide: NzMessageService, useValue: message },
        { provide: EnterpriseAuthApiService, useValue: enterpriseAuth },
        { provide: IamApiService, useValue: iam },
        { provide: NzModalService, useValue: { confirm } },
        { provide: AuthStore, useValue: { user: () => ({ id: 'me', is_platform_admin: platformAdmin }) } },
        // The audit history button needs the audit trail permission: these tests are about the member list itself.
        { provide: PermissionsService, useValue: { canRead: () => false, canWrite: () => false } },
      ],
    });
    const fixture = TestBed.createComponent(TenantUsersComponent);
    fixture.detectChanges();
    return { page: fixture.componentInstance as unknown as Page, fixture };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTenantUsers.mockReturnValue(of({ success: true, message: '', data: members }));
    api.getAccessOptions.mockReturnValue(of({ success: true, message: '', data: options }));
    accessApi.getRoles.mockReturnValue(of({ success: true, message: '', data: roles }));
    accessApi.getLimits.mockReturnValue(of({ success: true, message: '', data: limits }));
  });

  it('lists the members and offers no edit or removal on the own membership', () => {
    const { fixture } = setup();
    const rows = fixture.nativeElement.querySelectorAll('[data-test="member-row"]');

    expect(rows.length).toBe(5);
    expect(rows[0].querySelector('[data-test="edit-member"]')).toBeNull();
    expect(rows[1].querySelector('[data-test="edit-member"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-test="remove-member"]')).not.toBeNull();
  });

  it('summarizes the modules that do not follow the role', () => {
    const { page } = setup();

    expect(page.customModules(members[1])).toContain('crm');
    expect(page.customModules(members[0])).not.toContain(':');
  });

  it('adds a member by email with role and module levels, then reloads the list', () => {
    api.addTenantUser.mockReturnValue(of({ success: true, message: '', data: members[1] }));
    const { page } = setup();

    page.openAdd();
    expect(page.dialog()).toEqual({ member: null });
    page.save({ email: 'new@example.test', role: 'member', modules: { crm: 'read' } });

    expect(api.addTenantUser).toHaveBeenCalledWith({ email: 'new@example.test', role: 'member', modules: { crm: 'read' } });
    expect(page.dialog()).toBeNull();
    expect(message.success).toHaveBeenCalled();
    expect(api.getTenantUsers).toHaveBeenCalledTimes(2);
  });

  it('updates the role and the modules of an existing member', () => {
    api.updateTenantUser.mockReturnValue(of({ success: true, message: '', data: members[1] }));
    const { page } = setup();

    page.openEdit(members[1]);
    page.save({ role: 'admin', modules: { crm: 'write' } });

    expect(api.updateTenantUser).toHaveBeenCalledWith('u2', { role: 'admin', modules: { crm: 'write' } });
    expect(api.addTenantUser).not.toHaveBeenCalled();
  });

  it('removes a member and reloads the list', () => {
    api.removeTenantUser.mockReturnValue(of({ success: true, message: '', data: null }));
    const { page } = setup();

    page.remove(members[1]);

    expect(api.removeTenantUser).toHaveBeenCalledWith('u2');
    expect(api.getTenantUsers).toHaveBeenCalledTimes(2);
  });

  it('shows the server refusal and keeps the dialog open', () => {
    api.updateTenantUser.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'A tenant needs at least one owner.' } })),
    );
    const { page } = setup();

    page.openEdit(members[1]);
    page.save({ role: 'member' });

    expect(message.error).toHaveBeenCalledWith('A tenant needs at least one owner.');
    expect(page.dialog()).not.toBeNull();
  });

  it('links platform administrators to the access of users to companies', () => {
    expect(setup(false).fixture.nativeElement.querySelector('[data-test="manage-tenants"]')).toBeNull();
    expect(setup(true).fixture.nativeElement.querySelector('[data-test="manage-tenants"]')).not.toBeNull();
  });

  it('shows the plan limits with the pending invitations', () => {
    const { fixture } = setup();
    const text = (fixture.nativeElement.querySelector('[data-test="users-limit"]') as HTMLElement).textContent ?? '';

    expect(text).toContain('5 / 5');
    expect(fixture.nativeElement.querySelector('[data-test="invite-member"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test="import-members"]')).not.toBeNull();
  });

  it('shows the name of the custom role instead of the base role string', () => {
    const { page } = setup();

    expect(page.memberRoleLabel(members[3])).toBe('Bookkeeper');
    expect(page.memberRoleLabel(members[1])).not.toBe('Bookkeeper');
  });

  it('deactivates and reactivates a member, then reloads the list', () => {
    accessApi.suspendMember.mockReturnValue(of({ success: true, message: '', data: members[1] }));
    accessApi.reactivateMember.mockReturnValue(of({ success: true, message: '', data: members[2] }));
    const { page, fixture } = setup();

    expect(fixture.nativeElement.querySelectorAll('[data-test="reactivate-member"]').length).toBe(1);
    page.suspend(members[1]);
    page.reactivate(members[2]);

    expect(accessApi.suspendMember).toHaveBeenCalledWith('u2');
    expect(accessApi.reactivateMember).toHaveBeenCalledWith('u3');
    expect(api.getTenantUsers).toHaveBeenCalledTimes(3);
  });

  it('saves a member with a custom role by its id', () => {
    api.updateTenantUser.mockReturnValue(of({ success: true, message: '', data: members[1] }));
    const { page } = setup();

    page.openEdit(members[1]);
    page.save({ custom_role_id: 'r1', modules: {} });

    expect(api.updateTenantUser).toHaveBeenCalledWith('u2', { custom_role_id: 'r1', modules: {} });
  });

  it('explains a plan limit refusal with title and detail', () => {
    api.addTenantUser.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { title: 'Plan limit reached', detail: 'The subscription plan allows at most 5 users.' },
          }),
      ),
    );
    const { page } = setup();

    page.openAdd();
    page.save({ email: 'new@example.test', role: 'member' });

    expect(message.error).toHaveBeenCalledWith('Plan limit reached: The subscription plan allows at most 5 users.');
  });

  it('shows a locked badge and the unlock action only for a locked member', () => {
    const { fixture } = setup();
    const rows = fixture.nativeElement.querySelectorAll('[data-test="member-row"]');

    expect(rows[4].querySelector('[data-test="member-locked"]')).not.toBeNull();
    expect(rows[4].querySelector('[data-test="unlock-member"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-test="member-locked"]')).toBeNull();
    expect(rows[1].querySelector('[data-test="unlock-member"]')).toBeNull();
  });

  it('describes the lock with the failed attempts', () => {
    const { page } = setup();

    expect(page.lockedDetail(members[4])).toContain('5');
    expect(page.lockedDetail(members[1])).toBeNull();
  });

  it('asks for confirmation, unlocks the member and reloads the list', async () => {
    enterpriseAuth.unlockUser.mockReturnValue(of({ success: true, message: '', data: null }));
    const { page } = setup();

    page.confirmUnlock(members[4]);
    expect(enterpriseAuth.unlockUser).not.toHaveBeenCalled();
    const options = confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void>; nzContent: string };
    await options.nzOnOk();

    expect(enterpriseAuth.unlockUser).toHaveBeenCalledWith('u5');
    expect(message.success).toHaveBeenCalled();
    expect(api.getTenantUsers).toHaveBeenCalledTimes(2);
  });

  it('reports a failed unlock', async () => {
    enterpriseAuth.unlockUser.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const { page } = setup();

    page.confirmUnlock(members[4]);
    await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

    expect(message.error).toHaveBeenCalled();
    expect(api.getTenantUsers).toHaveBeenCalledTimes(1);
  });

  it('revokes every session of a member after confirmation', async () => {
    iam.revokeUserSessions.mockReturnValue(of({ success: true, message: '', data: { sessions: 2, tokens: 1 } }));
    const { page } = setup();

    page.confirmRevokeSessions(members[1]);
    await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

    expect(iam.revokeUserSessions).toHaveBeenCalledWith('u2');
    expect(message.success).toHaveBeenCalled();
  });
});
