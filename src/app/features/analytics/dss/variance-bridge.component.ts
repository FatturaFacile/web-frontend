import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { DrillMetric, ReportingCurrency, VarianceBridgeResponse } from './dss.models';
import { bridgeDrillMetric, formatAmount, waterfallOption } from './dss.utils';
import { DssChartComponent } from './dss-chart.component';

type BridgeMetric = 'ebitda' | 'revenue';

/**
 * EBITDA and revenue variance waterfall: baseline, volume, price, COGS, OPEX and FX effects, actual. Clicking a bar opens the
 * records behind it.
 */
@Component({
  selector: 'app-variance-bridge',
  styleUrl: './dss.scss',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzCardModule,
    NzSegmentedModule,
    DssChartComponent,
  ],
  template: `
    <nz-card [nzTitle]="'EXEC_DSS.BRIDGE_TITLE' | translate" data-testid="variance-bridge">
      <div class="toolbar">
        <nz-segmented
          data-testid="bridge-metric"
          [nzOptions]="metricOptions()"
          [ngModel]="metric()"
          (nzValueChange)="onMetric($event)"
        ></nz-segmented>
      </div>
      @if (bridge(); as data) {
        @if (data.baseline.budget_found === false) {
          <nz-alert
            nzType="warning"
            nzShowIcon
            data-testid="budget-missing"
            [nzMessage]="'EXEC_DSS.BUDGET_MISSING' | translate"
          ></nz-alert>
        }
        @if (data.volume_basis === 'unit_fallback') {
          <p class="muted" data-testid="volume-fallback">
            {{ 'EXEC_DSS.VOLUME_FALLBACK' | translate }}
          </p>
        }
        <app-dss-chart
          testId="bridge-chart"
          [label]="'EXEC_DSS.BRIDGE_TITLE' | translate"
          [option]="option()"
          [pointClick]="barClick"
        ></app-dss-chart>
      } @else {
        <p class="muted">{{ 'EXEC_DSS.EMPTY' | translate }}</p>
      }
    </nz-card>
  `,
})
export class VarianceBridgeComponent {
  private readonly i18n = inject(TranslateService);

  readonly bridge = input.required<VarianceBridgeResponse | null>();
  readonly currency = input.required<ReportingCurrency>();
  /** The user clicked a bar that has records behind it. */
  readonly drill = output<{ metric: DrillMetric; label: string }>();

  protected readonly metric = signal<BridgeMetric>('ebitda');
  protected readonly metricOptions = computed(() => [
    { label: this.i18n.instant('EXEC_DSS.BRIDGE_EBITDA'), value: 'ebitda' },
    { label: this.i18n.instant('EXEC_DSS.BRIDGE_REVENUE'), value: 'revenue' },
  ]);

  protected readonly steps = computed(() => {
    const data = this.bridge();

    return data === null
      ? []
      : this.metric() === 'ebitda'
        ? data.ebitda_bridge
        : data.revenue_bridge;
  });

  protected readonly option = computed(() =>
    this.steps().length === 0
      ? null
      : waterfallOption(this.steps(), {
          step: (key) => this.i18n.instant(`EXEC_DSS.STEP_${key.toUpperCase()}`),
          format: (value) => formatAmount(value, this.currency(), this.i18n.currentLanguage()),
          increase: this.i18n.instant('EXEC_DSS.BRIDGE_INCREASE'),
          decrease: this.i18n.instant('EXEC_DSS.BRIDGE_DECREASE'),
          total: this.i18n.instant('EXEC_DSS.BRIDGE_TOTAL'),
        }),
  );

  protected readonly barClick = (index: number): void => {
    const step = this.steps()[index];

    if (step) {
      this.drill.emit({
        metric: bridgeDrillMetric(step.key),
        label: this.i18n.instant(`EXEC_DSS.STEP_${step.key.toUpperCase()}`),
      });
    }
  };

  protected onMetric(value: string | number): void {
    this.metric.set(value === 'revenue' ? 'revenue' : 'ebitda');
  }
}
