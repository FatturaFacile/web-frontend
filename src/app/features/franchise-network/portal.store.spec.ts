import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService } from '@core';
import { PortalStore } from './portal.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('PortalStore', () => {
  const api = {
    getPortalStores: vi.fn(),
    linkPortal: vi.fn(),
    getPortalContract: vi.fn(),
    getPortalSyncs: vi.fn(),
    acknowledgePortalSync: vi.fn(),
    getPortalStatements: vi.fn(),
    getPortalBenchmark: vi.fn(),
  };
  let store: InstanceType<typeof PortalStore>;

  const linked = () => {
    api.getPortalStores.mockReturnValue(ok({ stores: [{ id: 's1', code: 'MI-001' }] }));
    api.getPortalContract.mockReturnValue(ok({ store: { id: 's1' }, agreement: null, formula: null, purchases: [] }));
    api.getPortalSyncs.mockReturnValue(ok([{ id: 't1', status: 'synced' }]));
    api.getPortalStatements.mockReturnValue(ok({ statements: [], sell_out: [] }));
    api.getPortalBenchmark.mockReturnValue(ok({ period: '2028-03', cluster: 'medium', cluster_hidden: false, rows: [] }));
  };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [PortalStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(PortalStore);
  });

  it('loads the contract, syncs, statements and benchmark of the only linked store', async () => {
    linked();

    await store.load();

    expect(store.storeId()).toBe('s1');
    expect(api.getPortalContract).toHaveBeenCalledWith('s1');
    expect(store.syncs()).toHaveLength(1);
    expect(store.benchmark()?.period).toBe('2028-03');
    expect(store.loaded()).toBe(true);
  });

  it('shows no store data for a company that is not linked yet', async () => {
    api.getPortalStores.mockReturnValue(ok({ stores: [] }));

    await store.load();

    expect(store.stores()).toEqual([]);
    expect(store.contract()).toBeNull();
    expect(api.getPortalContract).not.toHaveBeenCalled();
    expect(store.loaded()).toBe(true);
  });

  it('links the company with the code of the franchisor and reloads the portal', async () => {
    api.getPortalStores.mockReturnValueOnce(ok({ stores: [] }));
    await store.load();
    linked();
    api.linkPortal.mockReturnValue(ok({ id: 's1' }));

    const outcome = await store.link('ABC123');

    expect(outcome.ok).toBe(true);
    expect(api.linkPortal).toHaveBeenCalledWith('ABC123');
    expect(store.contract()).not.toBeNull();
  });

  it('refuses a code that is invalid or already used', async () => {
    api.linkPortal.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'link_code_invalid' } })),
    );

    const outcome = await store.link('NOPE');

    expect(outcome.errorKey).toBe('franchiseNetwork.error.link_code_invalid');
    expect(store.saving()).toBe(false);
  });

  it('acknowledges a received push for the store in view and refreshes the list', async () => {
    linked();
    await store.load();
    api.acknowledgePortalSync.mockReturnValue(ok({ id: 't1', status: 'acknowledged' }));
    api.getPortalSyncs.mockReturnValue(ok([{ id: 't1', status: 'acknowledged' }]));

    const outcome = await store.acknowledge('t1');

    expect(outcome.ok).toBe(true);
    expect(api.acknowledgePortalSync).toHaveBeenCalledWith('t1', 's1');
    expect(store.syncs()[0].status).toBe('acknowledged');
  });

  it('loads the benchmark of another month', async () => {
    linked();
    await store.load();
    api.getPortalBenchmark.mockReturnValue(ok({ period: '2028-02', cluster: 'medium', cluster_hidden: true, rows: [] }));

    await store.loadBenchmark('2028-02');

    expect(api.getPortalBenchmark).toHaveBeenLastCalledWith('s1', '2028-02');
    expect(store.benchmark()?.cluster_hidden).toBe(true);
  });
});
