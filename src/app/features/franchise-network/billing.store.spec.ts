import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService } from '@core';
import { BillingStore } from './billing.store';

const page = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('BillingStore', () => {
  const api = {
    getLookups: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    listSellOut: vi.fn(),
    getLoyaltySettlement: vi.fn(),
    calculateRun: vi.fn(),
    invoiceRun: vi.fn(),
    saveSellOut: vi.fn(),
  };
  let store: InstanceType<typeof BillingStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(ok({ stores: [{ id: 's1', code: 'MI-001' }] }));
    api.listRuns.mockReturnValue(page([]));
    api.listSellOut.mockReturnValue(page([{ id: 'r1', store_id: 's1', net_sales: '1000.00' }]));
    api.getLoyaltySettlement.mockReturnValue(ok([{ store_id: 's1', net: '12.00' }]));
    TestBed.configureTestingModule({
      providers: [BillingStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(BillingStore);
  });

  it('loads the sell-out and the loyalty position of the month, and the run when there is one', async () => {
    api.listRuns.mockReturnValue(page([{ id: 'run1', period: store.period() }]));
    api.getRun.mockReturnValue(ok({ id: 'run1', period: store.period(), statements: [] }));

    await store.load();

    expect(store.stores()).toHaveLength(1);
    expect(store.sellOut()).toHaveLength(1);
    expect(store.loyalty()).toHaveLength(1);
    expect(store.run()?.id).toBe('run1');
    expect(store.loading()).toBe(false);
  });

  it('changing the month clears the run and reloads what depends on it', async () => {
    await store.setPeriod('2028-02');

    expect(store.period()).toBe('2028-02');
    expect(store.run()).toBeNull();
    expect(api.listSellOut).toHaveBeenCalledWith('2028-02');
    expect(api.getLoyaltySettlement).toHaveBeenCalledWith('2028-02');
  });

  it('calculates the run of the month and keeps it for review', async () => {
    api.calculateRun.mockReturnValue(ok({ id: 'run1', status: 'calculated', total_net: '1500.00' }));

    const outcome = await store.calculate();

    expect(outcome.ok).toBe(true);
    expect(api.calculateRun).toHaveBeenCalledWith(store.period());
    expect(store.run()?.status).toBe('calculated');
  });

  it('invoices the calculated run', async () => {
    api.calculateRun.mockReturnValue(ok({ id: 'run1', status: 'calculated' }));
    api.invoiceRun.mockReturnValue(ok({ id: 'run1', status: 'invoiced', batches: [] }));
    await store.calculate();

    const outcome = await store.invoice();

    expect(outcome.ok).toBe(true);
    expect(api.invoiceRun).toHaveBeenCalledWith('run1');
    expect(store.run()?.status).toBe('invoiced');
  });

  it('reports the stores that cannot be invoiced', async () => {
    api.calculateRun.mockReturnValue(ok({ id: 'run1', status: 'calculated' }));
    api.invoiceRun.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'store_without_customer', params: { stores: 'MI-001' } },
          }),
      ),
    );
    await store.calculate();

    const outcome = await store.invoice();

    expect(outcome.ok).toBe(false);
    expect(outcome.params).toEqual({ stores: 'MI-001' });
    expect(store.run()?.status).toBe('calculated');
  });

  it('records the sell-out of a store for the month in view', async () => {
    api.saveSellOut.mockReturnValue(ok());
    const payload = {
      gross_sales: 1000,
      returns: 0,
      discounts: 0,
      tickets_count: 25,
      visitors_count: 80,
      cost_of_goods_sold: 500,
      average_inventory_value: 2000,
      source: 'pos' as const,
    };

    const outcome = await store.saveSellOut('s1', payload);

    expect(outcome.ok).toBe(true);
    expect(api.saveSellOut).toHaveBeenCalledWith('s1', store.period(), payload);
  });
});
