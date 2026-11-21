import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { GeneralLedgerApiService } from '@core';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSegmentedComponent } from 'ng-zorro-antd/segmented';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { ProfitabilityDimension } from './dss.models';
import { BalancedScorecardComponent } from './balanced-scorecard.component';
import { DrillDownDrawerComponent } from './drill-down-drawer.component';
import { DssApiService } from './dss-api.service';
import { DssChartComponent } from './dss-chart.component';
import { DssFilterBarComponent } from './dss-filter-bar.component';
import {
  alertFixture,
  bridgeFixture,
  drillFixture,
  matrixFixture,
  overviewFixture,
  simulationFixture,
} from './dss.testing';
import { ExecutiveDssComponent } from './executive-dss.component';
import { ExecutiveDssStore } from './executive-dss.store';
import { ProfitabilityExplorerComponent } from './profitability-explorer.component';
import { StrategicAlertsComponent } from './strategic-alerts.component';
import { VarianceBridgeComponent } from './variance-bridge.component';
import { SCENARIO_DEBOUNCE_MS, WhatIfSimulatorComponent } from './what-if-simulator.component';

const ok = <T>(data: T) => of({ success: true, message: '', data });

/** ECharts needs a canvas, which jsdom does not have: the views are tested against the option they pass to the chart. */
@Component({ selector: 'app-dss-chart', template: '' })
class ChartStubComponent {
  readonly option = input<unknown>(null);
  readonly label = input<string>('');
  readonly testId = input<string>('');
  readonly pointClick = input<((index: number) => void) | null>(null);
}

type Api = Record<string, ReturnType<typeof vi.fn>>;

function buildApi(): Api {
  return {
    overview: vi.fn(() => ok(overviewFixture())),
    profitabilityMatrix: vi.fn(() => ok(matrixFixture())),
    varianceBridge: vi.fn(() => ok(bridgeFixture())),
    simulate: vi.fn(() => ok(simulationFixture())),
    drillDown: vi.fn(() => ok(drillFixture())),
    legalEntities: vi.fn(() => ok([{ id: 'ent-1', name: 'Alpha AG', currency: 'CHF' }])),
    exportBoardPack: vi.fn(() => of(new Blob(['pdf']))),
  };
}

function configure(api: Api, message: object, extra: object[] = []): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideNzIcons(icons),
      provideNzI18n(en_US),
      provideNzDateFnsAdapter(),
      { provide: DssApiService, useValue: api },
      { provide: NzMessageService, useValue: message },
      {
        provide: GeneralLedgerApiService,
        useValue: {
          getCostCenters: vi.fn(() =>
            ok([
              { id: 'cc-1', code: 'CC1', name: 'Werkstatt', is_active: true },
              { id: 'cc-2', code: 'CC2', name: 'Alt', is_active: false },
            ]),
          ),
        },
      },
      ...extra,
    ],
  });
}

function stubChart(component: Parameters<typeof TestBed.overrideComponent>[0]): void {
  TestBed.overrideComponent(component, {
    remove: { imports: [DssChartComponent] },
    add: { imports: [ChartStubComponent] },
  });
}

const root = (fixture: ComponentFixture<unknown>): HTMLElement =>
  fixture.nativeElement as HTMLElement;
const q = (fixture: ComponentFixture<unknown>, testId: string): HTMLElement | null =>
  root(fixture).querySelector(`[data-testid="${testId}"]`);
const text = (fixture: ComponentFixture<unknown>, testId: string): string =>
  q(fixture, testId)?.textContent ?? '';
