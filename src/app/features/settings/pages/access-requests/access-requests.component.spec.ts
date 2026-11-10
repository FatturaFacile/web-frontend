import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { AccessRequestsComponent } from './access-requests.component';

interface Submittable { submit(p: object): { subscribe(o?: object): void } }

const request = {
  id: 'r1',
  status: 'pending',
  requested_company_name: 'Acme SA',
  requested_tax_id: 'CHE-123.456.789',
  requested_country: 'CH',
  tenant: null,
  user: { id: 'u1', name: 'Mario Rossi', email: 'mario@acme.test', email_verified_at: null },
  decided_by: null,
  decided_at: null,
  rejection_reason: null,
  created_at: '2026-03-01T10:00:00Z',
};

describe('AccessRequestsComponent', () => {
  const api = {
    getTenantAccessRequests: vi.fn(),
    approveTenantAccessRequest: vi.fn(),
    moveTenantAccessRequest: vi.fn(),
    rejectTenantAccessRequest: vi.fn(),
    setDocumentQuota: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  interface Page {
    decisionConfig(): Submittable;
    quotaConfig: Submittable;
    open(r: typeof request, d: 'approve' | 'move' | 'reject'): void;
    setStatus(s: string | null): void;
    decision(): string | null;
  }

  function setup(): {
    page: Page;
    fixture: ReturnType<typeof TestBed.createComponent<AccessRequestsComponent>>;
  } {
    const fixture = TestBed.createComponent(AccessRequestsComponent);
    fixture.detectChanges();
    return { page: fixture.componentInstance as unknown as Page, fixture };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTenantAccessRequests.mockReturnValue(
      of({ success: true, message: '', data: [request], meta: { total: 1 } }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: AdminApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  it('lists the pending requests by default and filters by status', () => {
    const { page, fixture } = setup();
    expect(api.getTenantAccessRequests).toHaveBeenCalledWith({
      status: 'pending',
      per_page: 20,
      page: 1,
    });
    expect(fixture.nativeElement.textContent).toContain('Acme SA');
    page.setStatus(null);
    expect(api.getTenantAccessRequests).toHaveBeenLastCalledWith({
      status: null,
      per_page: 20,
      page: 1,
    });
  });

  it('approves with the chosen role and reloads', () => {
    api.approveTenantAccessRequest.mockReturnValue(of({ data: request }));
    const { page } = setup();
    page.open(request, 'approve');
    page.decisionConfig().submit({ role: 'accountant' }).subscribe();
    expect(api.approveTenantAccessRequest).toHaveBeenCalledWith('r1', { role: 'accountant' });
    expect(page.decision()).toBeNull();
    expect(api.getTenantAccessRequests).toHaveBeenCalledTimes(2);
  });

  it('moves the user to another company', () => {
    api.moveTenantAccessRequest.mockReturnValue(of({ data: request }));
    const { page } = setup();
    page.open(request, 'move');
    page
      .decisionConfig()
      .submit({ tenant_id: '8d1f6e0e-0b1c-4f64-9d3a-0c5b6c1d2e3f', role: 'member' })
      .subscribe();
    expect(api.moveTenantAccessRequest).toHaveBeenCalledWith('r1', {
      tenant_id: '8d1f6e0e-0b1c-4f64-9d3a-0c5b6c1d2e3f',
      role: 'member',
    });
  });

  it('rejects with a reason', () => {
    api.rejectTenantAccessRequest.mockReturnValue(of({ data: request }));
    const { page } = setup();
    page.open(request, 'reject');
    page.decisionConfig().submit({ reason: 'Duplicate request' }).subscribe();
    expect(api.rejectTenantAccessRequest).toHaveBeenCalledWith('r1', {
      reason: 'Duplicate request',
    });
  });

  it('sets the document quota of a company and removes it with an empty value', () => {
    api.setDocumentQuota.mockReturnValue(of({ data: {} }));
    const { page } = setup();
    page.quotaConfig.submit({ tenant_id: 't1', document_quota_points: 500 }).subscribe();
    expect(api.setDocumentQuota).toHaveBeenCalledWith('t1', 500);
    page.quotaConfig.submit({ tenant_id: 't1', document_quota_points: null }).subscribe();
    expect(api.setDocumentQuota).toHaveBeenLastCalledWith('t1', null);
  });

  it('tells a user who is not a platform administrator that the operation is forbidden', () => {
    api.getTenantAccessRequests.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    setup();
    expect(message.error).toHaveBeenCalled();
  });
});
