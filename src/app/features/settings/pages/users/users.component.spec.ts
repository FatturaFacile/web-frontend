import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, SettingsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { TenantUsersComponent } from './users.component';

const members = [
  { id: 'me', name: 'Ada Owner', email: 'ada@example.test', role: 'owner', is_active: true, modules: {} },
  { id: 'u2', name: 'Bruno Member', email: 'bruno@example.test', role: 'member', is_active: true, modules: { crm: 'blocked' } },
];
const options = { roles: ['owner', 'admin', 'member'], modules: ['crm', 'treasury'], levels: ['default', 'blocked', 'read', 'write'] };

interface Page {
  dialog(): { member: { id: string } | null } | null;
  openAdd(): void;
  openEdit(member: (typeof members)[number]): void;
  save(payload: object): void;
  remove(member: (typeof members)[number]): void;
  customModules(member: (typeof members)[number]): string;
}

describe('TenantUsersComponent', () => {
  const api = {
    getTenantUsers: vi.fn(),
    getAccessOptions: vi.fn(),
    addTenantUser: vi.fn(),
    updateTenantUser: vi.fn(),
    removeTenantUser: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup(platformAdmin = false): { page: Page; fixture: ReturnType<typeof TestBed.createComponent<TenantUsersComponent>> } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: SettingsApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: AuthStore, useValue: { user: () => ({ id: 'me', is_platform_admin: platformAdmin }) } },
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
  });

  it('lists the members and offers no edit or removal on the own membership', () => {
    const { fixture } = setup();
    const rows = fixture.nativeElement.querySelectorAll('[data-test="member-row"]');

    expect(rows.length).toBe(2);
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
});