/** Drawers render in the overlay, outside the fixture. */
const overlay = (testId: string): HTMLElement | null =>
  document.body.querySelector(`[data-testid="${testId}"]`);

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('balanced scorecard', () => {
  let fixture: ComponentFixture<BalancedScorecardComponent>;
  const drill = vi.fn();

  async function create(kpis = overviewFixture().scorecard): Promise<void> {
    fixture = TestBed.createComponent(BalancedScorecardComponent);
    fixture.componentRef.setInput('kpis', [
      ...kpis.financial,
      ...kpis.customer,
      ...kpis.efficiency,
    ]);
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentInstance.drill.subscribe(drill);
    await settle(fixture);
  }

  beforeEach(() => {
    drill.mockClear();
    TestBed.configureTestingModule({ providers: [provideNzIcons(icons)] });
  });

  it('groups the 13 indicators into financial, customer and efficiency', async () => {
    await create();

    expect(root(fixture).querySelectorAll('.kpi-card')).toHaveLength(13);
    expect(q(fixture, 'group-financial')).not.toBeNull();
    expect(q(fixture, 'group-customer')).not.toBeNull();
    expect(q(fixture, 'group-efficiency')).not.toBeNull();
    expect(
      root(fixture).querySelectorAll('[data-testid="group-financial"] + .kpi-grid .kpi-card'),
    ).toHaveLength(5);
  });

  it('shows the value in its unit, the change badge and the trend sparkline', async () => {
    await create();
    const revenue = q(fixture, 'kpi-revenue') as HTMLElement;
    const margin = q(fixture, 'kpi-gross_margin_pct') as HTMLElement;

    expect(revenue.querySelector('[data-testid="kpi-value"]')?.textContent).toContain('1,000');
    expect(revenue.querySelector('[data-testid="kpi-delta"]')?.textContent).toContain('+25%');
    expect(
      revenue.querySelector('[data-testid="kpi-spark"] polyline')?.getAttribute('points'),
    ).toContain(',');
    expect(margin.querySelector('[data-testid="kpi-value"]')?.textContent).toContain('60%');
    expect(margin.querySelector('[data-testid="kpi-delta"]')?.textContent).toContain('-7.7%');
    // An unfavorable change is not painted as a success.
    expect(margin.querySelector('.ant-tag-error')).not.toBeNull();
    expect(revenue.querySelector('.ant-tag-success')).not.toBeNull();
  });

  it('shows a dash and the reason for an indicator without a source', async () => {
    await create();
    const onTime = q(fixture, 'kpi-on_time_delivery_pct') as HTMLElement;

    expect(onTime.querySelector('[data-testid="kpi-unavailable"]')?.textContent).toBe('–');
    expect(onTime.textContent).toContain('EXEC_DSS.NOT_AVAILABLE');
    expect(onTime.getAttribute('tabindex')).toBeNull();
  });

  it('shows the gauge of an indicator with a target, even at 0%', async () => {
    await create();
    const gauge = root(fixture).querySelector(
      '[data-testid="kpi-cash_conversion_cycle"] .gauge',
    ) as HTMLElement;

    expect(gauge).not.toBeNull();
    expect(gauge.getAttribute('aria-valuenow')).toBe('0');
    expect(root(fixture).querySelector('[data-testid="kpi-revenue"] .gauge')).toBeNull();
  });

  it('shows a comparison hint when there is none', async () => {
    await create();

    expect(text(fixture, 'kpi-customer_concentration_index')).toContain('EXEC_DSS.NO_COMPARISON');
  });

  it('opens the drill-down of an indicator with records behind it, by click and by keyboard', async () => {
    await create();
    (q(fixture, 'kpi-net_cash_flow') as HTMLElement).click();
    (q(fixture, 'kpi-revenue') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter' }),
    );

    expect(drill).toHaveBeenNthCalledWith(1, {
      metric: 'cash',
      label: 'EXEC_DSS.KPI_NET_CASH_FLOW',
    });
    expect(drill).toHaveBeenNthCalledWith(2, { metric: 'revenue', label: 'EXEC_DSS.KPI_REVENUE' });
  });

  it('does not open an indicator that has no records', async () => {
    await create();
    (q(fixture, 'kpi-quote_win_rate') as HTMLElement).click();
    (q(fixture, 'kpi-on_time_delivery_pct') as HTMLElement).click();

    expect(drill).not.toHaveBeenCalled();
  });

  it('shows an empty state when there is no indicator', async () => {
    await create({ financial: [], customer: [], efficiency: [] });

    expect(root(fixture).querySelectorAll('nz-empty')).toHaveLength(3);
  });
});

