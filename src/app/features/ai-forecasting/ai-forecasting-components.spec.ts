import { HttpErrorResponse } from '@angular/common/http';
import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { AiForecastingApiService } from './ai-forecasting-api.service';
import { AiForecastingStore } from './ai-forecasting.store';
import {
  accuracyFixture,
  bandsFixture,
  paymentModelFixture,
  runFixture,
  skuForecastFixture,
} from './ai-forecasting.testing';
import { DemandForecastComponent } from './demand-forecast.component';
import { ForecastChartComponent } from './forecast-chart.component';
import { LiquidityForecastComponent } from './liquidity-forecast.component';

const ok = <T>(data: T) => of({ success: true, message: '', data });

/** ECharts needs a canvas, which jsdom does not have: the views are tested against the option they pass to the chart. */
@Component({ selector: 'app-forecast-chart', template: '' })
class ChartStubComponent {
  readonly option = input<unknown>(null);
  readonly label = input<string>('');
  readonly testId = input<string>('');
}

function configure(api: Record<string, ReturnType<typeof vi.fn>>, message: object): void {
  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      { provide: AiForecastingApiService, useValue: api },
      { provide: NzMessageService, useValue: message },
    ],
  });
}

function stubChart(
  component: typeof LiquidityForecastComponent | typeof DemandForecastComponent,
): void {
  TestBed.overrideComponent(component, {
    remove: { imports: [ForecastChartComponent] },
    add: { imports: [ChartStubComponent] },
  });
}

function text(fixture: ComponentFixture<unknown>, testId: string): string {
  return (
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)
      ?.textContent ?? ''
  );
}

describe('liquidity forecast view', () => {
  const message = { success: vi.fn(), error: vi.fn() };
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<LiquidityForecastComponent>;
  let store: AiForecastingStore;

  interface Internals {
    onHorizon(days: number): void;
    patch(change: object): void;
    refresh(): void;
    reset(): void;
    whatIf(): { global_customer_delay_shift_days: number };
  }
  const view = (): Internals => fixture.componentInstance as unknown as Internals;

  async function create(): Promise<void> {
    stubChart(LiquidityForecastComponent);
    fixture = TestBed.createComponent(LiquidityForecastComponent);
    store = TestBed.inject(AiForecastingStore);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      confidenceBands: vi.fn(() => ok(bandsFixture())),
      paymentModels: vi.fn(() =>
        ok([
          paymentModelFixture(),
          paymentModelFixture({
            id: 'm-2',
            customer_id: 'c-2',
            customer_name: 'Alpenbau AG',
            payment_risk_tier: 'low',
            average_days_late: -1,
            on_time_payment_probability: 0.9,
            open_invoices: [],
          }),
        ]),
      ),
      trainPaymentModels: vi.fn(() => ok({ models_trained: 4, invoices_updated: 12 })),
      simulate: vi.fn(() => ok(runFixture())),
    };
    configure(api, message);
  });

  afterEach(() => vi.useRealTimers());

  it('loads the 13-week bands and the risk table on init', async () => {
    await create();

    expect(api['confidenceBands']).toHaveBeenCalledWith(91);
    expect(api['paymentModels']).toHaveBeenCalledTimes(1);
    expect(store.bands()?.run_id).toBe('run-1');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="risk-table"] tbody tr'),
    ).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="risk-table"] nz-tag'),
    ).toHaveLength(2);
    expect(text(fixture, 'risk-table')).toContain('Romandie Retail SA');
    expect(text(fixture, 'key-drivers')).toContain('INV-1');
  });

  it('alerts when the expected cash drops below zero and shows the runway', async () => {
    await create();

    expect(fixture.nativeElement.querySelector('[data-testid="trough-alert"]')).not.toBeNull();
    expect(text(fixture, 'runway')).toContain('AI_FORECAST.RUNWAY_DAYS');
  });

  it('shows no alert when the cash stays positive', async () => {
    api['confidenceBands'].mockReturnValue(
      ok(bandsFixture({ p50: [5, 4, 3, 2, 1], trough: { date: '2028-01-06', balance: 1 } })),
    );
    await create();

    expect(fixture.nativeElement.querySelector('[data-testid="trough-alert"]')).toBeNull();
    expect(text(fixture, 'runway')).toContain('AI_FORECAST.RUNWAY_SAFE');
  });

  it('switches to 12 months and reloads the bands', async () => {
    await create();
    view().onHorizon(365);

    expect(store.horizon()).toBe(365);
    expect(api['confidenceBands']).toHaveBeenLastCalledWith(365);
  });

  it('offers to run a simulation when the tenant has none yet', async () => {
    api['confidenceBands'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await create();

    expect(fixture.nativeElement.querySelector('[data-testid="no-run"]')).not.toBeNull();

    api['confidenceBands'].mockReturnValue(ok(bandsFixture()));
    (
      fixture.nativeElement.querySelector('[data-testid="run-simulation"]') as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(api['trainPaymentModels']).toHaveBeenCalledTimes(1);
    expect(api['simulate']).toHaveBeenCalledWith(91, null, false);
    expect(message.success).toHaveBeenCalled();
    expect(api['confidenceBands']).toHaveBeenCalledTimes(2);
  });

  it('reports a failed refresh', async () => {
    api['trainPaymentModels'].mockReturnValue(throwError(() => new Error('down')));
    await create();
    view().refresh();

    expect(message.error).toHaveBeenCalledWith('AI_FORECAST.REFRESH_ERROR');
  });

  it('previews the what-if once, after the sliders stop moving', async () => {
    await create();
    vi.useFakeTimers();

    view().patch({ global_customer_delay_shift_days: 5 });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(100);
    view().patch({ global_customer_delay_shift_days: 15 });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);

    expect(api['simulate']).toHaveBeenCalledTimes(1);
    expect(api['simulate']).toHaveBeenCalledWith(
      91,
      expect.objectContaining({ global_customer_delay_shift_days: 15 }),
      true,
    );
    expect(store.preview()?.id).toBe('run-2');
    // The stored trough was -500 and the previewed one is -2,000.
    expect(store.previewDelta()).toBe(-1500);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="preview-banner"]')).not.toBeNull();
  });

  it('drops the preview when the sliders go back to neutral', async () => {
    await create();
    vi.useFakeTimers();

    view().patch({ global_customer_delay_shift_days: 15 });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);
    expect(store.preview()).not.toBeNull();

    view().reset();
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);

    expect(store.preview()).toBeNull();
    expect(api['simulate']).toHaveBeenCalledTimes(1);
  });

  it('reports a failed preview', async () => {
    api['simulate'].mockReturnValue(throwError(() => new Error('down')));
    await create();
    vi.useFakeTimers();

    view().patch({ revenue_growth_percentage: 10 });
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(400);

    expect(message.error).toHaveBeenCalledWith('AI_FORECAST.PREVIEW_ERROR');
    expect(store.preview()).toBeNull();
  });
});

