import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { TransfersStore } from './transfers.store';

const page = (data: unknown[], meta: Record<string, unknown> = {}) =>
  of({ success: true, message: '', data, meta });
const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('TransfersStore', () => {
  const api = {
    listTransfers: vi.fn(),
    getLookups: vi.fn(),
    listLanes: vi.fn(),
    getAvailability: vi.fn(),
    createTransfer: vi.fn(),
    approveTransfer: vi.fn(),
    dispatchTransfer: vi.fn(),
    receiveTransfer: vi.fn(),
    cancelTransfer: vi.fn(),
  };
  let store: InstanceType<typeof TransfersStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listTransfers.mockReturnValue(
      page([{ id: 't1' }], { total: 1, status_counts: { draft: 1 } }),
    );
    api.getLookups.mockReturnValue(ok({ warehouses: [], items: [] }));
    api.listLanes.mockReturnValue(
      ok([
        {
          id: 'l1',
          source_warehouse_id: 'a',
          destination_warehouse_id: 'b',
          lead_time_days: 2,
          lead_time_hours: 0,
          is_active: true,
        },
        {
          id: 'l2',
          source_warehouse_id: 'a',
          destination_warehouse_id: 'c',
          lead_time_days: 5,
          lead_time_hours: 0,
          is_active: false,
        },
      ]),
    );
    TestBed.configureTestingModule({
      providers: [TransfersStore, { provide: DistributionApiService, useValue: api }],
    });
    store = TestBed.inject(TransfersStore);
  });

  it('loads the transfers with the status counts of the tabs', async () => {
    await store.load();

    expect(store.transfers()).toHaveLength(1);
    expect(store.statusCounts()).toEqual({ draft: 1 });
    expect(store.total()).toBe(1);
  });

  it('filters by status and search and goes back to the first page', async () => {
    await store.setPage(3);
    await store.setStatus('in_transit');
    expect(api.listTransfers).toHaveBeenLastCalledWith({ status: 'in_transit', q: null, page: 1 });

    await store.setQuery('TO-1');
    expect(api.listTransfers).toHaveBeenLastCalledWith({
      status: 'in_transit',
      q: 'TO-1',
      page: 1,
    });
  });

  it('finds the active lane between two warehouses for the lead time auto-fill', async () => {
    await store.loadReferences();

    expect(store.laneBetween('a', 'b')?.lead_time_days).toBe(2);
    expect(store.laneBetween('a', 'c')).toBeNull();
    expect(store.laneBetween(null, 'b')).toBeNull();
  });

  it('reads the live availability of the source and tolerates a failure', async () => {
    api.getAvailability
      .mockReturnValueOnce(ok({ available: 4 }))
      .mockReturnValueOnce(throwError(() => new Error('x')));

    expect(await store.availability('w', 'i')).toEqual({ available: 4 });
    expect(await store.availability('w', 'i')).toBeNull();
  });

  it('runs each workflow action and reloads the list', async () => {
    for (const mock of [
      api.createTransfer,
      api.approveTransfer,
      api.dispatchTransfer,
      api.receiveTransfer,
      api.cancelTransfer,
    ]) {
      mock.mockReturnValue(ok());
    }

    expect(
      (await store.create({ source_warehouse_id: 'a', destination_warehouse_id: 'b', lines: [] }))
        .ok,
    ).toBe(true);
    expect((await store.approve('t1')).ok).toBe(true);
    expect((await store.dispatch('t1', { carrier: 'DHL' })).ok).toBe(true);
    expect(
      (await store.receive('t1', { lines: [{ line_id: 'l', quantity: 1 }], final: true })).ok,
    ).toBe(true);
    expect((await store.cancel('t1')).ok).toBe(true);

    expect(api.dispatchTransfer).toHaveBeenCalledWith('t1', { carrier: 'DHL' });
    expect(api.listTransfers).toHaveBeenCalledTimes(5);
  });

  it('reports a refusal with its translation key and does not reload', async () => {
    api.dispatchTransfer.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'insufficient_stock' } }),
      ),
    );

    const outcome = await store.dispatch('t1', {});

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('distribution.error.insufficient_stock');
    expect(store.saving()).toBe(false);
    expect(api.listTransfers).not.toHaveBeenCalled();
  });

  it('keeps the translation key of a failed list load', async () => {
    api.listTransfers.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await store.load();

    expect(store.error()).toBe('distribution.error.generic');
    expect(store.loading()).toBe(false);
  });
});
