import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableSortFn } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, debounceTime, EMPTY, skip, switchMap } from 'rxjs';
import {
  ConfidenceBands,
  LiquidityHorizonDays,
  LiquidityRun,
  PaymentBehavior,
  WhatIfParameters,
} from './ai-forecasting.models';
import { AiForecastingStore } from './ai-forecasting.store';
import {
  DEFAULT_WHAT_IF,
  fanChartOption,
  isNeutralWhatIf,
  riskTierColor,
  runwayFromBands,
  WHAT_IF_RANGES,
} from './ai-forecasting.utils';
import { ForecastChartComponent } from './forecast-chart.component';

/** The chart series of a previewed run, so the fan chart can draw it like a stored one. */
export function runToBands(run: LiquidityRun): ConfidenceBands {
  return {
    run_id: run.id,
    generated_at: run.generated_at,
    horizon_days: run.horizon_days,
    currency: run.currency,
    starting_cash_balance: run.starting_cash_balance,
    dates: run.daily_projections.map((day) => day.date),
    p10: run.daily_projections.map((day) => day.balance.p10),
    p50: run.daily_projections.map((day) => day.balance.p50),
    p90: run.daily_projections.map((day) => day.balance.p90),
    statutoryEvents: run.daily_projections.flatMap((day) => day.statutory_outflows),
    keyDrivers: run.key_drivers,
    whatIf: run.what_if_parameters,
    trough: run.trough,
  };
}

const TIER_ORDER: Record<PaymentBehavior['payment_risk_tier'], number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

