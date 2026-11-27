import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { ConsignmentStore } from './consignment.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('ConsignmentStore', () => {
  const api = {
    getLookups: vi.fn(),
    listConsignmentStock: vi.fn(),
    listSettlements: vi.fn(),
    listReconciliations: vi.fn(),
    createSettlement: vi.fn(),
    createConsignmentReturn: vi.fn(),
    createReconciliation: vi.fn(),
  };
  let store: InstanceType<typeof ConsignmentStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(ok({ warehouses: [] }));
    api.listConsignmentStock.mockReturnValue(
      of({ success: true, message: '', data: [{ quantity: 4 }], meta: { total_value: '120.50' } }),
    );
    api.listSettlements.mockReturnValue(ok([{ id: 's1' }]));
    api.listReconciliations.mockReturnValue(ok([{ id: 'x1' }]));
    TestBed.configureTestingModule({
      providers: [ConsignmentStore, { provide: DistributionApiService, useValue: api }],
    });
    store = TestBed.inject(ConsignmentStore);
  });

  it('loads the stock held at third parties with its value, the settlements and the reconciliations', async () => {
    await store.init();

    expect(api.listConsignmentStock).toHaveBeenCalledWith('out');
    expect(store.stock()).toHaveLength(1);
    expect(store.totalValue()).toBe(120.5);
    expect(store.settlements()).toHaveLength(1);
    expect(store.reconciliations()).toHaveLength(1);
  });

  it('switches to the stock held from third parties', async () => {
    await store.setDirection('in');

    expect(api.listConsignmentStock).toHaveBeenCalledWith('in');
    expect(store.direction()).toBe('in');
  });

  it('records a settlement, a return and a 3PL reconciliation and reloads each time', async () => {
    api.createSettlement.mockReturnValue(ok());
    api.createConsignmentReturn.mockReturnValue(ok());
    api.createReconciliation.mockReturnValue(ok());

    expect(
      (
        await store.settle({
          warehouse_id: 'w',
          lines: [{ stock_item_id: 'i', quantity: 2, unit_price: 9 }],
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await store.giveBack({
          warehouse_id: 'w',
          destination_warehouse_id: 'c',
          lines: [{ stock_item_id: 'i', quantity: 1 }],
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await store.reconcile({
          warehouse_id: 'w3',
          lines: [{ stock_item_id: 'i', external_quantity: 5 }],
        })
      ).ok,
    ).toBe(true);

    expect(api.listConsignmentStock).toHaveBeenCalledTimes(3);
    expect(api.createReconciliation).toHaveBeenCalledWith({
      warehouse_id: 'w3',
      lines: [{ stock_item_id: 'i', external_quantity: 5 }],
    });
  });
});