describe('strategic alerts', () => {
  let fixture: ComponentFixture<StrategicAlertsComponent>;
  const drill = vi.fn();

  async function create(alerts = overviewFixture().alerts): Promise<void> {
    fixture = TestBed.createComponent(StrategicAlertsComponent);
    fixture.componentRef.setInput('alerts', alerts);
    fixture.componentInstance.drill.subscribe(drill);
    await settle(fixture);
  }

  beforeEach(() => {
    drill.mockClear();
    TestBed.configureTestingModule({ providers: [provideNzIcons(icons)] });
  });

  it('shows one card per alert with its severity', async () => {
    await create([
      alertFixture(),
      alertFixture({ code: 'dso_spike', severity: 'WARNING', context: {} }),
    ]);
    const cards = root(fixture).querySelectorAll('.alert-card');

    expect(cards).toHaveLength(2);
    expect(cards[0].classList.contains('critical')).toBe(true);
    expect(cards[1].classList.contains('warning')).toBe(true);
    expect(text(fixture, 'alert-customer_concentration')).toContain('EXEC_DSS.SEVERITY_CRITICAL');
    expect(text(fixture, 'alert-customer_concentration')).toContain('Alpenbau AG');
  });

  it('opens the customer behind a concentration alert', async () => {
    await create();
    (
      root(fixture).querySelector(
        '[data-testid="alert-customer_concentration"] [data-testid="alert-inspect"]',
      ) as HTMLElement
    ).click();

    expect(drill).toHaveBeenCalledWith({
      metric: 'revenue',
      entityType: 'customer',
      entityId: 'cust-1',
      label: 'EXEC_DSS.ALERT_CUSTOMER_CONCENTRATION',
    });
  });

  it('opens the receivables behind a DSO alert', async () => {
    await create();
    (
      root(fixture).querySelector(
        '[data-testid="alert-dso_spike"] [data-testid="alert-inspect"]',
      ) as HTMLElement
    ).click();

    expect(drill.mock.calls[0][0]).toMatchObject({ metric: 'receivable', entityType: null });
  });

  it('says so when nothing is wrong', async () => {
    await create([]);

    expect(q(fixture, 'no-alerts')).not.toBeNull();
  });
});

describe('variance bridge view', () => {
  let fixture: ComponentFixture<VarianceBridgeComponent>;
  const drill = vi.fn();

  async function create(bridge = bridgeFixture()): Promise<void> {
    stubChart(VarianceBridgeComponent);
    fixture = TestBed.createComponent(VarianceBridgeComponent);
    fixture.componentRef.setInput('bridge', bridge);
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentInstance.drill.subscribe(drill);
    await settle(fixture);
  }

  const chart = (): ChartStubComponent =>
    fixture.debugElement.query(By.directive(ChartStubComponent))
      .componentInstance as ChartStubComponent;

  beforeEach(() => {
    drill.mockClear();
    TestBed.configureTestingModule({ providers: [provideNzIcons(icons)] });
  });

  it('draws the EBITDA bridge and switches to the revenue bridge', async () => {
    await create();
    const ebitda = chart().option() as { xAxis: { data: string[] } };

    expect(ebitda.xAxis.data).toHaveLength(7);

    fixture.debugElement
      .query(By.directive(NzSegmentedComponent))
      .triggerEventHandler('nzValueChange', 'revenue');
    await settle(fixture);

    expect((chart().option() as { xAxis: { data: string[] } }).xAxis.data).toHaveLength(5);
  });

  it('opens the records of a bar: cost bars their own category, the others revenue', async () => {
    await create();
    const click = chart().pointClick() as (index: number) => void;

    click(3);
    click(4);
    click(2);
    click(99);

    expect(drill.mock.calls.map(([event]) => event.metric)).toEqual(['cogs', 'opex', 'revenue']);
  });

  it('warns about a missing budget and explains the unit fallback', async () => {
    await create(
      bridgeFixture({
        volume_basis: 'unit_fallback',
        baseline: { type: 'BUDGET', from: 'a', to: 'b', budget_found: false },
      }),
    );

    expect(q(fixture, 'budget-missing')).not.toBeNull();
    expect(q(fixture, 'volume-fallback')).not.toBeNull();
  });

  it('shows an empty state without data', async () => {
    await create(null as never);

    expect(fixture.debugElement.query(By.directive(ChartStubComponent))).toBeNull();
  });
});

