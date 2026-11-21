import { Component, computed, inject, input, output } from '@angular/core';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BalancedScorecardKpi, DrillMetric, KpiGroup, ReportingCurrency } from './dss.models';
import {
  formatDeltaPct,
  formatKpiValue,
  kpiDrillMetric,
  sparklinePoints,
  targetProgress,
} from './dss.utils';

const GROUPS: readonly KpiGroup[] = ['financial', 'customer', 'efficiency'];

/**
 * Balanced Scorecard: financial health, customer and commercial, internal efficiency. Each indicator shows its value, the
 * change against the comparison baseline, an inline trend sparkline and, when it has one, a target gauge. An indicator with
 * ledger records behind it opens the drill-down.
 */
@Component({
  selector: 'app-balanced-scorecard',
  styleUrl: './dss.scss',
  imports: [TranslatePipe, NzCardModule, NzEmptyModule, NzTagModule],
  template: `
    @for (group of groups; track group) {
      <h3 class="section-title" [attr.data-testid]="'group-' + group">
        {{ 'EXEC_DSS.GROUP_' + group.toUpperCase() | translate }}
      </h3>
      <div class="kpi-grid">
        @for (kpi of kpisOf(group); track kpi.key) {
          <nz-card
            class="kpi-card"
            [class.clickable]="drillOf(kpi) !== null"
            [attr.data-testid]="'kpi-' + kpi.key"
            [attr.tabindex]="drillOf(kpi) !== null ? 0 : null"
            [attr.role]="drillOf(kpi) !== null ? 'button' : null"
            (click)="open(kpi)"
            (keydown.enter)="open(kpi)"
          >
            <span class="kpi-title">{{ 'EXEC_DSS.KPI_' + kpi.key.toUpperCase() | translate }}</span>
            @if (kpi.available) {
              <span class="kpi-value" data-testid="kpi-value">{{ valueOf(kpi) }}</span>
              <div class="kpi-meta">
                @if (kpi.delta_pct !== null || kpi.delta !== null) {
                  <nz-tag
                    data-testid="kpi-delta"
                    [nzColor]="
                      kpi.favorable === false ? 'error' : kpi.favorable ? 'success' : 'default'
                    "
                    >{{ deltaOf(kpi) }}</nz-tag
                  >
                } @else {
                  <span class="muted">{{ 'EXEC_DSS.NO_COMPARISON' | translate }}</span>
                }
                @if (kpi.sparkline.length > 1) {
                  <svg class="spark" viewBox="0 0 96 28" aria-hidden="true" data-testid="kpi-spark">
                    <polyline [attr.points]="points(kpi)"></polyline>
                  </svg>
                }
              </div>
              @let progress = progressOf(kpi);
              @if (progress !== null) {
                <div
                  class="gauge"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="progress"
                  [attr.aria-label]="'EXEC_DSS.TARGET' | translate"
                >
                  <span [style.width.%]="progress"></span>
                </div>
              }
            } @else {
              <span class="kpi-value muted" data-testid="kpi-unavailable">–</span>
              <span class="muted">{{ 'EXEC_DSS.NOT_AVAILABLE' | translate }}</span>
            }
          </nz-card>
        } @empty {
          <nz-empty [nzNotFoundContent]="'EXEC_DSS.EMPTY' | translate"></nz-empty>
        }
      </div>
    }
  `,
})
export class BalancedScorecardComponent {
  private readonly i18n = inject(TranslateService);

  readonly kpis = input.required<readonly BalancedScorecardKpi[]>();
  readonly currency = input.required<ReportingCurrency>();
  /** The user opened an indicator that has records behind it. */
  readonly drill = output<{ metric: DrillMetric; label: string }>();

  protected readonly groups = GROUPS;
  private readonly locale = computed(() => this.i18n.currentLanguage());

  protected kpisOf(group: KpiGroup): BalancedScorecardKpi[] {
    return this.kpis().filter((kpi) => kpi.group === group);
  }

  protected valueOf(kpi: BalancedScorecardKpi): string {
    return formatKpiValue(kpi, this.currency(), this.locale());
  }

  protected deltaOf(kpi: BalancedScorecardKpi): string {
    return kpi.delta_pct !== null
      ? formatDeltaPct(kpi.delta_pct, this.locale())
      : formatKpiValue({ unit: kpi.unit, value: kpi.delta }, this.currency(), this.locale());
  }

  protected points(kpi: BalancedScorecardKpi): string {
    return sparklinePoints(kpi.sparkline);
  }

  protected progressOf(kpi: BalancedScorecardKpi): number | null {
    return targetProgress(kpi.value, kpi.target);
  }

  protected drillOf(kpi: BalancedScorecardKpi): DrillMetric | null {
    return kpi.available ? kpiDrillMetric(kpi.key) : null;
  }

  protected open(kpi: BalancedScorecardKpi): void {
    const metric = this.drillOf(kpi);

    if (metric !== null) {
      this.drill.emit({
        metric,
        label: this.i18n.instant(`EXEC_DSS.KPI_${kpi.key.toUpperCase()}`),
      });
    }
  }
}
