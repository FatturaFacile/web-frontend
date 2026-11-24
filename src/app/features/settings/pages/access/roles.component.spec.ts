import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { AccessRolesComponent } from './roles.component';
import { RoleFormComponent } from './role-form.component';

const role = { id: 'r1', key: 'bookkeeper', name: 'Bookkeeper', description: 'Books', base_role: 'accountant', modules: { crm: 'read' }, members: 2 };
const data = { roles: [role], base_roles: ['member', 'accountant'], modules: ['crm', 'treasury'], levels: ['default', 'blocked', 'read', 'write'] };
const limits = { plan_code: 'starter', max_users: null, active_users: 1, pending_invitations: 0, max_custom_roles: 1, custom_roles: 1 };

interface Page {
  dialog(): { role: { id: string } | null } | null;
  openAdd(): void;
  openEdit(value: typeof role): void;
  save(payload: object): void;
  remove(value: typeof role): void;
}

describe('AccessRolesComponent', () => {
  const api = { getRoles: vi.fn(), getLimits: vi.fn(), createRole: vi.fn(), updateRole: vi.fn(), deleteRole: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup(): { page: Page; fixture: ReturnType<typeof TestBed.createComponent<AccessRolesComponent>> } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: AccessApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(AccessRolesComponent);
    fixture.detectChanges();
    return { page: fixture.componentInstance as unknown as Page, fixture };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getRoles.mockReturnValue(of({ success: true, message: '', data }));
    api.getLimits.mockReturnValue(of({ success: true, message: '', data: limits }));
  });

  it('lists the custom roles with their members and the custom role limit', () => {
    const { fixture } = setup();
    const rows = fixture.nativeElement.querySelectorAll('[data-test="role-row"]');

    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Bookkeeper');
    expect((fixture.nativeElement.querySelector('[data-test="roles-limit"]') as HTMLElement).textContent).toContain('1 / 1');
  });

  it('creates a role from the form values and reloads the list', () => {
    api.createRole.mockReturnValue(of({ success: true, message: '', data: role }));
    const { page } = setup();

    page.openAdd();
    page.save({ name: 'Bookkeeper', description: null, base_role: 'accountant', modules: { crm: 'read', treasury: 'default' } });

    expect(api.createRole).toHaveBeenCalledWith({
      name: 'Bookkeeper',
      description: null,
      base_role: 'accountant',
      modules: { crm: 'read', treasury: 'default' },
    });
    expect(page.dialog()).toBeNull();
    expect(message.success).toHaveBeenCalled();
    expect(api.getRoles).toHaveBeenCalledTimes(2);
  });

  it('updates the role being edited', () => {
    api.updateRole.mockReturnValue(of({ success: true, message: '', data: role }));
    const { page } = setup();

    page.openEdit(role);
    page.save({ name: 'Renamed' });

    expect(api.updateRole).toHaveBeenCalledWith('r1', { name: 'Renamed' });
    expect(api.createRole).not.toHaveBeenCalled();
  });

  it('deletes a role, and shows why when it is in use', () => {
    api.deleteRole.mockReturnValueOnce(of({ success: true, message: '', data: null }));
    const { page } = setup();

    page.remove(role);
    expect(api.deleteRole).toHaveBeenCalledWith('r1');

    api.deleteRole.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { title: 'Role in use', detail: '2 members hold it.' } })),
    );
    page.remove(role);
    expect(message.error).toHaveBeenCalledWith('Role in use: 2 members hold it.');
  });

  it('shows a clear message on the plan limit and keeps the dialog open', () => {
    api.createRole.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { title: 'Plan limit reached', detail: 'The subscription plan allows at most 1 custom roles.' },
          }),
      ),
    );
    const { page } = setup();

    page.openAdd();
    page.save({ name: 'Second', base_role: 'member' });

    expect(message.error).toHaveBeenCalledWith('Plan limit reached: The subscription plan allows at most 1 custom roles.');
    expect(page.dialog()).not.toBeNull();
  });
});

describe('RoleFormComponent', () => {
  function setup(inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(RoleFormComponent);
    fixture.componentRef.setInput('baseRoles', ['member', 'accountant']);
    fixture.componentRef.setInput('modules', ['crm', 'treasury']);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    const emitted: object[] = [];
    fixture.componentInstance.saved.subscribe((payload) => emitted.push(payload));
    fixture.detectChanges();
    const form = fixture.componentInstance as unknown as { name: { set(v: string): void }; baseRole: { set(v: string): void }; submit(): void };
    return { form, fixture, emitted };
  }

  it('cannot save without a name', () => {
    const { fixture } = setup();

    expect((fixture.nativeElement.querySelector('[data-test="save-role"]') as HTMLButtonElement).disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('[data-test="module-row"]').length).toBe(2);
  });

  it('emits name, base role and a level for every module', () => {
    const { form, emitted } = setup();

    form.name.set('  Bookkeeper ');
    form.baseRole.set('accountant');
    form.submit();

    expect(emitted).toEqual([
      { name: 'Bookkeeper', description: null, base_role: 'accountant', modules: { crm: 'default', treasury: 'default' } },
    ]);
  });

  it('starts from the role being edited', () => {
    const { form, emitted } = setup({ role });

    form.submit();

    expect(emitted[0]).toEqual({ name: 'Bookkeeper', description: 'Books', base_role: 'accountant', modules: { crm: 'read', treasury: 'default' } });
  });
});
