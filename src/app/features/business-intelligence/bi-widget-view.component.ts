import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { BiDrillStep, BiWidget, BiWidgetData, BiWidgetDataFilters, BusinessIntelligenceApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { BiChartComponent } from './bi-chart.component';
import { BiPivotTableComponent } from './bi-pivot-table.component';
import { apiErrorText, firstMeasure, formatBiValue } from './bi.util';

/**
 * One widget of a dashboard: a number, a table, a chart or a pivot, with the drill-down of its drill path. The figures come
 * from the data of the dashboard; a drill-down asks the API for the widget alone with the chosen steps, so every level is
 * computed (and authorised) by the server.
 */
@Component({
  selector: 'app-bi-widget-view',
  imports: [BiChartComponent, BiPivotTableComponent, NzAlertModule, NzButtonModule, NzEmptyModule, NzSpinModule, NzTableModule, TranslatePipe],
  template: `
    @if (error(); as message) {
      <nz-alert nzType="warning" nzShowIcon [nzMessage]="message"></nz-alert>
    } @else {
      <nz-spin [nzSpinning]="loading()">
        @if (steps().length > 0) {
          <div class="bi-drill">
            <button nz-button nzType="link" nzSize="small" (click)="drillUp()">
              <i class="fa-solid fa-arrow-up" aria-hidden="true"></i> {{ 'BI.DRILL_UP' | translate }}
            </button>
            <span class="bi-crumbs">{{ crumbs() }}</span>
          </div>
        }
        @if (current(); as shown) {
          @switch (widget().widget_type) {
            @case ('kpi') {
              <div class="bi-kpi">
                <span class="bi-kpi-value">{{ kpiValue() }}</span>
                <span class="bi-kpi-label">{{ kpiLabel() }}</span>
              </div>
            }
            @case ('bar') {
              <app-bi-chart [result]="shown.result" type="bar" [label]="widget().title" (pointClick)="drillInto($event)"></app-bi-chart>
            }
            @case ('line') {
              <app-bi-chart [result]="shown.result" type="line" [label]="widget().title" (pointClick)="drillInto($event)"></app-bi-chart>
            }
            @case ('pie') {
              <app-bi-chart [result]="shown.result" type="pie" [label]="widget().title" (pointClick)="drillInto($event)"></app-bi-chart>
            }
            @case ('pivot') {
              @if (shown.pivot) {
                <app-bi-pivot-table [pivot]="shown.pivot"></app-bi-pivot-table>
              } @else {
                <nz-empty [nzNotFoundContent]="'BI.NO_PIVOT_LAYOUT' | translate"></nz-empty>
              }
            }
            @default {
              @if (shown.result; as result) {
                <nz-table #table [nzData]="result.rows" nzSize="small" [nzPageSize]="10" [nzShowPagination]="result.rows.length > 10">
                  <thead>
                    <tr>
                      @for (column of result.columns; track column.key) {
                        <th [class.num]="column.kind !== 'dimension'">{{ column.label }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of table.data; track $index) {
                      <tr>
                        @for (column of result.columns; track column.key) {
                          @if (column.kind === 'dimension') {
                            <td>
                              @if (canDrill()) {
                                <a role="button" tabindex="0" (click)="drillInto({ raw: asRaw(row[column.key]) })" (keydown.enter)="drillInto({ raw: asRaw(row[column.key]) })">{{ row[column.key] ?? '-' }}</a>
                              } @else {
                                {{ row[column.key] ?? '-' }}
                              }
                            </td>
                          } @else {
                            <td class="num">{{ format(row[column.key], column.unit) }}</td>
                          }
                        }
                      </tr>
                    }
                  </tbody>
                </nz-table>
                @if (result.meta.truncated) {
                  <small class="bi-truncated">{{ 'BI.TRUNCATED' | translate: { count: result.meta.row_limit } }}</small>
                }
              }
            }
          }
        } @else {
          <nz-empty [nzNotFoundContent]="'BI.NO_DATA' | translate"></nz-empty>
        }
      </nz-spin>
    }
  `,
  styles: `
    .bi-kpi { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; }
    .bi-kpi-value { font-size: 32px; font-weight: 600; }
    .bi-kpi-label { color: var(--text-secondary, #595959); }
    .bi-drill { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .bi-crumbs, .bi-truncated { color: var(--text-secondary, #595959); font-size: 12px; }
    .num { text-align: right; }
  `,
})
export class BiWidgetViewComponent {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly translate = inject(TranslateService);

  readonly widget = input.required<BiWidget>();
  /** The data of the dashboard for this widget (loaded by the dashboard). */
  readonly data = input<BiWidgetData | undefined>(undefined);
  /** The filters the viewer applied to the dashboard: they also apply to every drill-down level. */
  readonly view = input<Pick<BiWidgetDataFilters, 'period' | 'filters'>>({});

  readonly steps = signal<BiDrillStep[]>([]);
  readonly loading = signal(false);
  private readonly drilled = signal<BiWidgetData | null>(null);
  private readonly drillError = signal<string | null>(null);

  readonly current = computed<BiWidgetData | null>(() => {
    const shown = this.steps().length > 0 ? this.drilled() : (this.data() ?? null);
    return shown?.status === 'ok' ? shown : null;
  });

  readonly error = computed(() => this.drillError() ?? (this.data()?.status === 'error' ? this.data()?.error : null) ?? null);
  readonly canDrill = computed(() => this.widget().widget_type === 'table' && (this.current()?.drill?.next_dimension ?? null) !== null);

  readonly crumbs = computed(() => this.steps().map((step) => step.value ?? '-').join(' › '));

  readonly kpiValue = computed(() => {
    const result = this.current()?.result;
    const measure = result ? firstMeasure(result) : undefined;
    const row = result?.rows[0];
    return measure && row ? formatBiValue(row[measure.key], measure.unit) : '-';
  });

  readonly kpiLabel = computed(() => {
    const result = this.current()?.result;
    return (result ? firstMeasure(result)?.label : null) ?? '';
  });

  constructor() {
    // New data of the dashboard (a filter changed, the dashboard reloaded) closes any drill-down.
    effect(() => {
      this.data();
      this.view();
      untracked(() => {
        this.steps.set([]);
        this.drilled.set(null);
        this.drillError.set(null);
      });
    });
  }

  drillInto(point: { raw: string | null }): void {
    const drill = this.current()?.drill;
    const dimension = drill?.current_dimension;
    if (!dimension || !drill?.next_dimension) {
      return;
    }

    this.load([...this.steps(), { dimension, value: point.raw }]);
  }

  drillUp(): void {
    const steps = this.steps().slice(0, -1);
    if (steps.length === 0) {
      this.steps.set([]);
      this.drilled.set(null);
      this.drillError.set(null);
      return;
    }

    this.load(steps);
  }

  format(value: unknown, unit: string | undefined): string {
    return formatBiValue(value, unit as never);
  }

  asRaw(value: unknown): string | null {
    return value === null || value === undefined ? null : String(value);
  }

  private load(steps: BiDrillStep[]): void {
    this.loading.set(true);
    this.api.getWidgetData(this.widget().id, { ...this.view(), drill: steps }).subscribe({
      next: (response) => {
        this.steps.set(steps);
        this.drilled.set(response.data);
        this.drillError.set(null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.drillError.set(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR'));
        this.loading.set(false);
      },
    });
  }
}
