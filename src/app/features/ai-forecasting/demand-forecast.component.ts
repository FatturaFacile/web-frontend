import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableSortFn } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SkuForecast } from './ai-forecasting.models';
import { AiForecastingStore } from './ai-forecasting.store';
import { demandChartOption, needsApply } from './ai-forecasting.utils';
import { ForecastChartComponent } from './forecast-chart.component';

/** SKU demand forecasting: history against forecast, accuracy KPIs and the replenishment grid with one-click apply. */
@Component({
  selector: 'app-demand-forecast',
  styleUrl: './ai-forecasting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    ForecastChartComponent,
  ],
  template: `
    <div class="toolbar" data-testid="demand-filters">
      <nz-select
        class="filter"
        style="min-width: 200px"
        nzAllowClear
        data-testid="warehouse-filter"
        [nzPlaceHolder]="'AI_FORECAST.FILTER_WAREHOUSE' | translate"
        [ngModel]="store.demandFilters().warehouse_id ?? null"
        (ngModelChange)="onWarehouse($event)"
      >
        @for (warehouse of store.warehouses(); track warehouse.id) {
          <nz-option [nzValue]="warehouse.id" [nzLabel]="warehouse.name"></nz-option>
        }
      </nz-select>
      <input
        nz-input
        style="max-width: 260px"
        data-testid="search-filter"
        [attr.aria-label]="'AI_FORECAST.FILTER_SEARCH' | translate"
        [placeholder]="'AI_FORECAST.FILTER_SEARCH' | translate"
        [ngModel]="store.demandFilters().search ?? ''"
        (ngModelChange)="onSearch($event)"
      />
      <nz-select
        style="min-width: 160px"
        data-testid="period-select"
        [attr.aria-label]="'AI_FORECAST.FILTER_PERIOD' | translate"
        [ngModel]="periodsAhead()"
        (ngModelChange)="periodsAhead.set($event)"
      >
        @for (months of periodChoices; track months) {
          <nz-option
            [nzValue]="months"
            [nzLabel]="'AI_FORECAST.PERIOD_MONTHS' | translate: { months }"
          ></nz-option>
        }
      </nz-select>
      <span class="spacer"></span>
      <button
        nz-button
        nzType="primary"
        data-testid="generate-forecast"
        [nzLoading]="store.busy()"
        (click)="generate()"
      >
        {{ 'AI_FORECAST.GENERATE' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <div class="kpi-grid" data-testid="accuracy-kpis">
        <nz-card>
          <nz-statistic
            [nzTitle]="'AI_FORECAST.KPI_MAPE' | translate"
            [nzValue]="(store.accuracy()?.global?.mape | number: '1.0-1') ?? '–'"
            nzSuffix="%"
            data-testid="kpi-mape"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'AI_FORECAST.KPI_WAPE' | translate"
            [nzValue]="(store.accuracy()?.global?.wape | number: '1.0-1') ?? '–'"
            nzSuffix="%"
            data-testid="kpi-wape"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'AI_FORECAST.KPI_SAMPLES' | translate"
            [nzValue]="store.accuracy()?.global?.sample_size ?? 0"
          ></nz-statistic>
        </nz-card>
      </div>

      @if (chartRow(); as row) {
        <nz-card [nzTitle]="('AI_FORECAST.CHART_TITLE' | translate) + ' · ' + row.sku">
          <app-forecast-chart
            testId="demand-chart"
            [option]="chartOption()"
            [label]="'AI_FORECAST.CHART_TITLE' | translate"
          ></app-forecast-chart>
        </nz-card>
      }
    </nz-spin>

    <nz-card [nzTitle]="'AI_FORECAST.GRID_TITLE' | translate">
      <div class="toolbar">
        <button
          nz-button
          nzType="primary"
          data-testid="bulk-apply"
          nz-popconfirm
          [nzPopconfirmTitle]="'AI_FORECAST.APPLY_BULK_CONFIRM' | translate"
          [disabled]="store.selectedRows().length === 0 || store.busy()"
          (nzOnConfirm)="apply(selectedIds())"
        >
          {{ 'AI_FORECAST.APPLY_SELECTED' | translate }} ({{ store.selectedRows().length }})
        </button>
      </div>
      <nz-table
        #grid
        nzSize="small"
        data-testid="replenishment-grid"
        [nzData]="store.demandRows()"
        [nzPageSize]="15"
        [nzShowPagination]="store.demandRows().length > 15"
      >
        <thead>
          <tr>
            <th
              nzWidth="40px"
              [nzChecked]="allSelected()"
              [nzIndeterminate]="someSelected()"
              (nzCheckedChange)="store.selectAll($event)"
            ></th>
            <th [nzSortFn]="bySku">{{ 'AI_FORECAST.COL_SKU' | translate }}</th>
            <th>{{ 'AI_FORECAST.COL_WAREHOUSE' | translate }}</th>
            <th nzAlign="right">{{ 'AI_FORECAST.COL_STOCK' | translate }}</th>
            <th nzAlign="right">{{ 'AI_FORECAST.COL_ROP' | translate }}</th>
            <th nzAlign="right">{{ 'AI_FORECAST.COL_SS' | translate }}</th>
            <th nzAlign="right" [nzSortFn]="bySeasonality">
              {{ 'AI_FORECAST.COL_SEASONALITY' | translate }}
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of grid.data; track row.forecast_id) {
            <tr [attr.data-testid]="'row-' + row.sku">
              <td
                [nzChecked]="store.selectedForecastIds().has(row.forecast_id)"
                (nzCheckedChange)="store.toggleSelected(row.forecast_id, $event)"
              ></td>
              <td>
                <a
                  role="button"
                  tabindex="0"
                  (click)="chartFor.set(row.forecast_id)"
                  (keydown.enter)="chartFor.set(row.forecast_id)"
                  >{{ row.sku }}</a
                >
                <div class="muted">{{ row.product_name }}</div>
              </td>
              <td>{{ row.warehouse_name }}</td>
              <td class="right">{{ row.current_stock | number: '1.0-0' }}</td>
              <td class="right">
                {{
                  row.current_reorder_point === null
                    ? '–'
                    : (row.current_reorder_point | number: '1.0-0')
                }}
                →
                <strong data-testid="recommended-rop">{{
                  row.recommended_reorder_point | number: '1.0-0'
                }}</strong>
              </td>
              <td class="right">
                {{
                  row.current_safety_stock === null
                    ? '–'
                    : (row.current_safety_stock | number: '1.0-0')
                }}
                →
                <strong>{{ row.recommended_safety_stock | number: '1.0-0' }}</strong>
              </td>
              <td class="right">{{ row.seasonality_index | number: '1.2-2' }}</td>
              <td>
                @if (row.applied_to_wms_at) {
                  <nz-tag nzColor="green">{{ 'AI_FORECAST.APPLIED' | translate }}</nz-tag>
                } @else {
                  <button
                    nz-button
                    nzSize="small"
                    nz-popconfirm
                    [attr.data-testid]="'apply-' + row.sku"
                    [nzPopconfirmTitle]="'AI_FORECAST.APPLY_CONFIRM' | translate"
                    [disabled]="store.busy() || !worthApplying(row)"
                    (nzOnConfirm)="apply([row.forecast_id])"
                  >
                    {{ 'AI_FORECAST.APPLY_ONE' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class DemandForecastComponent implements OnInit {
  protected readonly store = inject(AiForecastingStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly periodChoices = [1, 3, 6, 12];
  protected readonly periodsAhead = signal(1);
  protected readonly chartFor = signal<string | null>(null);

  /** The row the chart shows: the one picked in the grid, the first one otherwise. */
  protected readonly chartRow = computed<SkuForecast | null>(() => {
    const rows = this.store.demandRows();

    return rows.find((row) => row.forecast_id === this.chartFor()) ?? rows[0] ?? null;
  });
  protected readonly chartOption = computed(() => {
    const row = this.chartRow();

    return row === null
      ? null
      : demandChartOption(row, {
          actual: this.i18n.instant('AI_FORECAST.SERIES_ACTUAL'),
          forecast: this.i18n.instant('AI_FORECAST.SERIES_FORECAST'),
          lower: this.i18n.instant('AI_FORECAST.SERIES_LOWER'),
          upper: this.i18n.instant('AI_FORECAST.SERIES_UPPER'),
        });
  });
  protected readonly allSelected = computed(
    () =>
      this.store.demandRows().length > 0 &&
      this.store.selectedRows().length === this.store.demandRows().length,
  );
  protected readonly someSelected = computed(
    () => this.store.selectedRows().length > 0 && !this.allSelected(),
  );

  protected readonly bySku: NzTableSortFn<SkuForecast> = (a, b) => a.sku.localeCompare(b.sku);
  protected readonly bySeasonality: NzTableSortFn<SkuForecast> = (a, b) =>
    a.seasonality_index - b.seasonality_index;
  protected readonly worthApplying = needsApply;

  ngOnInit(): void {
    this.load();
  }

  protected selectedIds(): string[] {
    return this.store.selectedRows().map((row) => row.forecast_id);
  }

  protected onWarehouse(id: string | null): void {
    this.store.setDemandFilters({ warehouse_id: id ?? undefined });
    this.load();
  }

  protected onSearch(search: string): void {
    this.store.setDemandFilters({ search });
    this.load();
  }

  protected generate(): void {
    this.store.generateDemand(this.periodsAhead()).subscribe({
      next: () => {
        this.message.success(this.i18n.instant('AI_FORECAST.GENERATED'));
        this.load();
      },
      error: () => this.message.error(this.i18n.instant('AI_FORECAST.GENERATE_ERROR')),
    });
  }

  protected apply(forecastIds: string[]): void {
    this.store.applyReorderRules(forecastIds).subscribe({
      next: (applied) =>
        this.message.success(
          this.i18n.instant('AI_FORECAST.APPLIED_COUNT', { count: applied.length }),
        ),
      error: () => this.message.error(this.i18n.instant('AI_FORECAST.APPLY_ERROR')),
    });
  }

  private load(): void {
    this.store.loadDemand().subscribe({
      error: () => this.message.error(this.i18n.instant('AI_FORECAST.LOAD_ERROR')),
    });
  }
}