describe('profitability explorer', () => {
  let fixture: ComponentFixture<ProfitabilityExplorerComponent>;
  const drill = vi.fn();
  const dimensionChange = vi.fn();

  async function create(
    dimension: ProfitabilityDimension = 'customer',
    matrix = matrixFixture(),
  ): Promise<void> {
    stubChart(ProfitabilityExplorerComponent);
    fixture = TestBed.createComponent(ProfitabilityExplorerComponent);
    fixture.componentRef.setInput('matrix', matrix);
    fixture.componentRef.setInput('dimension', dimension);
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentInstance.drill.subscribe(drill);
    fixture.componentInstance.dimensionChange.subscribe(dimensionChange);
    await settle(fixture);
  }

  beforeEach(() => {
    drill.mockClear();
    dimensionChange.mockClear();
    TestBed.configureTestingModule({ providers: [provideNzIcons(icons)] });
  });

  it('lists the ranked rows, highlights the loss makers and marks the 80/20 core', async () => {
    await create();

    expect(root(fixture).querySelectorAll('[data-testid="matrix-table"] tbody tr')).toHaveLength(2);
    expect(q(fixture, 'matrix-row-cust-2')?.classList.contains('eroding')).toBe(true);
    expect(q(fixture, 'matrix-row-cust-1')?.classList.contains('eroding')).toBe(false);
    expect(text(fixture, 'matrix-row-cust-1')).toContain('80/20');
    expect(text(fixture, 'eroding-tag')).toContain('EXEC_DSS.ERODING');
    expect(text(fixture, 'pareto-tag')).toContain('EXEC_DSS.PARETO_CORE');
  });

  it('passes the whale curve with its cut-off to the chart', async () => {
    await create();
    const option = fixture.debugElement
      .query(By.directive(ChartStubComponent))
      .componentInstance.option() as {
      series: { markLine: { data: unknown[] } }[];
    };

    expect(option.series[0].markLine.data).toHaveLength(2);
  });

  it('announces a dimension change', async () => {
    await create();
    fixture.debugElement
      .query(By.directive(NzSegmentedComponent))
      .triggerEventHandler('nzValueChange', 'cost_center');

    expect(dimensionChange).toHaveBeenCalledWith('cost_center');
  });

  it('opens the drill-down of a row for the dimensions the ledger knows', async () => {
    await create();
    (q(fixture, 'matrix-row-cust-1') as HTMLElement).click();

    expect(drill).toHaveBeenCalledWith({
      metric: 'revenue',
      entityType: 'customer',
      entityId: 'cust-1',
      label: 'Alpenbau AG',
    });
  });

  it('does not open a row of a dimension the ledger cannot filter by', async () => {
    await create('product', matrixFixture({ dimension: 'product' }));
    (q(fixture, 'matrix-row-cust-1') as HTMLElement).click();

    expect(drill).not.toHaveBeenCalled();
  });

  it('shows an empty state without data', async () => {
    await create('customer', null as never);

    expect(q(fixture, 'matrix-table')).toBeNull();
  });
});

describe('what-if simulator drawer', () => {
  let api: Api;
  let fixture: ComponentFixture<WhatIfSimulatorComponent>;
  let store: ExecutiveDssStore;

  async function create(open = true): Promise<void> {
    fixture = TestBed.createComponent(WhatIfSimulatorComponent);
    store = TestBed.inject(ExecutiveDssStore);
    fixture.componentRef.setInput('open', open);
    await settle(fixture);
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api = buildApi();
    configure(api, { success: vi.fn(), error: vi.fn() });
  });

  afterEach(() => vi.useRealTimers());

  it('shows the six sliders', async () => {
    await create();

    for (const key of [
      'price_pct',
      'cogs_pct',
      'opex_pct',
      'dso_days_delta',
      'fx_shift_pct',
      'fte_delta',
    ]) {
      expect(overlay(`slider-${key}`), key).not.toBeNull();
    }
  });

  it('runs the scenario once the sliders rest and shows baseline against simulated', async () => {
    await create();
    store.setScenario({ price_pct: 10 });
    TestBed.tick();
    vi.advanceTimersByTime(SCENARIO_DEBOUNCE_MS - 1);
    expect(api['simulate']).not.toHaveBeenCalled();

    store.setScenario({ cogs_pct: 5 });
    TestBed.tick();
    vi.advanceTimersByTime(SCENARIO_DEBOUNCE_MS);
    await settle(fixture);

    expect(api['simulate']).toHaveBeenCalledTimes(1);
    expect(api['simulate'].mock.calls[0][1]).toMatchObject({ price_pct: 10, cogs_pct: 5 });
    expect(store.simulation()?.simulated.ebitda).toBe(500);
    const result = overlay('sim-result') as HTMLElement;

    expect(result).not.toBeNull();
    expect(result.querySelectorAll('nz-statistic')).toHaveLength(3);
    expect(result.textContent).toContain('500');
    expect(result.textContent).toContain('EXEC_DSS.SIM_BASELINE');
  });

  it('asks nothing for a neutral scenario and drops the previous result', async () => {
    await create();
    store.setScenario({ price_pct: 10 });
    TestBed.tick();
    vi.advanceTimersByTime(SCENARIO_DEBOUNCE_MS);
    await settle(fixture);
    expect(store.simulation()).not.toBeNull();

    store.setScenario({ price_pct: 0 });
    TestBed.tick();
    vi.advanceTimersByTime(SCENARIO_DEBOUNCE_MS);
    await settle(fixture);

    expect(api['simulate']).toHaveBeenCalledTimes(1);
    expect(store.simulation()).toBeNull();
    expect(overlay('sim-hint')).not.toBeNull();
  });

  it('asks nothing while the drawer is closed', async () => {
    await create(false);
    store.setScenario({ price_pct: 10 });
    TestBed.tick();
    vi.advanceTimersByTime(SCENARIO_DEBOUNCE_MS * 2);

    expect(api['simulate']).not.toHaveBeenCalled();
  });

  it('warns when the scenario has no break-even', async () => {
    api['simulate'].mockReturnValue(
      ok(
        simulationFixture({
          simulated: { ...simulationFixture().simulated, break_even_revenue: null },
          delta: { ...simulationFixture().delta, break_even_revenue: null },
        }),
      ),
    );
    await create();
    store.setScenario({ cogs_pct: 30 });
    TestBed.tick();
    vi.advanceTimersByTime(SCENARIO_DEBOUNCE_MS);
    await settle(fixture);

    expect(overlay('no-break-even')).not.toBeNull();
  });

  it('resets the sliders', async () => {
    await create();
    store.setScenario({ price_pct: 10 });
    (overlay('sim-reset') as HTMLElement).click();

    expect(store.scenario().price_pct).toBe(0);
  });

  it('shows the value of a slider with its sign', async () => {
    await create();
    store.setScenario({ price_pct: 10, fte_delta: -2 });
    await settle(fixture);

    expect(overlay('value-price_pct')?.textContent).toBe('+10%');
    expect(overlay('value-fte_delta')?.textContent).toBe('-2');
  });
});

