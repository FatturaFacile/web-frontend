import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService } from '@core';
import { CommandStore } from './command.store';

const envelope = <T>(data: T) => of({ success: true, message: '', data });
const lookups = (canManage: boolean) => ({
  codes: {},
  formulas: [],
  audit_templates: [],
  benchmark_dimensions: [],
  stores: [],
  role: { is_franchisor: canManage, is_franchisee: !canManage, can_manage: canManage, can_audit: false, can_portal_write: false },
});

describe('CommandStore', () => {
  const api = { getLookups: vi.fn(), getDashboard: vi.fn(), getAgreementAlerts: vi.fn() };
  let store: InstanceType<typeof CommandStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [CommandStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(CommandStore);
  });

  it('loads the dashboard and the alerts of the month for the franchise director', async () => {
    api.getLookups.mockReturnValue(envelope(lookups(true)));
    api.getDashboard.mockReturnValue(envelope({ period: '2028-04', stores: { total: 3 } }));
    api.getAgreementAlerts.mockReturnValue(envelope([{ id: 'a1' }]));

    await store.load('2028-04');

    expect(api.getDashboard).toHaveBeenCalledWith('2028-04');
    expect(store.period()).toBe('2028-04');
    expect(store.dashboard()).toMatchObject({ period: '2028-04' });
    expect(store.alerts()).toHaveLength(1);
    expect(store.loading()).toBe(false);
  });

  it('does not ask the network figures of a company that is not a franchisor', async () => {
    api.getLookups.mockReturnValue(envelope(lookups(false)));

    await store.load();

    expect(api.getDashboard).not.toHaveBeenCalled();
    expect(store.dashboard()).toBeNull();
    expect(store.lookups()?.role.can_manage).toBe(false);
  });

  it('keeps the translation key of a failed load', async () => {
    api.getLookups.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'tenant_missing' } })),
    );

    await store.load();

    expect(store.error()).toBe('franchiseNetwork.error.tenant_missing');
    expect(store.loading()).toBe(false);
  });
});
