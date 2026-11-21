import { computed, DestroyRef, inject, Service, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  EMPTY,
  finalize,
  forkJoin,
  map,
  Observable,
  skip,
  switchMap,
  tap,
} from 'rxjs';
import { DssApiService } from './dss-api.service';
import {
  AlertSeverity,
  BalancedScorecardKpi,
  BoardPackFormat,
  ComparisonBaseline,
  DrillDownResponse,
  DrillTarget,
  DssFilterState,
  DssLegalEntity,
  DssOverviewResponse,
  PeriodPreset,
  ProfitabilityDimension,
  ProfitabilityMatrixResponse,
  ReportingCurrency,
  VarianceBridgeResponse,
  WhatIfScenario,
  WhatIfSimulationResult,
} from './dss.models';
import {
  DEFAULT_FILTER,
  DEFAULT_SCENARIO,
  filterFromQueryParams,
  filterToQueryParams,
  sameFilter,
} from './dss.utils';

/** Pause after the last filter change before the views are fetched again. */
export const FILTER_DEBOUNCE_MS = 300;
export const DRILL_PAGE_SIZE = 25;

const SEVERITY_ORDER: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

/**
 * Signal state of the Executive DSS command center. The global filter drives every view: a change is debounced and refetches
 * the scorecard, the variance bridge and the profitability matrix together (a newer change cancels the one in flight), and
 * the filter round-trips through the URL so a view can be shared or bookmarked.
 */
@Service()
export class ExecutiveDssStore {
  private readonly api = inject(DssApiService);

  readonly filters = signal<DssFilterState>({ ...DEFAULT_FILTER });
  /** A custom period was chosen but its dates are not set yet. */
  readonly customPending = signal(false);
  readonly dimension = signal<ProfitabilityDimension>('customer');

  readonly overview = signal<DssOverviewResponse | null>(null);
  readonly matrix = signal<ProfitabilityMatrixResponse | null>(null);
  readonly bridge = signal<VarianceBridgeResponse | null>(null);
  readonly legalEntities = signal<DssLegalEntity[]>([]);
  readonly loading = signal(false);
  readonly matrixLoading = signal(false);
  readonly failed = signal(false);

  readonly scenario = signal<WhatIfScenario>({ ...DEFAULT_SCENARIO });
  readonly simulation = signal<WhatIfSimulationResult | null>(null);
  readonly simulating = signal(false);

  readonly drillTarget = signal<DrillTarget | null>(null);
  readonly drill = signal<DrillDownResponse | null>(null);
  readonly drillLoading = signal(false);
  readonly drillPage = signal(1);

  readonly exporting = signal(false);

