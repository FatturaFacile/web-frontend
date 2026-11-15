import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { UserTenantsComponent } from './user-tenants.component';

const user = { id: 'u1', name: 'Mario Rossi', email: 'mario@example.test', is_active: true };
const alfa = { tenant_id: 't1', tenant_name: 'Alfa', role: 'member', suspended: false, permissions: [], modules: {} };

interface Page {
  selectUser(u: typeof user): void;
  pickedTenantId: { set(id: string | null): void };
  openGrant(): void;
  openEdit(row: typeof alfa): void;
  save(payload: object): void;
  remove(row: typeof alfa): void;
  dialog(): { tenantId: string; access: unknown } | null;
  accesses(): unknown[];
  availableTenants(): { id: string }[];
}

describe('UserTenantsComponent', () => {
  const api = {
    getAccessOptions: vi.fn(),
    listUsers: vi.fn(),
    listTenants: vi.fn(),
    getUserTenants: vi.fn(),
    saveUserTenant: vi.fn(),
    removeUserTenant: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup(): Page {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: AdminApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(UserTenantsComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Page;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAccessOptions.mockReturnValue(of({ data: { roles: ['member'], modules: ['crm'], levels: [] } }));
    api.listUsers.mockReturnValue(of({ data: [user], meta: {} }));
    api.listTenants.mockReturnValue(of({ data: [{ id: 't1', name: 'Alfa' }, { id: 't2', name: 'Beta' }], meta: {} }));
    api.getUserTenants.mockReturnValue(of({ data: [alfa] }));
  });

  it('loads the access of the selected user and offers only the tenants they are not in', () => {
    const page = setup();

    page.selectUser(user);

    expect(api.getUserTenants).toHaveBeenCalledWith('u1');
    expect(page.accesses()).toEqual([alfa]);
    expect(page.availableTenants().map((tenant) => tenant.id)).toEqual(['t2']);
  });

  it('grants the access to another tenant with role and module levels', () => {
    api.saveUserTenant.mockReturnValue(of({ data: [alfa, { ...alfa, tenant_id: 't2', tenant_name: 'Beta' }] }));
    const page = setup();
    page.selectUser(user);

    page.pickedTenantId.set('t2');
    page.openGrant();
    expect(page.dialog()).toMatchObject({ tenantId: 't2', access: null });
    page.save({ role: 'accountant', modules: { crm: 'read' } });

    expect(api.saveUserTenant).toHaveBeenCalledWith('u1', 't2', { role: 'accountant', modules: { crm: 'read' } });
    expect(page.accesses().length).toBe(2);
    expect(page.dialog()).toBeNull();
  });

  it('changes and removes the access to a tenant', () => {
    api.saveUserTenant.mockReturnValue(of({ data: [alfa] }));
    api.removeUserTenant.mockReturnValue(of({ data: [] }));
    const page = setup();
    page.selectUser(user);

    page.openEdit(alfa);
    page.save({ role: 'admin' });
    expect(api.saveUserTenant).toHaveBeenCalledWith('u1', 't1', { role: 'admin', modules: undefined });

    page.remove(alfa);
    expect(api.removeUserTenant).toHaveBeenCalledWith('u1', 't1');
    expect(page.accesses()).toEqual([]);
  });
});