/** AI liquidity forecast: P10/P50/P90 fan chart with the CH/IT statutory outflows, what-if simulation and customer payment risk. */
@Component({
  selector: 'app-liquidity-forecast',
  styleUrl: './ai-forecasting.scss',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    PercentPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzSegmentedModule,
    NzSliderModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    ForecastChartComponent,
  ],
  template: `
    <div class="toolbar">
      <nz-segmented
        data-testid="horizon-switcher"
        [nzOptions]="horizonOptions()"
        [ngModel]="store.horizon()"
        (nzValueChange)="onHorizon($event)"
      ></nz-segmented>
      <span class="spacer"></span>
      <button nz-button data-testid="open-what-if" (click)="drawerOpen.set(true)">
        {{ 'AI_FORECAST.WHAT_IF' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        data-testid="refresh-forecast"
        [nzLoading]="store.busy()"
        (click)="refresh()"
      >
        {{ 'AI_FORECAST.REFRESH' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (shown(); as bands) {
        @if (store.preview()) {
          <nz-alert
            nzType="info"
            nzShowIcon
            data-testid="preview-banner"
            [nzMessage]="'AI_FORECAST.PREVIEW_BANNER' | translate"
          ></nz-alert>
        }
        @if ((bands.trough?.balance ?? 0) < 0) {
          <nz-alert
            nzType="error"
            nzShowIcon
            data-testid="trough-alert"
            [nzMessage]="'AI_FORECAST.TROUGH_ALERT' | translate"
            [nzDescription]="
              format(bands.trough?.balance ?? 0) + ' · ' + (bands.trough?.date | date: 'mediumDate')
            "
          ></nz-alert>
        }

        <div class="kpi-grid" data-testid="liquidity-kpis">
          <nz-card>
            <nz-statistic
              [nzTitle]="'AI_FORECAST.KPI_STARTING_CASH' | translate"
              [nzValue]="format(bands.starting_cash_balance)"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'AI_FORECAST.KPI_TROUGH' | translate"
              [nzValue]="format(bands.trough?.balance ?? 0)"
            ></nz-statistic>
            <div class="muted">{{ bands.trough?.date | date: 'mediumDate' }}</div>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'AI_FORECAST.KPI_RUNWAY' | translate"
              [nzValue]="runwayText()"
              data-testid="runway"
            ></nz-statistic>
          </nz-card>
          @if (store.previewDelta(); as delta) {
            <nz-card>
              <nz-statistic
                [nzTitle]="'AI_FORECAST.KPI_PREVIEW_DELTA' | translate"
                [nzValue]="format(delta)"
                data-testid="preview-delta"
              ></nz-statistic>
            </nz-card>
          }
        </div>

        <nz-card [nzTitle]="'AI_FORECAST.FAN_CHART_TITLE' | translate">
          <app-forecast-chart
            testId="fan-chart"
            [option]="fanOption()"
            [label]="'AI_FORECAST.FAN_CHART_TITLE' | translate"
          ></app-forecast-chart>
        </nz-card>

        <div class="drivers" data-testid="key-drivers">
          <nz-card [nzTitle]="'AI_FORECAST.DRIVER_OVERDUE' | translate" nzSize="small">
            <ul>
              @for (invoice of bands.keyDrivers.overdue_invoices; track invoice.invoice_id) {
                <li>
                  <span>{{ invoice.customer_name }} · {{ invoice.invoice_number }}</span>
                  <span>{{ format(invoice.open_amount) }}</span>
                </li>
              } @empty {
                <li class="muted">{{ 'AI_FORECAST.NONE' | translate }}</li>
              }
            </ul>
          </nz-card>
          <nz-card [nzTitle]="'AI_FORECAST.DRIVER_STATUTORY' | translate" nzSize="small">
            <ul>
              @for (
                event of bands.keyDrivers.statutory_liabilities;
                track event.date + event.code
              ) {
                <li>
                  <span>{{ eventName(event.code) }} · {{ event.date | date: 'mediumDate' }}</span>
                  <span>{{ format(event.amount) }}</span>
                </li>
              } @empty {
                <li class="muted">{{ 'AI_FORECAST.NONE' | translate }}</li>
              }
            </ul>
          </nz-card>
          <nz-card [nzTitle]="'AI_FORECAST.DRIVER_DELAYS' | translate" nzSize="small">
            <ul>
              @for (delay of bands.keyDrivers.customer_delays; track delay.customer_id) {
                <li>
                  <span>{{ delay.customer_name }} · +{{ delay.predicted_delay_days }}d</span>
                  <span>{{ format(delay.open_amount) }}</span>
                </li>
              } @empty {
                <li class="muted">{{ 'AI_FORECAST.NONE' | translate }}</li>
              }
            </ul>
          </nz-card>
        </div>
      } @else if (store.noRun()) {
        <div data-testid="no-run">
          <nz-empty [nzNotFoundContent]="'AI_FORECAST.NO_RUN' | translate"></nz-empty>
          <div class="toolbar">
            <span class="spacer"></span>
            <button
              nz-button
              nzType="primary"
              data-testid="run-simulation"
              [nzLoading]="store.busy()"
              (click)="refresh()"
            >
              {{ 'AI_FORECAST.RUN_SIMULATION' | translate }}
            </button>
            <span class="spacer"></span>
          </div>
        </div>
      }
    </nz-spin>

    <nz-card [nzTitle]="'AI_FORECAST.RISK_TABLE_TITLE' | translate">
      <nz-table
        #risk
        nzSize="small"
        data-testid="risk-table"
        [nzData]="store.paymentModels()"
        [nzPageSize]="10"
        [nzShowPagination]="store.paymentModels().length > 10"
      >
        <thead>
          <tr>
            <th [nzSortFn]="byName">{{ 'AI_FORECAST.COL_CUSTOMER' | translate }}</th>
            <th [nzSortFn]="byAverage" nzAlign="right">
              {{ 'AI_FORECAST.COL_AVG_DAYS_LATE' | translate }}
            </th>
            <th [nzSortFn]="byProbability" nzAlign="right">
              {{ 'AI_FORECAST.COL_ON_TIME' | translate }}
            </th>
            <th [nzSortFn]="byTier" nzSortOrder="descend">
              {{ 'AI_FORECAST.COL_RISK' | translate }}
            </th>
            <th>{{ 'AI_FORECAST.COL_COLLECTION' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of risk.data; track row.id) {
            <tr>
              <td>{{ row.customer_name ?? row.customer_id }}</td>
              <td class="right">{{ row.average_days_late | number: '1.0-1' }}</td>
              <td class="right">{{ row.on_time_payment_probability | percent: '1.0-0' }}</td>
              <td>
                <nz-tag [nzColor]="tierColor(row.payment_risk_tier)">
                  {{ 'AI_FORECAST.TIER_' + row.payment_risk_tier.toUpperCase() | translate }}
                </nz-tag>
              </td>
              <td>
                @for (invoice of row.open_invoices; track invoice.invoice_id) {
                  <div>
                    {{ invoice.invoice_number }} ·
                    {{ invoice.expected_collection_date | date: 'mediumDate' }} ·
                    {{ format(invoice.open_amount) }}
                  </div>
                } @empty {
                  <span class="muted">{{ 'AI_FORECAST.NONE' | translate }}</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      nzPlacement="right"
      [nzWidth]="380"
      [nzTitle]="'AI_FORECAST.WHAT_IF_TITLE' | translate"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <div class="what-if" data-testid="what-if-panel">
          <span class="label" id="what-if-delay">{{ 'AI_FORECAST.SLIDER_DELAY' | translate }}</span>
          <nz-slider
            data-testid="slider-delay"
            aria-labelledby="what-if-delay"
            [nzMin]="ranges.delay.min"
            [nzMax]="ranges.delay.max"
            [ngModel]="whatIf().global_customer_delay_shift_days"
            (ngModelChange)="patch({ global_customer_delay_shift_days: $event })"
          ></nz-slider>
          <span class="value">{{ whatIf().global_customer_delay_shift_days }} d</span>

          <span class="label" id="what-if-sales">{{ 'AI_FORECAST.SLIDER_SALES' | translate }}</span>
          <nz-slider
            data-testid="slider-sales"
            aria-labelledby="what-if-sales"
            [nzMin]="ranges.sales.min"
            [nzMax]="ranges.sales.max"
            [ngModel]="whatIf().revenue_growth_percentage"
            (ngModelChange)="patch({ revenue_growth_percentage: $event })"
          ></nz-slider>
          <span class="value">{{ whatIf().revenue_growth_percentage }} %</span>

          <span class="label" id="what-if-suppliers">{{
            'AI_FORECAST.SLIDER_SUPPLIERS' | translate
          }}</span>
          <nz-slider
            data-testid="slider-suppliers"
            aria-labelledby="what-if-suppliers"
            [nzMin]="ranges.suppliers.min"
            [nzMax]="ranges.suppliers.max"
            [ngModel]="whatIf().supplier_payment_extension_days"
            (ngModelChange)="patch({ supplier_payment_extension_days: $event })"
          ></nz-slider>
          <span class="value">{{ whatIf().supplier_payment_extension_days }} d</span>

          <p class="muted">
            @if (store.previewing()) {
              {{ 'AI_FORECAST.PREVIEW_RUNNING' | translate }}
            } @else if (store.previewDelta(); as delta) {
              {{ 'AI_FORECAST.PREVIEW_DELTA_HINT' | translate }}
              <strong [class]="delta < 0 ? 'delta-negative' : 'delta-positive'">{{
                format(delta)
              }}</strong>
            }
          </p>
          <button nz-button data-testid="reset-what-if" (click)="reset()">
            {{ 'AI_FORECAST.RESET' | translate }}
          </button>
        </div>
      </ng-container>
    </nz-drawer>
  `,
})
export class LiquidityForecastComponent implements OnInit {
  protected readonly store = inject(AiForecastingStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly ranges = WHAT_IF_RANGES;
  protected readonly drawerOpen = signal(false);
  protected readonly whatIf = signal<WhatIfParameters>({ ...DEFAULT_WHAT_IF });

  protected readonly horizonOptions = computed(() => [
    { label: this.i18n.instant('AI_FORECAST.HORIZON_13_WEEKS'), value: 91 },
    { label: this.i18n.instant('AI_FORECAST.HORIZON_12_MONTHS'), value: 365 },
  ]);

  /** The bands on screen: the previewed what-if run when there is one, the stored run otherwise. */
  protected readonly shown = computed<ConfidenceBands | null>(() => {
    const preview = this.store.preview();

    return preview ? runToBands(preview) : this.store.bands();
  });

  protected readonly fanOption = computed(() => {
    const bands = this.shown();

    return bands === null
      ? null
      : fanChartOption(bands, {
          p10: this.i18n.instant('AI_FORECAST.P10'),
          p50: this.i18n.instant('AI_FORECAST.P50'),
          p90: this.i18n.instant('AI_FORECAST.P90'),
          event: (code) => this.eventName(code),
          format: (value) => this.formatCurrency(value, bands.currency),
        });
  });

  protected readonly runwayText = computed(() => {
    const bands = this.shown();
    const days = bands === null ? null : runwayFromBands(bands);

    return days === null
      ? this.i18n.instant('AI_FORECAST.RUNWAY_SAFE')
      : this.i18n.instant('AI_FORECAST.RUNWAY_DAYS', { days });
  });

  protected readonly byName: NzTableSortFn<PaymentBehavior> = (a, b) =>
    (a.customer_name ?? '').localeCompare(b.customer_name ?? '');
  protected readonly byAverage: NzTableSortFn<PaymentBehavior> = (a, b) =>
    a.average_days_late - b.average_days_late;
  protected readonly byProbability: NzTableSortFn<PaymentBehavior> = (a, b) =>
    a.on_time_payment_probability - b.on_time_payment_probability;
  protected readonly byTier: NzTableSortFn<PaymentBehavior> = (a, b) =>
    TIER_ORDER[a.payment_risk_tier] - TIER_ORDER[b.payment_risk_tier] ||
    a.predicted_collection_date_offset_days - b.predicted_collection_date_offset_days;

  constructor() {
    // The sliders write the signal; a pause of 350 ms triggers one preview of the whole scenario.
    toObservable(computed(() => ({ whatIf: this.whatIf(), horizon: this.store.horizon() })))
      .pipe(
        skip(1),
        debounceTime(350),
        switchMap(({ whatIf }) => {
          if (isNeutralWhatIf(whatIf)) {
            this.store.resetPreview();

            return EMPTY;
          }

          return this.store.previewWhatIf(whatIf).pipe(
            catchError(() => {
              this.message.error(this.i18n.instant('AI_FORECAST.PREVIEW_ERROR'));

              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.load();
  }

  protected onHorizon(value: number | string): void {
    this.store.setHorizon(Number(value) as LiquidityHorizonDays);
    this.load();
  }

  protected patch(change: Partial<WhatIfParameters>): void {
    this.whatIf.update((current) => ({ ...current, ...change }));
  }

  protected reset(): void {
    this.whatIf.set({ ...DEFAULT_WHAT_IF });
  }

  protected refresh(): void {
    this.store.refreshLiquidity().subscribe({
      next: () => {
        this.message.success(this.i18n.instant('AI_FORECAST.REFRESHED'));
        this.load();
      },
      error: () => this.message.error(this.i18n.instant('AI_FORECAST.REFRESH_ERROR')),
    });
  }

  protected tierColor = riskTierColor;

  protected eventName(code: string): string {
    return this.i18n.instant(`AI_FORECAST.EVENT_${code}`);
  }

  protected format(value: number): string {
    return this.formatCurrency(value, this.shown()?.currency ?? 'EUR');
  }

  private formatCurrency(value: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }

  private load(): void {
    this.store.loadLiquidity().subscribe({
      error: () => this.message.error(this.i18n.instant('AI_FORECAST.LOAD_ERROR')),
    });
  }
}
