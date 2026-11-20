import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AiForecastingStore } from './ai-forecasting.store';
import {
  accuracyFixture,
  bandsFixture,
  paymentModelFixture,
  runFixture,
  skuForecastFixture,
} from './ai-forecasting.testing';

const base = '/api/v1/forecasting';
const envelope = <T>(data: T) => ({ success: true, message: '', data });

describe('AiForecastingStore', () => {
  let store: AiForecastingStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AiForecastingStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the bands of the horizon and the risk table together', () => {
    store.loadLiquidity().subscribe();
    expect(store.loading()).toBe(true);

    const request = http.expectOne((req) => req.url === `${base}/liquidity/confidence-bands`);
    expect(request.request.params.get('horizon_days')).toBe('91');
    request.flush(envelope(bandsFixture()));
    http.expectOne(`${base}/payment-models`).flush(envelope([paymentModelFixture()]));

    expect(store.loading()).toBe(false);
    expect(store.bands()?.run_id).toBe('run-1');
    expect(store.noRun()).toBe(false);
    expect(store.paymentModels()).toHaveLength(1);
    expect(store.troughAlert()).toBe(true);
    // p50 balances 1,500, 1,000, 500, 0, -500: negative on the fifth day.
    expect(store.runway()).toBe(5);
  });

  it('treats a tenant without a run as an empty state, not an error', () => {
    let failed = false;
    store.loadLiquidity().subscribe({ error: () => (failed = true) });

    http
      .expectOne((req) => req.url === `${base}/liquidity/confidence-bands`)
      .flush({ title: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    http.expectOne(`${base}/payment-models`).flush(envelope([]));

    expect(failed).toBe(false);
    expect(store.bands()).toBeNull();
    expect(store.noRun()).toBe(true);
    expect(store.runway()).toBeNull();
  });

  it('passes a server error on', () => {
    let failed = false;
    store.loadLiquidity().subscribe({ error: () => (failed = true) });

    http
      .expectOne((req) => req.url === `${base}/liquidity/confidence-bands`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    http.match(`${base}/payment-models`);

    expect(failed).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('asks for the other horizon and drops the preview when it changes', () => {
    store.preview.set(runFixture());
    store.setHorizon(365);
    store.loadLiquidity().subscribe();

    expect(store.preview()).toBeNull();
    const request = http.expectOne((req) => req.url === `${base}/liquidity/confidence-bands`);
    expect(request.request.params.get('horizon_days')).toBe('365');
    request.flush(envelope(bandsFixture({ horizon_days: 365 })));
    http.expectOne(`${base}/payment-models`).flush(envelope([]));
  });

  it('trains the models and stores a fresh run in one action', () => {
    store.preview.set(runFixture());
    let stored: unknown;
    store.refreshLiquidity().subscribe((run) => (stored = run));
    expect(store.busy()).toBe(true);

    http
      .expectOne(`${base}/payment-models/train`)
      .flush(envelope({ models_trained: 4, invoices_updated: 12 }));
    const simulation = http.expectOne(`${base}/liquidity/simulate`);
    expect(simulation.request.body).toEqual({ horizon_days: 91, preview: false });
    simulation.flush(envelope(runFixture()));

    expect(stored).toBeTruthy();
    expect(store.busy()).toBe(false);
    expect(store.preview()).toBeNull();
  });

  it('previews a what-if without storing it and measures the change of the trough', () => {
    store.bands.set(bandsFixture());
    store
      .previewWhatIf({
        global_customer_delay_shift_days: 15,
        revenue_growth_percentage: 0,
        supplier_payment_extension_days: 0,
        interest_rate_delta: 0,
      })
      .subscribe();
    expect(store.previewing()).toBe(true);

    const request = http.expectOne(`${base}/liquidity/simulate`);
    expect(request.request.body).toEqual({
      horizon_days: 91,
      preview: true,
      what_if: {
        global_customer_delay_shift_days: 15,
        revenue_growth_percentage: 0,
        supplier_payment_extension_days: 0,
        interest_rate_delta: 0,
      },
    });
    request.flush(envelope(runFixture({ trough: { date: '2028-01-06', balance: -2000 } })));

    expect(store.previewing()).toBe(false);
    expect(store.preview()?.id).toBe('run-2');
    expect(store.previewDelta()).toBe(-1500);

    store.resetPreview();
    expect(store.previewDelta()).toBeNull();
  });

  it('loads the replenishment grid with the accuracy and sends the filters', () => {
    store.setDemandFilters({ warehouse_id: 'w-1', search: 'housing' });
    store.loadDemand().subscribe();

    const grid = http.expectOne((req) => req.url === `${base}/demand/forecasts`);
    expect(grid.request.params.get('warehouse_id')).toBe('w-1');
    expect(grid.request.params.get('search')).toBe('housing');
    grid.flush(
      envelope([
        skuForecastFixture(),
        skuForecastFixture({ forecast_id: 'f-2', warehouse_id: 'w-2', warehouse_name: null }),
      ]),
    );
    http.expectOne(`${base}/demand/accuracy`).flush(envelope(accuracyFixture()));

    expect(store.demandRows()).toHaveLength(2);
    expect(store.accuracy()?.global.mape).toBe(4.44);
    expect(store.warehouses()).toEqual([
      { id: 'w-1', name: 'Main warehouse' },
      { id: 'w-2', name: 'w-2' },
    ]);
  });

  it('generates the forecast of the chosen number of months', () => {
    store.generateDemand(3).subscribe();
    const request = http.expectOne(`${base}/demand/generate`);

    expect(request.request.body).toEqual({ periods_ahead: 3 });
    request.flush(envelope([]));
    expect(store.busy()).toBe(false);
  });

  it('selects rows, drops the selection of rows that disappear and selects all', () => {
    store.demandRows.set([skuForecastFixture(), skuForecastFixture({ forecast_id: 'f-2' })]);

    store.toggleSelected('f-1', true);
    expect(store.selectedRows().map((row) => row.forecast_id)).toEqual(['f-1']);
    store.selectAll(true);
    expect(store.selectedRows()).toHaveLength(2);
    store.toggleSelected('f-2', false);
    expect(store.selectedForecastIds().has('f-2')).toBe(false);
    store.selectAll(false);
    expect(store.selectedRows()).toHaveLength(0);

    store.toggleSelected('gone', true);
    store.loadDemand().subscribe();
    http
      .expectOne((req) => req.url === `${base}/demand/forecasts`)
      .flush(envelope([skuForecastFixture()]));
    http.expectOne(`${base}/demand/accuracy`).flush(envelope(accuracyFixture()));
    expect(store.selectedForecastIds().has('gone')).toBe(false);
  });

  it('applies the reorder rules, marks the rows applied and clears their selection', () => {
    store.demandRows.set([
      skuForecastFixture(),
      skuForecastFixture({ forecast_id: 'f-2', sku: 'SKU-002' }),
    ]);
    store.selectAll(true);
    store.applyReorderRules(['f-1']).subscribe();
    expect(store.busy()).toBe(true);

    const request = http.expectOne(`${base}/demand/apply-reorder-rules`);
    expect(request.request.body).toEqual({ forecast_ids: ['f-1'] });
    request.flush(
      envelope([
        {
          forecast_id: 'f-1',
          product_id: 'p-1',
          warehouse_id: 'w-1',
          reorder_point: 145.4,
          safety_stock: 61,
          reorder_rule_id: 'r-1',
          planning_items_updated: 1,
        },
      ]),
    );

    const [applied, other] = store.demandRows();
    expect(applied.applied_to_wms_at).not.toBeNull();
    expect(applied.current_reorder_point).toBe(145.4);
    expect(applied.current_safety_stock).toBe(61);
    expect(other.applied_to_wms_at).toBeNull();
    expect([...store.selectedForecastIds()]).toEqual(['f-2']);
    expect(store.busy()).toBe(false);
  });

  it('keeps the busy flag honest when applying fails', () => {
    store.applyReorderRules(['f-1']).subscribe({ error: () => undefined });
    http
      .expectOne(`${base}/demand/apply-reorder-rules`)
      .flush({}, { status: 403, statusText: 'Forbidden' });

    expect(store.busy()).toBe(false);
  });
});
