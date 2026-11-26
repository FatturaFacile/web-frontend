import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnterpriseAuthApiService, ScimGroupMapping, ScimProvisioningLog, ScimSyncStatus } from '@core';
import { icons } from '../../../../icons-provider';
import { ScimGroupMappingsComponent } from './scim-group-mappings.component';
import { ScimLogsComponent } from './scim-logs.component';
import { ScimSyncStatusComponent } from './scim-sync-status.component';

const mappings: ScimGroupMapping[] = [
  { id: 'm1', group_name: 'Finance', role: 'accountant', member_count: 4, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' },
  { id: 'm2', group_name: 'Admins', role: 'admin', member_count: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' },
];

const logs: ScimProvisioningLog[] = [
  { id: 'l1', resource: 'user', operation: 'create', status: 'success', resource_id: 'r1', resource_name: 'anna@acme.example', error: null, occurred_at: '2026-11-20T10:00:00Z' },
  { id: 'l2', resource: 'group', operation: 'patch', status: 'failure', resource_id: null, resource_name: null, error: 'Unknown role', occurred_at: '2026-11-20T10:05:00Z' },
];

describe('SCIM panels', () => {
  const api = {
    getScimGroupMappings: vi.fn(),
    upsertScimGroupMapping: vi.fn(),
    deleteScimGroupMapping: vi.fn(),
    getScimLogs: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const confirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    api.getScimGroupMappings.mockReturnValue(of({ success: true, message: '', data: mappings, meta: { roles: ['admin', 'accountant', 'member'] } }));
    api.getScimLogs.mockReturnValue(
      of({ success: true, message: '', data: logs, meta: { current_page: 1, per_page: 10, total: 25, last_page: 3 } }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: EnterpriseAuthApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: { confirm } },
      ],
    });
  });

  describe('group mappings', () => {
    it('lists the mappings and the member count, with a note for a group not sent yet', () => {
      const fixture = TestBed.createComponent(ScimGroupMappingsComponent);
      fixture.detectChanges();
      const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="mapping-row"]');

      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('Finance');
      expect(rows[0].textContent).toContain('4');
      expect(rows[1].textContent).not.toContain('null');
      expect(fixture.componentInstance['roles']()).toEqual(['admin', 'accountant', 'member']);
    });

    it('does not save an incomplete mapping', () => {
      const fixture = TestBed.createComponent(ScimGroupMappingsComponent);
      fixture.detectChanges();

      fixture.componentInstance['form'].setValue({ group_name: '  ', role: '' });
      fixture.componentInstance['save']();

      expect(api.upsertScimGroupMapping).not.toHaveBeenCalled();
    });

    it('creates or updates the mapping of a group and reloads the list', () => {
      api.upsertScimGroupMapping.mockReturnValue(of({ success: true, message: '', data: mappings[0] }));
      const fixture = TestBed.createComponent(ScimGroupMappingsComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;

      component['form'].setValue({ group_name: ' Finance ', role: 'admin' });
      component['save']();

      expect(api.upsertScimGroupMapping).toHaveBeenCalledWith({ group_name: 'Finance', role: 'admin' });
      expect(message.success).toHaveBeenCalled();
      expect(api.getScimGroupMappings).toHaveBeenCalledTimes(2);
      expect(component['form'].controls.group_name.value).toBe('');
    });

    it('shows the reason when the API refuses the mapping', () => {
      api.upsertScimGroupMapping.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { role: ['The owner role cannot be mapped'] } } })),
      );
      const fixture = TestBed.createComponent(ScimGroupMappingsComponent);
      fixture.detectChanges();
      fixture.componentInstance['form'].setValue({ group_name: 'Boss', role: 'owner' });

      fixture.componentInstance['save']();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mappings-error"]')?.textContent).toContain(
        'The owner role cannot be mapped',
      );
    });

    it('asks for confirmation before it deletes a mapping', async () => {
      api.deleteScimGroupMapping.mockReturnValue(of({ success: true, message: '', data: null }));
      const fixture = TestBed.createComponent(ScimGroupMappingsComponent);
      fixture.detectChanges();

      fixture.componentInstance['confirmDelete'](mappings[0]);
      expect(api.deleteScimGroupMapping).not.toHaveBeenCalled();
      await (confirm.mock.calls[0][0] as { nzOnOk: () => Promise<void> }).nzOnOk();

      expect(api.deleteScimGroupMapping).toHaveBeenCalledWith('m1');
      expect(message.success).toHaveBeenCalled();
      expect(api.getScimGroupMappings).toHaveBeenCalledTimes(2);
    });

    it('shows the empty state', () => {
      api.getScimGroupMappings.mockReturnValue(of({ success: true, message: '', data: [], meta: { roles: ['member'] } }));
      const fixture = TestBed.createComponent(ScimGroupMappingsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="mappings-empty"]')).not.toBeNull();
    });
  });

  describe('provisioning logs', () => {
    it('loads the first page and lists the operations', () => {
      const fixture = TestBed.createComponent(ScimLogsComponent);
      fixture.detectChanges();

      expect(api.getScimLogs).toHaveBeenCalledWith({ resource: undefined, operation: undefined, status: undefined, page: 1, per_page: 10 });
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="scim-log-row"]').length).toBe(2);
      expect(fixture.componentInstance['total']()).toBe(25);
    });

    it('filters by resource, operation and status and goes back to the first page', () => {
      const fixture = TestBed.createComponent(ScimLogsComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component['page'].set(3);

      component['onFilter']('resource', 'group');
      component['onFilter']('operation', 'patch');
      component['onFilter']('status', 'failure');

      expect(api.getScimLogs).toHaveBeenLastCalledWith({ resource: 'group', operation: 'patch', status: 'failure', page: 1, per_page: 10 });
    });

    it('clears a filter and pages on the server', () => {
      const fixture = TestBed.createComponent(ScimLogsComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component['onFilter']('status', 'failure');

      component['onFilter']('status', null);
      component['onPage'](2);

      expect(api.getScimLogs).toHaveBeenLastCalledWith({ resource: undefined, operation: undefined, status: undefined, page: 2, per_page: 10 });
    });

    it('shows the reason of a failed load', () => {
      api.getScimLogs.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { detail: 'Logs unavailable' } })));
      const fixture = TestBed.createComponent(ScimLogsComponent);
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="logs-error"]')?.textContent).toContain('Logs unavailable');
    });
  });

  describe('sync status', () => {
    function render(sync: ScimSyncStatus | null) {
      const fixture = TestBed.createComponent(ScimSyncStatusComponent);
      fixture.componentRef.setInput('sync', sync);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('shows the counters and no error after a clean sync', () => {
      const el = render({ last_sync_at: '2026-11-20T10:00:00Z', last_status: 'success', users_provisioned: 12, groups_provisioned: 3, last_error: null });

      expect(el.querySelector('[data-testid="sync-users"]')?.textContent).toContain('12');
      expect(el.querySelector('[data-testid="sync-groups"]')?.textContent).toContain('3');
      expect(el.querySelector('[data-testid="sync-no-error"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="sync-error"]')).toBeNull();
    });

    it('shows the last error with the resource and operation', () => {
      const el = render({
        last_sync_at: null,
        last_status: 'failure',
        users_provisioned: 0,
        groups_provisioned: 0,
        last_error: { message: 'Unknown role', resource: 'group', operation: 'patch', at: '2026-11-20T10:00:00Z' },
      });

      expect(el.querySelector('[data-testid="sync-error"]')).not.toBeNull();
      expect(el.querySelector('[data-testid="sync-no-error"]')).toBeNull();
    });

    it('renders nothing but the title without sync data', () => {
      const el = render(null);

      expect(el.querySelector('[data-testid="sync-users"]')).toBeNull();
    });
  });
});
