import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService, FrnPushCreatePayload } from '@core';
import { PushesStore } from './pushes.store';

const page = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('PushesStore', () => {
  const api = {
    listPushes: vi.fn(),
    getLookups: vi.fn(),
    getPush: vi.fn(),
    createPush: vi.fn(),
    dispatchPush: vi.fn(),
    retryPush: vi.fn(),
  };
  let store: InstanceType<typeof PushesStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listPushes.mockReturnValue(page([{ id: 'p1', status: 'draft' }]));
    api.getLookups.mockReturnValue(ok({ stores: [{ id: 's1' }] }));
    TestBed.configureTestingModule({
      providers: [PushesStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(PushesStore);
  });

  it('loads the pushes and the stores the selection offers', async () => {
    await store.load();

    expect(store.pushes()).toHaveLength(1);
    expect(store.stores()).toHaveLength(1);
  });

  it('creates a push for the whole network in one call and reloads the monitor', async () => {
    api.createPush.mockReturnValue(ok({ id: 'p2' }));
    const payload: FrnPushCreatePayload = {
      push_type: 'promotion',
      title: 'Black Friday',
      target_mode: 'all',
      payload: { promotion: { name: 'Black Friday', valid_from: '2028-11-24', valid_to: '2028-11-27' } },
      dispatch: true,
    };

    const outcome = await store.create(payload);

    expect(outcome.ok).toBe(true);
    expect(api.createPush).toHaveBeenCalledWith(payload);
    expect(api.listPushes).toHaveBeenCalledTimes(1);
  });

  it('keeps the push the monitor shows up to date after a retry', async () => {
    api.retryPush.mockReturnValue(ok({ id: 'p1', status: 'completed', targets: [{ id: 't1', status: 'synced' }] }));

    await store.retry('p1');

    expect(store.detail()?.status).toBe('completed');
  });

  it('reports a push that has nothing left to retry', async () => {
    api.retryPush.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'push_nothing_to_retry' } })),
    );

    const outcome = await store.retry('p1');

    expect(outcome.errorKey).toBe('franchiseNetwork.error.push_nothing_to_retry');
    expect(store.saving()).toBe(false);
  });

  it('opens the delivery monitor of a push and closes it', async () => {
    api.getPush.mockReturnValue(ok({ id: 'p1', targets: [{ id: 't1', status: 'failed' }] }));

    await store.openDetail('p1');
    expect(store.detail()?.targets).toHaveLength(1);

    store.closeDetail();
    expect(store.detail()).toBeNull();
  });
});
