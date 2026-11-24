import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApiService } from '@core';
import { TenantPlanComponent } from './tenant-plan.component';

interface Page {
  tenantId: { set(id: string | null): void };
  planCode: { set(code: string): void };
  maxUsers: { set(n: number | null): void };
  save(): void;
  result(): { plan_code: string } | null;
}

describe('TenantPlanComponent', () => {
  const api = { listTenants: vi.fn(), updateTenantPlan: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup(): Page {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(TenantPlanComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Page;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.listTenants.mockReturnValue(of({ data: [{ id: 't1', name: 'Alfa' }], meta: {} }));
    api.updateTenantPlan.mockReturnValue(of({ data: { plan_code: 'professional', max_users: 20, max_custom_roles: null } }));
  });

  it('does nothing without a tenant', () => {
    setup().save();
    expect(api.updateTenantPlan).not.toHaveBeenCalled();
  });

  it('sends plan and limits, null removing the override', () => {
    const page = setup();
    page.tenantId.set('t1');
    page.planCode.set('professional');
    page.maxUsers.set(20);
    page.save();
    expect(api.updateTenantPlan).toHaveBeenCalledWith('t1', { plan_code: 'professional', max_users: 20, max_custom_roles: null });
    expect(page.result()?.plan_code).toBe('professional');
  });
});