describe('drill-down drawer', () => {
  let api: Api;
  let fixture: ComponentFixture<DrillDownDrawerComponent>;
  let store: ExecutiveDssStore;
  const message = { success: vi.fn(), error: vi.fn() };

  async function open(): Promise<void> {
    fixture = TestBed.createComponent(DrillDownDrawerComponent);
    store = TestBed.inject(ExecutiveDssStore);
    store
      .openDrill({
        metric: 'revenue',
        entityType: 'customer',
        entityId: 'cust-1',
        label: 'Alpenbau AG',
      })
      .subscribe();
    await settle(fixture);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure(api, message);
  });

  it('lists the records with the source link and the continuation links', async () => {
    await open();

    expect(api['drillDown']).toHaveBeenCalledTimes(1);
    expect(overlay('drill-row-f-1')?.textContent).toContain('Alpenbau AG');
    expect(overlay('drill-row-f-1')?.textContent).toContain('90001');
    expect(overlay('drill-total')?.textContent).toContain('60');
    expect((overlay('drill-source-link') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/general-ledger/journals',
    );
    expect((overlay('link-report-builder') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/analytics/reports',
    );
    expect((overlay('link-kpi-dashboards') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/business-intelligence',
    );
  });

  it('loads another page', async () => {
    await open();
    fixture.debugElement.injector.get(ExecutiveDssStore);
    (fixture.componentInstance as unknown as { goTo(page: number): void }).goTo(2);
    await settle(fixture);

    expect(api['drillDown']).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ metric: 'revenue' }),
      2,
      25,
    );
    expect(store.drillPage()).toBe(2);
  });

  it('reports a failed page', async () => {
    await open();
    api['drillDown'].mockReturnValue(throwError(() => new Error('boom')));
    (fixture.componentInstance as unknown as { goTo(page: number): void }).goTo(2);

    expect(message.error).toHaveBeenCalledWith('EXEC_DSS.DRILL_ERROR');
  });

  it('closes with the store', async () => {
    await open();
    store.closeDrill();
    await settle(fixture);

    expect(store.drill()).toBeNull();
  });
});

