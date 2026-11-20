import { computed, inject, Service, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { AiForecastingApiService } from './ai-forecasting-api.service';
import {
  Accuracy,
  AppliedReorderRule,
  ConfidenceBands,
  DemandFilters,
  LiquidityHorizonDays,
  LiquidityRun,
  PaymentBehavior,
  SkuForecast,
  TrainResult,
  WhatIfParameters,
} from './ai-forecasting.models';
import { runwayFromBands } from './ai-forecasting.utils';

/**
 * Signal state of the AI forecasting area. Every action returns the underlying observable, already wired to update the
 * signals, so a component only subscribes and reports the outcome to the user.
 */
@Service()
export class AiForecastingStore {
  private readonly api = inject(AiForecastingApiService);

  readonly horizon = signal<LiquidityHorizonDays>(91);
  readonly bands = signal<ConfidenceBands | null>(null);
  /** True once the tenant has been asked and has no run for the horizon yet. */
  readonly noRun = signal(false);
  readonly paymentModels = signal<PaymentBehavior[]>([]);
  /** Result of the last what-if preview (not stored on the server). */
  readonly preview = signal<LiquidityRun | null>(null);
  readonly previewing = signal(false);
  readonly demandRows = signal<SkuForecast[]>([]);
  readonly demandFilters = signal<DemandFilters>({});
  readonly accuracy = signal<Accuracy | null>(null);
  readonly selectedForecastIds = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(false);
  readonly busy = signal(false);

  /** Days until the expected balance turns negative; null when it stays positive over the horizon. */
  readonly runway = computed(() => {
    const bands = this.bands();

    return bands === null ? null : runwayFromBands(bands);
  });
  readonly troughAlert = computed(() => (this.bands()?.trough?.balance ?? 0) < 0);
  /** Difference of the previewed trough to the stored one, in the currency of the run. */
  readonly previewDelta = computed(() => {
    const preview = this.preview()?.trough;
    const stored = this.bands()?.trough;

    return preview && stored ? preview.balance - stored.balance : null;
  });
  readonly warehouses = computed(() => {
    const names = new Map<string, string>();

    for (const row of this.demandRows()) {
      names.set(row.warehouse_id, row.warehouse_name ?? row.warehouse_id);
    }

    return [...names].map(([id, name]) => ({ id, name }));
  });
  readonly selectedRows = computed(() =>
    this.demandRows().filter((row) => this.selectedForecastIds().has(row.forecast_id)),
  );

  setHorizon(days: LiquidityHorizonDays): void {
    this.horizon.set(days);
    this.preview.set(null);
  }

  /** The stored bands of the horizon and the customer risk table. A tenant without a run yet is not an error. */
  loadLiquidity(): Observable<unknown> {
    this.loading.set(true);

    return forkJoin({
      bands: this.api.confidenceBands(this.horizon()).pipe(
        map((res) => res.data),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            return of(null);
          }

          throw error;
        }),
      ),
      models: this.api.paymentModels().pipe(map((res) => res.data)),
    }).pipe(
      tap(({ bands, models }) => {
        this.bands.set(bands);
        this.noRun.set(bands === null);
        this.paymentModels.set(models);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  /** Trains the customer models, so the open receivables are dated with the latest behaviour. */
  train(): Observable<TrainResult> {
    this.busy.set(true);

    return this.api.trainPaymentModels().pipe(
      map((res) => res.data),
      finalize(() => this.busy.set(false)),
    );
  }

  /** Trains the models and stores a fresh projection of the horizon (no what-if). */
  refreshLiquidity(): Observable<LiquidityRun> {
    this.busy.set(true);

    return this.api.trainPaymentModels().pipe(
      switchMap(() => this.api.simulate(this.horizon(), null, false)),
      map((res) => res.data),
      tap(() => this.preview.set(null)),
      finalize(() => this.busy.set(false)),
    );
  }

  previewWhatIf(whatIf: WhatIfParameters): Observable<LiquidityRun> {
    this.previewing.set(true);

    return this.api.simulate(this.horizon(), whatIf, true).pipe(
      map((res) => res.data),
      tap((run) => this.preview.set(run)),
      finalize(() => this.previewing.set(false)),
    );
  }

  resetPreview(): void {
    this.preview.set(null);
  }

  loadDemand(): Observable<unknown> {
    this.loading.set(true);

    return forkJoin({
      rows: this.api.demandForecasts(this.demandFilters()).pipe(map((res) => res.data)),
      accuracy: this.api.accuracy().pipe(map((res) => res.data)),
    }).pipe(
      tap(({ rows, accuracy }) => {
        this.demandRows.set(rows);
        this.accuracy.set(accuracy);
        const known = new Set(rows.map((row) => row.forecast_id));
        this.selectedForecastIds.update((ids) => new Set([...ids].filter((id) => known.has(id))));
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  setDemandFilters(patch: Partial<DemandFilters>): void {
    this.demandFilters.update((current) => ({ ...current, ...patch }));
  }

  generateDemand(periodsAhead: number): Observable<unknown> {
    this.busy.set(true);

    return this.api.generateDemand(periodsAhead).pipe(finalize(() => this.busy.set(false)));
  }

  toggleSelected(forecastId: string, selected: boolean): void {
    this.selectedForecastIds.update((ids) => {
      const next = new Set(ids);

      if (selected) {
        next.add(forecastId);
      } else {
        next.delete(forecastId);
      }

      return next;
    });
  }

  selectAll(selected: boolean): void {
    this.selectedForecastIds.set(
      selected ? new Set(this.demandRows().map((row) => row.forecast_id)) : new Set(),
    );
  }

  /** Writes the recommended thresholds of the forecasts to the warehouse and planning data, and marks the rows applied. */
  applyReorderRules(forecastIds: string[]): Observable<AppliedReorderRule[]> {
    this.busy.set(true);

    return this.api.applyReorderRules(forecastIds).pipe(
      map((res) => res.data),
      tap((applied) => {
        const now = new Date().toISOString();
        const byForecast = new Map(applied.map((rule) => [rule.forecast_id, rule]));

        this.demandRows.update((rows) =>
          rows.map((row) => {
            const rule = byForecast.get(row.forecast_id);

            return rule
              ? {
                  ...row,
                  current_reorder_point: rule.reorder_point,
                  current_safety_stock: rule.safety_stock,
                  applied_to_wms_at: now,
                }
              : row;
          }),
        );
        this.selectedForecastIds.update(
          (ids) => new Set([...ids].filter((id) => !byForecast.has(id))),
        );
      }),
      finalize(() => this.busy.set(false)),
    );
  }
}