describe('demand forecast view', () => {
  const message = { success: vi.fn(), error: vi.fn() };
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let fixture: ComponentFixture<DemandForecastComponent>;
  let store: AiForecastingStore;

  interface Internals {
    onWarehouse(id: string | null): void;
    onSearch(search: string): void;
    generate(): void;
    apply(ids: string[]): void;
    periodsAhead: { set(months: number): void };
  }
  const view = (): Internals => fixture.componentInstance as unknown as Internals;

  beforeEach(async () => {
    vi.clearAllMocks();
    api = {
      demandForecasts: vi.fn(() =>
        ok([
          skuForecastFixture(),
          skuForecastFixture({
            forecast_id: 'f-2',
            sku: 'SKU-002',
            product_name: 'Bearing',
            applied_to_wms_at: '2028-01-02T00:00:00Z',
          }),
        ]),
      ),
      accuracy: vi.fn(() => ok(accuracyFixture())),
      generateDemand: vi.fn(() => ok([])),
      applyReorderRules: vi.fn((ids: string[]) =>
        ok(
          ids.map((id) => ({
            forecast_id: id,
            product_id: 'p-1',
            warehouse_id: 'w-1',
            reorder_point: 145.4,
            safety_stock: 61,
            reorder_rule_id: 'r',
            planning_items_updated: 1,
          })),
        ),
      ),
    };
    configure(api, message);
    stubChart(DemandForecastComponent);
    fixture = TestBed.createComponent(DemandForecastComponent);
    store = TestBed.inject(AiForecastingStore);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the grid and shows the live accuracy scores', () => {
    expect(api['demandForecasts']).toHaveBeenCalledWith({});
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="replenishment-grid"] tbody tr'),
    ).toHaveLength(2);
    expect(text(fixture, 'kpi-mape')).toContain('4.4');
    expect(text(fixture, 'kpi-wape')).toContain('4.4');
    expect(text(fixture, 'row-SKU-001')).toContain('145');
    expect(text(fixture, 'row-SKU-001')).toContain('61');
  });

  it('shows applied rows as applied and keeps the apply button for the others', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="apply-SKU-001"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="apply-SKU-002"]')).toBeNull();
  });

  it('filters by warehouse and by search text', () => {
    view().onWarehouse('w-1');
    expect(api['demandForecasts']).toHaveBeenLastCalledWith({ warehouse_id: 'w-1' });
    view().onSearch('bearing');
    expect(api['demandForecasts']).toHaveBeenLastCalledWith({
      warehouse_id: 'w-1',
      search: 'bearing',
    });
    view().onWarehouse(null);
    expect(store.demandFilters().warehouse_id).toBeUndefined();
  });

  it('generates the forecast for the chosen period and reloads', () => {
    view().periodsAhead.set(6);
    view().generate();

    expect(api['generateDemand']).toHaveBeenCalledWith(6);
    expect(message.success).toHaveBeenCalledWith('AI_FORECAST.GENERATED');
    expect(api['demandForecasts']).toHaveBeenCalledTimes(2);
  });

  it('applies one row to the warehouse and planning data and reports the count', () => {
    view().apply(['f-1']);

    expect(api['applyReorderRules']).toHaveBeenCalledWith(['f-1']);
    expect(message.success).toHaveBeenCalledWith('AI_FORECAST.APPLIED_COUNT');
    expect(store.demandRows()[0].applied_to_wms_at).not.toBeNull();
  });

  it('applies the selection in bulk', () => {
    store.selectAll(true);
    (fixture.componentInstance as unknown as { apply(ids: string[]): void }).apply(
      store.selectedRows().map((row) => row.forecast_id),
    );

    expect(api['applyReorderRules']).toHaveBeenCalledWith(['f-1', 'f-2']);
  });

  it('reports a failed apply and a failed generation', () => {
    api['applyReorderRules'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    view().apply(['f-1']);
    expect(message.error).toHaveBeenCalledWith('AI_FORECAST.APPLY_ERROR');

    api['generateDemand'].mockReturnValue(throwError(() => new Error('down')));
    view().generate();
    expect(message.error).toHaveBeenCalledWith('AI_FORECAST.GENERATE_ERROR');
  });
});
