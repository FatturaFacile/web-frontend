import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { AtpStore } from './atp.store';
import { InTransitStore } from './in-transit.store';
import { OverviewStore } from './overview.store';
import { ReplenishmentStore } from './replenishment.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('distribution overview, in-transit, replenishment and ATP stores', () => {
  const api = {
    getDashboard: vi.fn(),
    getLookups: vi.fn(),
    listInTransit: vi.fn(),
    listRules: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    getAtp: vi.fn(),
    getAtpMatrix: vi.fn(),
    listChannels: vi.fn(),
  };

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(ok({ warehouses: [], items: [] }));
    TestBed.configureTestingModule({
      providers: [
        OverviewStore,
        InTransitStore,
        ReplenishmentStore,
        AtpStore,
        { provide: DistributionApiService, useValue: api },
      ],
    });
  });

  it('loads the dashboard and keeps the translation key of a failure', async () => {
    const store = TestBed.inject(OverviewStore);
    api.getDashboard.mockReturnValueOnce(ok({ active_transfers: 3, overdue: [] }));

    await store.load();
    expect(store.dashboard()?.active_transfers).toBe(3);

    api.getDashboard.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'forbidden' } })),
    );
    await store.load();
    expect(store.error()).toBe('distribution.error.forbidden');
    expect(store.loading()).toBe(false);
  });

  it('lists the goods in transit with the totals and re-queries on every filter change', async () => {
    const store = TestBed.inject(InTransitStore);
    api.listInTransit.mockReturnValue(
      of({
        success: true,
        message: '',
        data: [{ transfer_id: 't' }],
        meta: { total_units: '12.5', total_value: 300 },
      }),
    );

    await store.init();
    expect(store.lines()).toHaveLength(1);
    expect(store.totalUnits()).toBe(12.5);
    expect(store.totalValue()).toBe(300);

    await store.setFilters({ overdue: true, stock_item_id: 'i1' });
    expect(api.listInTransit).toHaveBeenLastCalledWith({ overdue: true, stock_item_id: 'i1' });
  });

  it('saves and removes replenishment rules and reloads the list', async () => {
    const store = TestBed.inject(ReplenishmentStore);
    api.listRules.mockReturnValue(ok([{ id: 'r1' }]));
    api.createRule.mockReturnValue(ok());
    api.updateRule.mockReturnValue(ok());
    api.deleteRule.mockReturnValue(ok(null));
    const payload = {
      warehouse_id: 'w',
      stock_item_id: 'i',
      policy: 'min_max' as const,
      safety_stock: 5,
      reorder_point: 10,
      max_stock: 50,
      lead_time_days: 2,
      priority: 1,
    };

    await store.load();
    expect(store.rules()).toHaveLength(1);
    expect((await store.save(payload)).ok).toBe(true);
    expect(api.createRule).toHaveBeenCalledWith(payload);
    expect((await store.save(payload, 'r1')).ok).toBe(true);
    expect(api.updateRule).toHaveBeenCalledWith('r1', payload);
    expect((await store.remove('r1')).ok).toBe(true);
    expect(api.listRules).toHaveBeenCalledTimes(4);
  });

  it('shows the ATP matrix and the breakdown of an item per channel', async () => {
    const store = TestBed.inject(AtpStore);
    api.getAtpMatrix.mockReturnValue(ok({ channels: [{ id: 'c1' }], rows: [] }));
    api.listChannels.mockReturnValue(ok([{ id: 'c1' }]));
    api.getAtp.mockReturnValue(ok({ stock_item: { id: 'i1' }, channels: [] }));

    await store.init();
    expect(store.matrix()?.channels).toHaveLength(1);

    await store.inspect('i1', 'c1');
    expect(api.getAtp).toHaveBeenCalledWith('i1', 'c1');
    expect(store.breakdown()?.stock_item.id).toBe('i1');

    await store.inspect(null);
    expect(store.breakdown()).toBeNull();
  });
});