describe('filter bar', () => {
  let api: Api;
  let fixture: ComponentFixture<DssFilterBarComponent>;
  let store: ExecutiveDssStore;
  const exportPack = vi.fn();

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(DssFilterBarComponent);
    store = TestBed.inject(ExecutiveDssStore);
    fixture.componentInstance.exportPack.subscribe(exportPack);
    await settle(fixture);
  }

  const segmented = (testId: string) =>
    fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));

  beforeEach(() => {
    exportPack.mockClear();
    api = buildApi();
    configure(api, { success: vi.fn(), error: vi.fn() });
  });

  it('switches the reporting currency', async () => {
    await create();
    segmented('currency-toggle').triggerEventHandler('nzValueChange', 'EUR');

    expect(store.currency()).toBe('EUR');
  });

  it('shows the live FX rate of the other currency into the reporting one', async () => {
    await create();
    store.overview.set(overviewFixture());
    await settle(fixture);

    expect(text(fixture, 'fx-badge')).toContain('1 EUR = 1.0500 CHF');

    store.setCurrency('EUR');
    await settle(fixture);

    expect(text(fixture, 'fx-badge')).toContain('1 CHF = 0.9500 EUR');
  });

  it('changes the period and opens the date picker for a custom period', async () => {
    await create();
    segmented('period-switcher').triggerEventHandler('nzValueChange', 'QTD');

    expect(store.filters().periodPreset).toBe('QTD');
    expect(q(fixture, 'custom-range')).toBeNull();

    segmented('period-switcher').triggerEventHandler('nzValueChange', 'CUSTOM');
    await settle(fixture);

    expect(store.customPending()).toBe(true);
    expect(q(fixture, 'custom-range')).not.toBeNull();

    (fixture.componentInstance as unknown as { onRange(range: Date[]): void }).onRange([
      new Date(2028, 1, 1),
      new Date(2028, 1, 29),
    ]);

    expect(store.filters()).toMatchObject({
      periodPreset: 'CUSTOM',
      customDateRange: ['2028-02-01', '2028-02-29'],
    });
  });

  it('ignores an incomplete date range', async () => {
    await create();
    (fixture.componentInstance as unknown as { onRange(range: Date[] | null): void }).onRange([
      new Date(2028, 1, 1),
    ]);
    (fixture.componentInstance as unknown as { onRange(range: Date[] | null): void }).onRange(null);

    expect(store.filters().periodPreset).toBe('YTD');
  });

  it('offers the legal entities and the active cost centers', async () => {
    await create();
    store.legalEntities.set([{ id: 'ent-1', name: 'Alpha AG', currency: 'CHF' }]);
    await settle(fixture);
    const internals = fixture.componentInstance as unknown as { costCenters(): { id: string }[] };

    expect(internals.costCenters().map((center) => center.id)).toEqual(['cc-1']);
    expect(q(fixture, 'entity-select')).not.toBeNull();
    expect(q(fixture, 'cost-center-select')).not.toBeNull();
    expect(q(fixture, 'baseline-select')).not.toBeNull();
  });

  it('asks for the board pack as PDF or Excel and shows the export in progress', async () => {
    await create();
    (root(fixture).querySelector('[data-testid="export-board-pack"]') as HTMLElement).click();
    (root(fixture).querySelector('[data-testid="export-board-pack-xlsx"]') as HTMLElement).click();

    expect(exportPack.mock.calls.map(([format]) => format)).toEqual(['pdf', 'xlsx']);

    store.exporting.set(true);
    await settle(fixture);

    expect(
      root(fixture)
        .querySelector('[data-testid="export-board-pack"]')
        ?.classList.contains('ant-btn-loading'),
    ).toBe(true);
    expect(
      (root(fixture).querySelector('[data-testid="export-board-pack-xlsx"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe('executive DSS page', () => {
  let api: Api;
  let fixture: ComponentFixture<ExecutiveDssComponent>;
  let store: ExecutiveDssStore;
  const message = { success: vi.fn(), error: vi.fn() };

  async function create(
    queryParams: Record<string, string> = {},
    beforeSettle: () => void = () => undefined,
  ): Promise<void> {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParams }, queryParams: of(queryParams) },
    });
    for (const component of [VarianceBridgeComponent, ProfitabilityExplorerComponent]) {
      stubChart(component);
    }
    fixture = TestBed.createComponent(ExecutiveDssComponent);
    store = TestBed.inject(ExecutiveDssStore);
    beforeSettle();
    await settle(fixture);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api = buildApi();
    configure(api, message, [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: of({}) } },
    ]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads the scorecard, bridge and matrix on arrival and shows them', async () => {
    await create();

    expect(api['overview']).toHaveBeenCalledTimes(1);
    expect(api['varianceBridge']).toHaveBeenCalledTimes(1);
    expect(api['profitabilityMatrix']).toHaveBeenCalledTimes(1);
    expect(root(fixture).querySelectorAll('.kpi-card')).toHaveLength(13);
    expect(root(fixture).querySelectorAll('.alert-card')).toHaveLength(3);
    expect(q(fixture, 'variance-bridge')).not.toBeNull();
    expect(q(fixture, 'profitability')).not.toBeNull();
  });

  it('puts the critical alert first', async () => {
    await create();
    const cards = root(fixture).querySelectorAll('.alert-card');

    expect(cards[0].classList.contains('critical')).toBe(true);
    expect(cards[2].classList.contains('info')).toBe(true);
  });

  it('takes the filter of a shared link', async () => {
    await create({ cur: 'EUR', period: 'QTD', base: 'BUDGET' });

    expect(store.filters()).toMatchObject({
      reportingCurrency: 'EUR',
      periodPreset: 'QTD',
      comparisonBaseline: 'BUDGET',
    });
    expect(api['overview'].mock.calls[0][0]).toMatchObject({
      reportingCurrency: 'EUR',
      periodPreset: 'QTD',
    });
  });

  it('writes the filter to the URL, leaving the defaults out', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await create({}, () => {
      vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(navigate);
    });

    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        replaceUrl: true,
        queryParamsHandling: 'merge',
        queryParams: expect.objectContaining({ cur: null, period: null }),
      }),
    );

    store.setCurrency('EUR');
    await settle(fixture);

    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: expect.objectContaining({ cur: 'EUR' }) }),
    );
  });

  it('opens the drill-down of an indicator', async () => {
    await create();
    (q(fixture, 'kpi-revenue') as HTMLElement).click();
    await settle(fixture);

    expect(api['drillDown']).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metric: 'revenue', entityType: null }),
      1,
      25,
    );
    expect(store.drillTarget()?.label).toBe('EXEC_DSS.KPI_REVENUE');
  });

  it('opens the customer of an alert', async () => {
    await create();
    (
      root(fixture).querySelector(
        '[data-testid="alert-customer_concentration"] [data-testid="alert-inspect"]',
      ) as HTMLElement
    ).click();
    await settle(fixture);

    expect(api['drillDown']).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityType: 'customer', entityId: 'cust-1' }),
      1,
      25,
    );
  });

  it('reports a drill-down that fails', async () => {
    await create();
    api['drillDown'].mockReturnValue(throwError(() => new Error('boom')));
    (q(fixture, 'kpi-revenue') as HTMLElement).click();

    expect(message.error).toHaveBeenCalledWith('EXEC_DSS.DRILL_ERROR');
  });

  it('downloads the board pack in the language of the user and tells so', async () => {
    await create();
    (root(fixture).querySelector('[data-testid="export-board-pack"]') as HTMLElement).click();
    await settle(fixture);

    expect(api['exportBoardPack']).toHaveBeenCalledWith(
      expect.objectContaining({ reportingCurrency: 'CHF' }),
      'pdf',
      expect.stringMatching(/^(it-CH|de-CH|fr-CH|en)$/),
    );
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith('EXEC_DSS.EXPORT_DONE');
  });

  it('reports a board pack that fails', async () => {
    await create();
    api['exportBoardPack'].mockReturnValue(throwError(() => new Error('boom')));
    (root(fixture).querySelector('[data-testid="export-board-pack-xlsx"]') as HTMLElement).click();

    expect(message.error).toHaveBeenCalledWith('EXEC_DSS.EXPORT_ERROR');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('shows a load error with a retry', async () => {
    api['overview'].mockReturnValueOnce(throwError(() => new Error('boom')));
    await create();

    expect(q(fixture, 'load-error')).not.toBeNull();

    (q(fixture, 'retry') as HTMLElement).click();
    await settle(fixture);

    expect(q(fixture, 'load-error')).toBeNull();
    expect(root(fixture).querySelectorAll('.kpi-card')).toHaveLength(13);
  });

  it('warns when the budget to compare with does not exist', async () => {
    const missing = overviewFixture();
    missing.meta.comparison = {
      ...missing.meta.comparison,
      baseline: 'BUDGET',
      budget_found: false,
    };
    api['overview'].mockReturnValue(ok(missing));
    await create();

    expect(q(fixture, 'budget-banner')).not.toBeNull();
  });
});
