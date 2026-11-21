import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bridgeFixture,
  drillFixture,
  matrixFixture,
  overviewFixture,
  simulationFixture,
} from './dss.testing';
import { DEFAULT_FILTER } from './dss.utils';
import { DRILL_PAGE_SIZE, ExecutiveDssStore, FILTER_DEBOUNCE_MS } from './executive-dss.store';

const base = '/api/v1/analytics/dss';
const envelope = <T>(data: T) => ({ success: true, message: '', data });

describe('ExecutiveDssStore', () => {
  let store: ExecutiveDssStore;
  let http: HttpTestingController;

  const overviewRequests = () => http.match((req) => req.url === `${base}/overview`);

  /** Answers the three views of one reload. */
  function flushViews(
    overview = overviewFixture(),
    matrix = matrixFixture(),
    bridge = bridgeFixture(),
  ): void {
    http.expectOne((req) => req.url === `${base}/overview`).flush(envelope(overview));
    http.expectOne((req) => req.url === `${base}/variance-bridge`).flush(envelope(bridge));
    http.expectOne((req) => req.url === `${base}/profitability-matrix`).flush(envelope(matrix));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ExecutiveDssStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  describe('filter state', () => {
    it('starts on CHF, year to date, against the prior year', () => {
      expect(store.filters()).toEqual(DEFAULT_FILTER);
      expect(store.currency()).toBe('CHF');
      expect(store.dimension()).toBe('customer');
    });

    it('switches the reporting currency without touching the rest of the filter', () => {
      store.setLegalEntities(['a']);
      store.setCurrency('EUR');

      expect(store.currency()).toBe('EUR');
      expect(store.filters().legalEntityIds).toEqual(['a']);
      expect(store.queryParams()['cur']).toBe('EUR');
    });

    it('updates the scope, the period and the baseline', () => {
      store.setLegalEntities(['a', 'b']);
      store.setCostCenters(['c']);
      store.setPeriodPreset('L12M');
      store.setBaseline('BUDGET');

      expect(store.filters()).toMatchObject({
        legalEntityIds: ['a', 'b'],
        costCenterIds: ['c'],
        periodPreset: 'L12M',
        comparisonBaseline: 'BUDGET',
      });
    });

    it('only opens the date picker for a custom period without dates', () => {
      store.setPeriodPreset('CUSTOM');

      expect(store.customPending()).toBe(true);
      expect(store.filters().periodPreset).toBe('YTD');

      store.setCustomDateRange(['2028-02-01', '2028-02-29']);

      expect(store.customPending()).toBe(false);
      expect(store.filters()).toMatchObject({
        periodPreset: 'CUSTOM',
        customDateRange: ['2028-02-01', '2028-02-29'],
      });

      // A range is kept when another preset is on, so CUSTOM is a filter straight away afterwards.
      store.setPeriodPreset('MTD');
      store.setPeriodPreset('CUSTOM');

      expect(store.customPending()).toBe(false);
      expect(store.filters().periodPreset).toBe('CUSTOM');
    });

    it('ignores an empty or inverted date range', () => {
      store.setCustomDateRange(null);
      store.setCustomDateRange(['2028-03-01', '2028-02-01']);

      expect(store.filters()).toEqual(DEFAULT_FILTER);
    });

    it('takes the filter of the URL and leaves a filter that is already current alone', () => {
      const before = store.filters();
      store.applyQueryParams({});

      expect(store.filters()).toBe(before);

      store.applyQueryParams({ cur: 'EUR', period: 'QTD', entities: 'a,b', base: 'PRIOR_PERIOD' });

      expect(store.filters()).toMatchObject({
        reportingCurrency: 'EUR',
        periodPreset: 'QTD',
        legalEntityIds: ['a', 'b'],
        comparisonBaseline: 'PRIOR_PERIOD',
      });
      expect(store.queryParams()).toMatchObject({
        cur: 'EUR',
        period: 'QTD',
        entities: 'a,b',
        base: 'PRIOR_PERIOD',
      });
    });
  });

  describe('loading', () => {
    it('loads the scorecard, the bridge and the matrix with the filter', () => {
      store.setCurrency('EUR');
      store.setLegalEntities(['a']);
      store.reload().subscribe();

      expect(store.loading()).toBe(true);
      const overview = http.expectOne((req) => req.url === `${base}/overview`);

      expect(overview.request.params.get('currency')).toBe('EUR');
      expect(overview.request.params.getAll('legal_entity_ids[]')).toEqual(['a']);
      overview.flush(envelope(overviewFixture()));
      http
        .expectOne((req) => req.url === `${base}/variance-bridge`)
        .flush(envelope(bridgeFixture()));
      const matrix = http.expectOne((req) => req.url === `${base}/profitability-matrix`);

      expect(matrix.request.params.get('dimension')).toBe('customer');
      matrix.flush(envelope(matrixFixture()));

      expect(store.loading()).toBe(false);
      expect(store.failed()).toBe(false);
      expect(store.overview()?.meta.currency).toBe('CHF');
      expect(store.bridge()?.ebitda_bridge).toHaveLength(7);
      expect(store.matrix()?.rows).toHaveLength(2);
    });

    it('flags a failure and keeps the last good data', () => {
      store.reload().subscribe();
      flushViews();
      let failed = false;
      store.reload().subscribe({ error: () => (failed = true) });
      http
        .expectOne((req) => req.url === `${base}/overview`)
        .flush({}, { status: 500, statusText: 'Server Error' });
      http
        .match((req) => req.url !== `${base}/overview`)
        .forEach((req) => req.cancelled || req.flush(envelope(null)));

      expect(failed).toBe(true);
      expect(store.failed()).toBe(true);
      expect(store.loading()).toBe(false);
      expect(store.overview()).not.toBeNull();
    });

    it('derives the indicators, the alerts by severity and the budget state', () => {
      store.reload().subscribe();
      flushViews();

      expect(store.kpis()).toHaveLength(13);
      expect(store.alerts().map((alert) => alert.severity)).toEqual([
        'CRITICAL',
        'WARNING',
        'INFO',
      ]);
      expect(store.criticalAlerts()).toBe(1);
      expect(store.budgetMissing()).toBe(false);

      store.reload().subscribe();
      const missing = overviewFixture();
      missing.meta.comparison = {
        ...missing.meta.comparison,
        baseline: 'BUDGET',
        budget_found: false,
      };
      flushViews(missing);

      expect(store.budgetMissing()).toBe(true);
    });

    it('shows the rate of the other reporting currency into the current one', () => {
      expect(store.fxRate()).toBeNull();
      store.reload().subscribe();
      flushViews();

      expect(store.fxRate()).toEqual({ from: 'EUR', to: 'CHF', rate: 1.05, asOf: '2028-06-30' });

      store.setCurrency('EUR');

      expect(store.fxRate()).toEqual({ from: 'CHF', to: 'EUR', rate: 0.95, asOf: '2028-06-30' });

      const noRate = overviewFixture();
      noRate.meta.fx = { CHF_EUR: null, EUR_CHF: null, as_of: '2028-06-30' };
      store.reload().subscribe();
      flushViews(noRate);

      expect(store.fxRate()).toBeNull();
    });
  });

  describe('automatic fetching', () => {
    function connect(): void {
      TestBed.runInInjectionContext(() => store.connect());
      flushViews();
      http
        .expectOne(`${base}/legal-entities`)
        .flush(envelope([{ id: 'a', name: 'Alpha AG', currency: 'CHF' }]));
      TestBed.tick();
    }

    it('loads at once, then fetches once after the filter settles', () => {
      vi.useFakeTimers();
      connect();

      expect(store.legalEntities()).toEqual([{ id: 'a', name: 'Alpha AG', currency: 'CHF' }]);
      expect(overviewRequests()).toHaveLength(0);

      store.setCurrency('EUR');
      TestBed.tick();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1);
      store.setBaseline('BUDGET');
      TestBed.tick();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS - 1);

      // Two changes inside the pause: nothing was fetched yet.
      expect(overviewRequests()).toHaveLength(0);

      vi.advanceTimersByTime(1);
      const requests = http.match((req) => req.url === `${base}/overview`);

      expect(requests).toHaveLength(1);
      expect(requests[0].request.params.get('currency')).toBe('EUR');
      expect(requests[0].request.params.get('comparison_baseline')).toBe('BUDGET');
      requests[0].flush(envelope(overviewFixture()));
      http
        .expectOne((req) => req.url === `${base}/variance-bridge`)
        .flush(envelope(bridgeFixture()));
      http
        .expectOne((req) => req.url === `${base}/profitability-matrix`)
        .flush(envelope(matrixFixture()));
    });

    it('cancels the fetch in flight when the filter changes again', () => {
      vi.useFakeTimers();
      connect();

      store.setCurrency('EUR');
      TestBed.tick();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS);
      const first = http.expectOne((req) => req.url === `${base}/overview`);

      store.setCurrency('CHF');
      TestBed.tick();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS);

      expect(first.cancelled).toBe(true);
      http.match(() => true).forEach((req) => req.cancelled || req.flush(envelope(null)));
    });

    it('reloads only the matrix when the dimension changes', () => {
      vi.useFakeTimers();
      connect();

      store.setDimension('cost_center');
      TestBed.tick();

      expect(overviewRequests()).toHaveLength(0);
      const matrix = http.expectOne((req) => req.url === `${base}/profitability-matrix`);

      expect(matrix.request.params.get('dimension')).toBe('cost_center');
      expect(store.matrixLoading()).toBe(true);
      matrix.flush(envelope(matrixFixture({ dimension: 'cost_center' })));

      expect(store.matrixLoading()).toBe(false);
      expect(store.matrix()?.dimension).toBe('cost_center');
    });

    it('does not refetch when the URL describes the filter already on screen', () => {
      vi.useFakeTimers();
      connect();

      store.applyQueryParams({});
      TestBed.tick();
      vi.advanceTimersByTime(FILTER_DEBOUNCE_MS * 2);

      expect(overviewRequests()).toHaveLength(0);
    });
  });

  describe('what-if scenario', () => {
    it('keeps the sliders and resets them', () => {
      store.setScenario({ price_pct: 5 });
      store.setScenario({ fte_delta: -2 });

      expect(store.scenario()).toMatchObject({ price_pct: 5, fte_delta: -2, cogs_pct: 0 });

      store.simulation.set(simulationFixture());
      store.resetScenario();

      expect(store.scenario().price_pct).toBe(0);
      expect(store.simulation()).toBeNull();
    });

    it('runs the scenario on the actuals of the filter', () => {
      store.setCurrency('EUR');
      store.setScenario({ price_pct: 10 });
      store.runSimulation().subscribe();

      expect(store.simulating()).toBe(true);
      const request = http.expectOne(`${base}/simulate`);

      expect(request.request.method).toBe('POST');
      expect(request.request.body).toMatchObject({
        currency: 'EUR',
        period_preset: 'YTD',
        scenario: { price_pct: 10, cogs_pct: 0 },
      });
      request.flush(envelope(simulationFixture()));

      expect(store.simulating()).toBe(false);
      expect(store.simulation()?.simulated.ebitda).toBe(500);
    });
  });

  describe('drill-down', () => {
    it('opens a target on the first page and pages through the records', () => {
      store
        .openDrill({
          metric: 'revenue',
          entityType: 'customer',
          entityId: 'cust-1',
          label: 'Alpenbau AG',
        })
        .subscribe();

      expect(store.drillTarget()?.label).toBe('Alpenbau AG');
      const first = http.expectOne((req) => req.url === `${base}/drill-down`);

      expect(first.request.params.get('metric')).toBe('revenue');
      expect(first.request.params.get('entity_type')).toBe('customer');
      expect(first.request.params.get('entity_id')).toBe('cust-1');
      expect(first.request.params.get('page')).toBe('1');
      expect(first.request.params.get('per_page')).toBe(String(DRILL_PAGE_SIZE));
      first.flush(envelope(drillFixture()));

      expect(store.drill()?.data).toHaveLength(1);
      expect(store.drillPages()).toBe(3);

      store.loadDrillPage(2).subscribe();
      const second = http.expectOne((req) => req.url === `${base}/drill-down`);

      expect(second.request.params.get('page')).toBe('2');
      second.flush(
        envelope(drillFixture({ pagination: { page: 2, per_page: 25, total: 60, last_page: 3 } })),
      );

      expect(store.drillPage()).toBe(2);
      expect(store.drillLoading()).toBe(false);
    });

    it('sends no entity for a metric drill-down and closes cleanly', () => {
      store
        .openDrill({ metric: 'cash', entityType: null, entityId: null, label: 'Cash' })
        .subscribe();
      const request = http.expectOne((req) => req.url === `${base}/drill-down`);

      expect(request.request.params.has('entity_type')).toBe(false);
      request.flush(envelope(drillFixture({ metric: 'cash' })));
      store.closeDrill();

      expect(store.drillTarget()).toBeNull();
      expect(store.drill()).toBeNull();
    });

    it('has nothing to page without a target', () => {
      let emitted = false;
      store.loadDrillPage(2).subscribe(() => (emitted = true));

      expect(emitted).toBe(false);
      http.expectNone(`${base}/drill-down`);
    });
  });

  describe('board pack', () => {
    it('requests the file in the format and language and tracks the export', () => {
      let blob: Blob | null = null;
      store.setCurrency('EUR');
      store.exportBoardPack('xlsx', 'de-CH').subscribe((file) => (blob = file));

      expect(store.exporting()).toBe(true);
      const request = http.expectOne(`${base}/export-board-pack`);

      expect(request.request.responseType).toBe('blob');
      expect(request.request.body).toMatchObject({
        format: 'xlsx',
        locale: 'de-CH',
        currency: 'EUR',
      });
      request.flush(new Blob(['x']));

      expect(blob).toBeInstanceOf(Blob);
      expect(store.exporting()).toBe(false);
    });

    it('stops tracking the export when it fails', () => {
      store.exportBoardPack('pdf', 'en').subscribe({ error: () => undefined });
      http
        .expectOne(`${base}/export-board-pack`)
        .flush(new Blob(), { status: 500, statusText: 'Server Error' });

      expect(store.exporting()).toBe(false);
    });
  });
});
