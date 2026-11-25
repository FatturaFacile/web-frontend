import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerSatisfactionApiService } from '@core';
import { RecoveryStore } from './recovery.store';

const list = (data: unknown[]) =>
  of({ success: true, message: '', data, meta: { total: data.length } });

describe('RecoveryStore', () => {
  const api = {
    listRecoveryCases: vi.fn(),
    transitionRecoveryCase: vi.fn(),
    assignRecoveryCase: vi.fn(),
    getLookups: vi.fn(),
  };
  let store: InstanceType<typeof RecoveryStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listRecoveryCases.mockReturnValue(list([{ id: 'c1', status: 'open' }]));
    TestBed.configureTestingModule({
      providers: [RecoveryStore, { provide: CustomerSatisfactionApiService, useValue: api }],
    });
    store = TestBed.inject(RecoveryStore);
  });

  it('opens on the open cases and reloads with the chosen filters', async () => {
    await store.load();
    expect(api.listRecoveryCases).toHaveBeenLastCalledWith({ open_only: true });

    await store.load({ priority: 'urgent' });

    expect(api.listRecoveryCases).toHaveBeenLastCalledWith({ priority: 'urgent' });
    expect(store.cases()).toHaveLength(1);
    expect(store.filters()).toEqual({ priority: 'urgent' });
  });

  it('moves a case through the workflow with its root cause and resolution, then reloads the queue', async () => {
    api.transitionRecoveryCase.mockReturnValue(of({ success: true, message: '', data: {} }));
    await store.load();

    const outcome = await store.transition('c1', {
      status: 'resolved',
      root_cause_code: 'delivery_delay',
      resolution_summary: 'Refund and a call',
    });

    expect(outcome.ok).toBe(true);
    expect(api.transitionRecoveryCase).toHaveBeenCalledWith('c1', {
      status: 'resolved',
      root_cause_code: 'delivery_delay',
      resolution_summary: 'Refund and a call',
    });
    expect(api.listRecoveryCases).toHaveBeenCalledTimes(2);
  });

  it('answers a refused transition with the key of the code of the problem', async () => {
    api.transitionRecoveryCase.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'resolution_requires_root_cause', detail: 'Needs root cause' },
          }),
      ),
    );

    const outcome = await store.transition('c1', { status: 'closed' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('customerSatisfaction.error.resolution_requires_root_cause');
    expect(store.saving()).toBe(false);
  });

  it('assigns the account manager and the support lead', async () => {
    api.assignRecoveryCase.mockReturnValue(of({ success: true, message: '', data: {} }));

    const payload = { assigned_account_manager_id: 'u1', assigned_support_lead_id: 'u2' };
    const outcome = await store.assign('c1', payload);

    expect(outcome.ok).toBe(true);
    expect(api.assignRecoveryCase).toHaveBeenCalledWith('c1', payload);
  });

  it('loads the lookups once', async () => {
    api.getLookups.mockReturnValue(of({ success: true, message: '', data: { members: [] } }));

    await store.loadLookups();
    await store.loadLookups();

    expect(api.getLookups).toHaveBeenCalledTimes(1);
  });
});
