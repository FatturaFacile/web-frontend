import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService } from '@core';
import { ReceivablesDashboardStore } from './receivables-dashboard.store';
import { dashboard } from './receivables.fixtures';

describe('ReceivablesDashboardStore', () => {
  let api: { getDashboard: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof ReceivablesDashboardStore>;

  beforeEach(() => {
    api = { getDashboard: vi.fn(() => of({ data: dashboard })) };
    TestBed.configureTestingModule({
      providers: [ReceivablesDashboardStore, { provide: ReceivablesApiService, useValue: api }],
    });
    store = TestBed.inject(ReceivablesDashboardStore);
  });

  it('loads the dashboard and derives the kpis, buckets and currencies', async () => {
    await store.load();

    expect(api.getDashboard).toHaveBeenCalledWith(undefined);
    expect(store.loading()).toBe(false);
    expect(store.kpis()?.total_exposure).toBe('2500.00');
    expect(store.buckets().map((bucket) => bucket.key)).toEqual([
      'current',
      '1_30',
      '31_60',
      '121_plus',
    ]);
    expect(store.availableCurrencies()).toEqual(['EUR', 'CHF']);
    expect(store.activeCurrency()).toBe('EUR');
    expect(store.hasData()).toBe(true);
    expect(store.isEmpty()).toBe(false);
  });

  it('builds the chart bars from the buckets of the response, scaled on the biggest', async () => {
    await store.load();

    expect(store.bars().map((bar) => [bar.bucket.key, bar.amount, bar.share])).toEqual([
      ['current', '1000.00', 100],
      ['1_30', '500.00', 50],
      ['31_60', '250.00', 25],
      ['121_plus', '0.00', 0],
    ]);
  });

  it('lists the customers with the biggest open amount first', async () => {
    await store.load();

    expect(store.customers().map((row) => row.customer_id)).toEqual(['c-2', 'c-1']);
  });

  it('adds the customer name to the blocked customers', async () => {
    await store.load();

    expect(store.blocked()).toEqual([
      {
        customer_id: 'c-1',
        reason: 'over_limit',
        exposure: '2500.00',
        limit: '2000.00',
        customer_name: 'Rossi SRL',
      },
    ]);
  });

  it('reloads in another currency and keeps it for a refresh', async () => {
    await store.setCurrency('CHF');
    expect(api.getDashboard).toHaveBeenLastCalledWith('CHF');
    expect(store.activeCurrency()).toBe('CHF');

    await store.refresh();
    expect(api.getDashboard).toHaveBeenLastCalledWith('CHF');
  });

  it('keeps the last good data and reports the message when a reload fails', async () => {
    await store.load();
    api.getDashboard.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Server down' } })),
    );

    await store.refresh();

    expect(store.error()).toBe('Server down');
    expect(store.loading()).toBe(false);
    expect(store.hasData()).toBe(true);
  });

  it('falls back to a translation key when the error has no message', async () => {
    api.getDashboard.mockReturnValueOnce(throwError(() => new Error('network')));

    await store.load();

    expect(store.error()).toBe('AR.LOAD_ERROR');
    expect(store.hasData()).toBe(false);
  });

  it('ignores the answer of a superseded load', async () => {
    const slow = new Subject<{ data: typeof dashboard }>();
    api.getDashboard.mockReturnValueOnce(slow);

    const first = store.load('USD');
    await store.load('CHF');
    slow.next({ data: { ...dashboard, currency: 'USD' } });
    slow.complete();
    await first;

    expect(store.dashboard()?.currency).toBe('EUR');
    expect(store.currency()).toBe('CHF');
  });
});
