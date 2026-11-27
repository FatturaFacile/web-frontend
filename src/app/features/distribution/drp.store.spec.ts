import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { DrpStore } from './drp.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('DrpStore', () => {
  const api = {
    getLookups: vi.fn(),
    listDrpRuns: vi.fn(),
    getDrpGrid: vi.fn(),
    listDrpAlerts: vi.fn(),
    runDrp: vi.fn(),
  };
  const run1 = { id: 'r1', run_number: 'DRP-1', bucket_type: 'weekly', horizon: 8 };
  const run2 = { id: 'r2', run_number: 'DRP-2', bucket_type: 'daily', horizon: 14 };
  let store: InstanceType<typeof DrpStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(ok({ warehouses: [], items: [] }));
    api.listDrpRuns.mockReturnValue(ok([run1]));
    api.getDrpGrid.mockReturnValue(ok({ buckets: [], rows: [] }));
    api.listDrpAlerts.mockReturnValue(ok([{ id: 'a1' }]));
    TestBed.configureTestingModule({
      providers: [DrpStore, { provide: DistributionApiService, useValue: api }],
    });
    store = TestBed.inject(DrpStore);
  });

  it('opens the latest run with its grid and alerts', async () => {
    await store.init();

    expect(store.run()?.id).toBe('r1');
    expect(store.grid()).toEqual({ buckets: [], rows: [] });
    expect(store.alerts()).toHaveLength(1);
    expect(api.getDrpGrid).toHaveBeenCalledWith('r1', null, null);
  });

  it('shows an empty planning when there is no run yet', async () => {
    api.listDrpRuns.mockReturnValue(ok([]));

    await store.init();

    expect(store.run()).toBeNull();
    expect(store.grid()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('narrows the grid to a warehouse and an item', async () => {
    await store.init();

    await store.setScope('w1', 'i1');

    expect(api.getDrpGrid).toHaveBeenLastCalledWith('r1', 'w1', 'i1');
  });

  it('runs the DRP with the bucket, the horizon and the scope, then opens the new run', async () => {
    await store.init();
    api.runDrp.mockReturnValue(ok(run2));
    api.listDrpRuns.mockReturnValue(ok([run2, run1]));
    store.setBucket('daily', 14);
    await store.setScope('w1', null);

    const outcome = await store.execute();

    expect(outcome.ok).toBe(true);
    expect(api.runDrp).toHaveBeenCalledWith({
      bucket_type: 'daily',
      horizon: 14,
      warehouse_ids: ['w1'],
    });
    expect(store.run()?.id).toBe('r2');
    expect(store.runs()).toHaveLength(2);
    expect(store.running()).toBe(false);
  });

  it('keeps the error of a failed run and stops the spinner', async () => {
    api.runDrp.mockReturnValue(throwError(() => new Error('boom')));

    const outcome = await store.execute();

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('distribution.error.generic');
    expect(store.running()).toBe(false);
  });

  it('switches to another run of the history', async () => {
    api.listDrpRuns.mockReturnValue(ok([run1, run2]));
    await store.init();

    await store.selectRun('r2');

    expect(store.run()?.id).toBe('r2');
    await store.selectRun('missing');
    expect(store.run()?.id).toBe('r2');
  });
});
