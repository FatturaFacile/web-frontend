import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { fanChartOption, riskTierColor } from '../ai-forecasting/ai-forecasting.utils';
import { ForecastChartComponent } from '../ai-forecasting/forecast-chart.component';
import { AiInsightsStore } from './ai-insights.store';
import { AiSuggestion } from './ai-cognitive.models';
import { actionRoute, percent, priorityColor, scalarEntries } from './ai-cognitive.utils';

const HORIZONS = [
  { value: 91, key: 'AI_COG.HORIZON_90' },
  { value: 365, key: 'AI_COG.HORIZON_365' },
] as const;

/**
 * Predictive Insights and Anomaly Center: the cash flow projection with its confidence bands, the customers by payment risk,
 * and the recommendations (cash alert, late payment, churn, reorder) and anomaly alerts, each with a one-click acknowledge or
 * dismiss and a link to the record concerned.
 */
@Component({
  selector: 'app-ai-insights-page',
  styleUrl: './ai-cognitive.scss',
  imports: [
    DatePipe,
    DecimalPipe,
    NgTemplateOutlet,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    ForecastChartComponent,
  ],
  template: `
    <app-page-header
      [title]="'AI_COG.INSIGHTS_TITLE' | translate"
      [subtitle]="'AI_COG.INSIGHTS_SUBTITLE' | translate"
    ></app-page-header>

    <div class="chip-row">
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="generate"
        [nzLoading]="store.generating()"
        (click)="generate()"
      >
        {{ 'AI_COG.RUN_ANALYSIS' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <div class="stat-row" data-testid="stats">
        <nz-statistic
          data-testid="stat-critical"
          [nzTitle]="'AI_COG.STAT_URGENT' | translate"
          [nzValue]="store.criticalCount()"
        ></nz-statistic>
        <nz-statistic
          data-testid="stat-recommendations"
          [nzTitle]="'AI_COG.STAT_RECOMMENDATIONS' | translate"
          [nzValue]="store.recommendations().length"
        ></nz-statistic>
        <nz-statistic
          data-testid="stat-anomalies"
          [nzTitle]="'AI_COG.STAT_ANOMALIES' | translate"
          [nzValue]="store.anomalies().length"
        ></nz-statistic>
        <nz-statistic
          data-testid="stat-lowest"
          [nzTitle]="'AI_COG.STAT_LOWEST_CASH' | translate"
          [nzValue]="lowestText()"
        ></nz-statistic>
      </div>

      <nz-card [nzTitle]="'AI_COG.CASH_FLOW' | translate" nzSize="small">
        <div class="chip-row">
          @for (horizon of horizons; track horizon.value) {
            <button
              type="button"
              class="chip"
              [attr.data-testid]="'horizon-' + horizon.value"
              [class.selected]="(store.horizonDays() ?? 91) === horizon.value"
              [attr.aria-pressed]="(store.horizonDays() ?? 91) === horizon.value"
              (click)="setHorizon(horizon.value)"
            >
              {{ horizon.key | translate }}
            </button>
          }
        </div>
        @if (store.cashFlow(); as flow) {
          @if (store.firstNegativeDate(); as date) {
            <p class="muted" role="alert" data-testid="negative-warning">
              {{ 'AI_COG.NEGATIVE_FROM' | translate }} {{ date | date: 'mediumDate' }}
            </p>
          }
          <app-forecast-chart
            testId="ai-cash-chart"
            [option]="chartOption()"
            [label]="'AI_COG.CASH_FLOW' | translate"
          ></app-forecast-chart>
          <p class="muted">{{ 'AI_COG.CHART_FOOTNOTE' | translate }} · {{ flow.currency }}</p>
        } @else {
          <nz-empty
            data-testid="no-forecast"
            [nzNotFoundContent]="'AI_COG.NO_FORECAST' | translate"
          ></nz-empty>
        }
      </nz-card>

      <nz-card [nzTitle]="'AI_COG.PAYMENT_RISK' | translate" nzSize="small" class="insight-block">
        <nz-table #risk [nzData]="store.paymentRisk()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'AI_COG.FIELD_CUSTOMER_ID' | translate }}</th>
              <th>{{ 'AI_COG.RISK_TIER' | translate }}</th>
              <th>{{ 'AI_COG.FIELD_AVERAGE_DAYS_LATE' | translate }}</th>
              <th>{{ 'AI_COG.ON_TIME_PROBABILITY' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of risk.data; track row.customer_id) {
              <tr [attr.data-testid]="'risk-' + row.customer_id">
                <td>{{ row.customer_name ?? row.customer_id }}</td>
                <td>
                  <nz-tag [nzColor]="tierColor(row.payment_risk_tier)">{{
                    'AI_COG.TIER_' + row.payment_risk_tier.toUpperCase() | translate
                  }}</nz-tag>
                </td>
                <td>{{ row.average_days_late | number: '1.0-1' }}</td>
                <td>{{ percentOf(row.on_time_payment_probability) }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <h3>{{ 'AI_COG.RECOMMENDATIONS' | translate }}</h3>
      <div class="insight-grid" data-testid="recommendations">
        @for (item of store.recommendations(); track item.id) {
          <ng-container *ngTemplateOutlet="card; context: { $implicit: item }"></ng-container>
        } @empty {
          <nz-empty [nzNotFoundContent]="'AI_COG.NO_RECOMMENDATIONS' | translate"></nz-empty>
        }
      </div>

      <h3>{{ 'AI_COG.ANOMALIES' | translate }}</h3>
      <div class="insight-grid" data-testid="anomalies">
        @for (item of store.anomalies(); track item.id) {
          <ng-container *ngTemplateOutlet="card; context: { $implicit: item }"></ng-container>
        } @empty {
          <nz-empty [nzNotFoundContent]="'AI_COG.NO_ANOMALIES' | translate"></nz-empty>
        }
      </div>
    </nz-spin>

    <ng-template #card let-item>
      <nz-card nzSize="small" [attr.data-testid]="'insight-' + item.id">
        <div>
          <nz-tag [nzColor]="priorityColor(item.priority)">{{
            'AI_COG.PRIORITY_' + item.priority.toUpperCase() | translate
          }}</nz-tag>
          <strong>{{ 'AI_COG.KIND_' + item.kind.toUpperCase() | translate }}</strong>
        </div>
        @if (item.reasoning) {
          <p>{{ item.reasoning }}</p>
        }
        <ul class="muted">
          @for (entry of entries(item); track entry[0]) {
            <li>{{ 'AI_COG.FIELD_' + entry[0].toUpperCase() | translate }}: {{ entry[1] }}</li>
          }
        </ul>
        <div class="decision-bar">
          <button
            nz-button
            nzType="primary"
            nzSize="small"
            type="button"
            [attr.data-testid]="'ack-' + item.id"
            [nzLoading]="store.busyId() === item.id"
            (click)="acknowledge(item)"
          >
            {{ 'AI_COG.ACKNOWLEDGE' | translate }}
          </button>
          <button
            nz-button
            nzSize="small"
            type="button"
            [attr.data-testid]="'dismiss-' + item.id"
            [nzLoading]="store.busyId() === item.id"
            (click)="dismiss(item)"
          >
            {{ 'AI_COG.DISMISS' | translate }}
          </button>
          @if (link(item); as target) {
            <a
              nz-button
              nzSize="small"
              [routerLink]="target"
              [attr.data-testid]="'open-' + item.id"
              >{{ 'AI_COG.OPEN_SUBJECT' | translate }}</a
            >
          }
          <a
            nz-button
            nzSize="small"
            nzType="link"
            routerLink="/ai/workbench"
            [queryParams]="{ suggestion: item.id }"
            >{{ 'AI_COG.REVIEW_IN_WORKBENCH' | translate }}</a
          >
        </div>
      </nz-card>
    </ng-template>
  `,
})
export class AiInsightsPageComponent implements OnInit {
  protected readonly store = inject(AiInsightsStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly horizons = HORIZONS;

  protected readonly chartOption = computed(() => {
    const flow = this.store.cashFlow();

    return flow === null
      ? null
      : fanChartOption(flow, {
          p10: this.i18n.instant('AI_FORECAST.P10'),
          p50: this.i18n.instant('AI_FORECAST.P50'),
          p90: this.i18n.instant('AI_FORECAST.P90'),
          event: (code) => this.i18n.instant(`AI_FORECAST.EVENT_${code}`),
          format: (value) => this.currency(value, flow.currency),
        });
  });

  protected readonly lowestText = computed(() => {
    const lowest = this.store.lowestBalance();
    const currency = this.store.cashFlow()?.currency ?? 'CHF';

    return lowest === null ? '–' : this.currency(lowest, currency);
  });

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.store.load().subscribe({ error: () => undefined });
  }

  protected setHorizon(days: number): void {
    this.store.setHorizon(days);
    this.reload();
  }

  protected generate(): void {
    this.store.generate().subscribe({
      next: () => this.message.success(this.i18n.instant('AI_COG.ANALYSIS_DONE')),
      error: () => undefined,
    });
  }

  protected acknowledge(item: AiSuggestion): void {
    this.store.acknowledge(item).subscribe({
      next: () => this.message.success(this.i18n.instant('AI_COG.ACKNOWLEDGED')),
      error: () => undefined,
    });
  }

  protected dismiss(item: AiSuggestion): void {
    this.store.dismiss(item, this.i18n.instant('AI_COG.DISMISSED_REASON')).subscribe({
      next: () => this.message.success(this.i18n.instant('AI_COG.DISMISSED')),
      error: () => undefined,
    });
  }

  protected link(item: AiSuggestion): string | null {
    return actionRoute(item);
  }

  protected entries(item: AiSuggestion): [string, string | number | boolean][] {
    return scalarEntries(item.proposed_payload).slice(0, 6);
  }

  protected percentOf(score: number): string {
    return percent(score);
  }

  protected priorityColor = priorityColor;
  protected tierColor = riskTierColor;

  private currency(value: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
}