  readonly currency = computed<ReportingCurrency>(() => this.filters().reportingCurrency);
  readonly queryParams = computed(() => filterToQueryParams(this.filters()));
  readonly kpis = computed<BalancedScorecardKpi[]>(() => {
    const scorecard = this.overview()?.scorecard;

    return scorecard
      ? [...scorecard.financial, ...scorecard.customer, ...scorecard.efficiency]
      : [];
  });
  readonly alerts = computed(() =>
    [...(this.overview()?.alerts ?? [])].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    ),
  );
  readonly criticalAlerts = computed(
    () => this.alerts().filter((alert) => alert.severity === 'CRITICAL').length,
  );
  /** Rate of the other reporting currency into the current one (the live FX indicator of the filter bar). */
  readonly fxRate = computed(() => {
    const fx = this.overview()?.meta.fx;

    if (!fx) {
      return null;
    }

    const rate = this.currency() === 'CHF' ? fx.EUR_CHF : fx.CHF_EUR;

    return rate === null
      ? null
      : {
          from: this.currency() === 'CHF' ? 'EUR' : 'CHF',
          to: this.currency(),
          rate,
          asOf: fx.as_of,
        };
  });
  /** The comparison is a budget and no budget exists for the period. */
  readonly budgetMissing = computed(() => this.overview()?.meta.comparison.budget_found === false);
  readonly drillPages = computed(() => this.drill()?.pagination.last_page ?? 1);

  setLegalEntities(ids: string[]): void {
    this.filters.update((filter) => ({ ...filter, legalEntityIds: [...ids] }));
  }

  setCostCenters(ids: string[]): void {
    this.filters.update((filter) => ({ ...filter, costCenterIds: [...ids] }));
  }

  setCurrency(currency: ReportingCurrency): void {
    this.filters.update((filter) => ({ ...filter, reportingCurrency: currency }));
  }

  /** A custom preset without dates only opens the date picker: it becomes a filter once the range is chosen. */
  setPeriodPreset(preset: PeriodPreset): void {
    if (preset === 'CUSTOM' && this.filters().customDateRange === null) {
      this.customPending.set(true);

      return;
    }

    this.customPending.set(false);
    this.filters.update((filter) => ({ ...filter, periodPreset: preset }));
  }

  setCustomDateRange(range: [string, string] | null): void {
    if (range === null || range[0] > range[1]) {
      return;
    }

    this.customPending.set(false);
    this.filters.update((filter) => ({
      ...filter,
      periodPreset: 'CUSTOM',
      customDateRange: range,
    }));
  }

  setBaseline(baseline: ComparisonBaseline): void {
    this.filters.update((filter) => ({ ...filter, comparisonBaseline: baseline }));
  }

  setDimension(dimension: ProfitabilityDimension): void {
    this.dimension.set(dimension);
  }

  /** Takes the filter described by the URL; a filter that is already current is left alone (no refetch, no loop). */
  applyQueryParams(params: Record<string, string | readonly string[] | null | undefined>): void {
    const next = filterFromQueryParams(params);

    if (!sameFilter(next, this.filters())) {
      this.customPending.set(false);
      this.filters.set(next);
    }
  }

  /**
   * Loads the views now and keeps them in step with the filter. Call it once from the injection context of the page; the
   * subscriptions end with it.
   */
  connect(): void {
    const destroyRef = inject(DestroyRef);

    this.reload()
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

    toObservable(this.filters)
      .pipe(
        skip(1),
        debounceTime(FILTER_DEBOUNCE_MS),
        switchMap(() => this.reload().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

    toObservable(this.dimension)
      .pipe(
        skip(1),
        switchMap(() => this.loadMatrix().pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

    if (this.legalEntities().length === 0) {
      this.api
        .legalEntities()
        .pipe(
          map((res) => res.data),
          catchError(() => EMPTY),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe((entities) => this.legalEntities.set(entities));
    }
  }

  /** Scorecard, bridge and matrix of the current filter, fetched together. */
  reload(): Observable<unknown> {
    const filter = this.filters();
    this.loading.set(true);
    this.failed.set(false);

    return forkJoin({
      overview: this.api.overview(filter).pipe(map((res) => res.data)),
      bridge: this.api.varianceBridge(filter).pipe(map((res) => res.data)),
      matrix: this.api.profitabilityMatrix(filter, this.dimension()).pipe(map((res) => res.data)),
    }).pipe(
      tap(({ overview, bridge, matrix }) => {
        this.overview.set(overview);
        this.bridge.set(bridge);
        this.matrix.set(matrix);
      }),
      catchError((error: unknown) => {
        this.failed.set(true);

        throw error;
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  loadMatrix(): Observable<ProfitabilityMatrixResponse> {
    this.matrixLoading.set(true);

    return this.api.profitabilityMatrix(this.filters(), this.dimension()).pipe(
      map((res) => res.data),
      tap((matrix) => this.matrix.set(matrix)),
      finalize(() => this.matrixLoading.set(false)),
    );
  }

  setScenario(patch: Partial<WhatIfScenario>): void {
    this.scenario.update((scenario) => ({ ...scenario, ...patch }));
  }

  resetScenario(): void {
    this.scenario.set({ ...DEFAULT_SCENARIO });
    this.simulation.set(null);
  }

  /** Runs the scenario on the actuals of the current filter. */
  runSimulation(): Observable<WhatIfSimulationResult> {
    this.simulating.set(true);

    return this.api.simulate(this.filters(), this.scenario()).pipe(
      map((res) => res.data),
      tap((result) => this.simulation.set(result)),
      finalize(() => this.simulating.set(false)),
    );
  }

  openDrill(target: DrillTarget): Observable<DrillDownResponse> {
    this.drillTarget.set(target);
    this.drill.set(null);

    return this.loadDrillPage(1);
  }

  loadDrillPage(page: number): Observable<DrillDownResponse> {
    const target = this.drillTarget();

    if (target === null) {
      return EMPTY;
    }

    this.drillLoading.set(true);
    this.drillPage.set(page);

    return this.api.drillDown(this.filters(), target, page, DRILL_PAGE_SIZE).pipe(
      map((res) => res.data),
      tap((drill) => this.drill.set(drill)),
      finalize(() => this.drillLoading.set(false)),
    );
  }

  closeDrill(): void {
    this.drillTarget.set(null);
    this.drill.set(null);
  }

  exportBoardPack(format: BoardPackFormat, locale: string): Observable<Blob> {
    this.exporting.set(true);

    return this.api
      .exportBoardPack(this.filters(), format, locale)
      .pipe(finalize(() => this.exporting.set(false)));
  }
}
