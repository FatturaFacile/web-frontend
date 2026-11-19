import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { BudgetPlan, ControllingApiService, VarianceReport, WaterfallStep } from '@core';
import { TranslatePipe } from '@shared';
import { ControllingFilters } from './controlling-filters.service';

const GROUPS = ['nature', 'cost_center', 'job', 'product_family', 'customer', 'agent', 'department', 'geography'] as const;
const MODES = ['monthly', 'ytd', 'full_year_eac'] as const;

interface Bar {
  step: WaterfallStep;
  x: number;
  y: number;
  h: number;
  color: string;
}

/** Tab 4 — variance analysis (actual, budget, forecast, prior year) and the executive bridge from budget margin to actual margin. */
@Component({
  selector: 'app-controlling-variance',
  styleUrl: './controlling.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule],
  template: `
    <div class="toolbar">
      <nz-select style="width: 240px" nzAllowClear [ngModel]="budgetId()" (ngModelChange)="budgetId.set($event)" [nzPlaceHolder]="'CONTROLLING.BUDGET' | translate" [attr.aria-label]="'CONTROLLING.BUDGET' | translate">
        @for (plan of budgets(); track plan.id) {
          @if (plan.plan_type !== 'rolling_forecast') {
            <nz-option [nzValue]="plan.id" [nzLabel]="plan.code + ' · ' + plan.name"></nz-option>
          }
        }
      </nz-select>
      <nz-select style="width: 240px" nzAllowClear [ngModel]="forecastId()" (ngModelChange)="forecastId.set($event)" [nzPlaceHolder]="'CONTROLLING.FORECAST' | translate" [attr.aria-label]="'CONTROLLING.FORECAST' | translate">
        @for (plan of budgets(); track plan.id) {
          @if (plan.plan_type === 'rolling_forecast') {
            <nz-option [nzValue]="plan.id" [nzLabel]="plan.code + ' · ' + plan.name"></nz-option>
          }
        }
      </nz-select>
      <nz-select style="width: 180px" [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event)" [attr.aria-label]="'CONTROLLING.GROUP_BY' | translate">
        @for (group of groups; track group) {
          <nz-option [nzValue]="group" [nzLabel]="'CONTROLLING.VAR_GROUP_' + group.toUpperCase() | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 180px" [ngModel]="mode()" (ngModelChange)="mode.set($event)" [attr.aria-label]="'CONTROLLING.PERIOD_MODE' | translate">
        @for (m of modes; track m) {
          <nz-option [nzValue]="m" [nzLabel]="'CONTROLLING.MODE_' + m.toUpperCase() | translate"></nz-option>
        }
      </nz-select>
    </div>

    @if (!budgetId()) {
      <nz-empty [nzNotFoundContent]="'CONTROLLING.PICK_BUDGET' | translate"></nz-empty>
    } @else {
      <nz-card [nzTitle]="'CONTROLLING.BRIDGE' | translate" class="main-card">
        <svg class="chart" viewBox="0 0 600 280" role="img" [attr.aria-label]="'CONTROLLING.BRIDGE' | translate">
          @for (bar of bars(); track bar.step.key) {
            <rect [attr.x]="bar.x" [attr.y]="bar.y" width="70" [attr.height]="bar.h" [attr.fill]="bar.color"><title>{{ bar.step.label }}: {{ bar.step.value }}</title></rect>
            <text [attr.x]="bar.x + 35" y="270" text-anchor="middle">{{ bar.step.label }}</text>
            <text [attr.x]="bar.x + 35" [attr.y]="bar.y - 4" text-anchor="middle">{{ bar.step.value | number: '1.0-0' }}</text>
          }
        </svg>
      </nz-card>

      <nz-card [nzTitle]="'CONTROLLING.VARIANCE_TABLE' | translate" class="main-card">
        <nz-table [nzData]="rows()" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'CONTROLLING.ENTITY' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.ACTUAL' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.BUDGET' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.FORECAST' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.PRIOR_YEAR' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.VAR_EUR' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.VAR_PERCENT' | translate }}</th>
              <th class="num">{{ 'CONTROLLING.EAC' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.key) {
              <tr>
                <td>{{ row.label }}</td>
                <td class="num">{{ row.actual.margin | number: '1.0-0' }}</td>
                <td class="num">{{ row.budget.margin | number: '1.0-0' }}</td>
                <td class="num">{{ row.forecast.margin | number: '1.0-0' }}</td>
                <td class="num">{{ row.prior_year.margin | number: '1.0-0' }}</td>
                <td class="num" [class]="row.favorable ? 'badge-up' : 'badge-down'">{{ row.variance | number: '1.0-0' }}</td>
                <td class="num" [class]="row.favorable ? 'badge-up' : 'badge-down'">{{ row.variance_percent | number: '1.1-1' }} %</td>
                <td class="num">{{ row.eac.margin | number: '1.0-0' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class ControllingVarianceComponent implements OnInit {
  private readonly api = inject(ControllingApiService);
  private readonly filters = inject(ControllingFilters);

  protected readonly groups = GROUPS;
  protected readonly modes = MODES;
  protected readonly budgets = signal<BudgetPlan[]>([]);
  protected readonly budgetId = signal<string | null>(null);
  protected readonly forecastId = signal<string | null>(null);
  protected readonly groupBy = signal<(typeof GROUPS)[number]>('nature');
  protected readonly mode = signal<(typeof MODES)[number]>('ytd');
  protected readonly report = signal<VarianceReport | null>(null);
  protected readonly steps = signal<WaterfallStep[]>([]);

  protected readonly rows = computed(() => this.report()?.data ?? []);

  protected readonly bars = computed<Bar[]>(() => {
    const steps = this.steps();
    if (!steps.length) return [];
    let running = 0;
    const spans = steps.map((step) => {
      const value = Number(step.value);
      if (step.type === 'total') {
        running = value;
        return { step, from: 0, to: value };
      }
      const from = running;
      running += value;
      return { step, from, to: running };
    });
    const max = Math.max(1, ...spans.flatMap((s) => [s.from, s.to]));
    const min = Math.min(0, ...spans.flatMap((s) => [s.from, s.to]));
    const scale = 220 / (max - min || 1);
    return spans.map((span, index) => {
      const top = Math.max(span.from, span.to);
      const bottom = Math.min(span.from, span.to);
      return {
        step: span.step,
        x: 20 + index * 95,
        y: 240 - (top - min) * scale,
        h: Math.max(2, (top - bottom) * scale),
        color: span.step.type === 'total' ? '#1677ff' : span.step.favorable ? '#52c41a' : '#cf1322',
      };
    });
  });

  private readonly request = computed(() => ({ budget: this.budgetId(), forecast: this.forecastId(), group: this.groupBy(), mode: this.mode(), month: this.filters.lastMonth() }));

  constructor() {
    toObservable(this.request)
      .pipe(
        switchMap((request) => {
          if (!request.budget) return of(null);
          const query = { budget_id: request.budget, forecast_id: request.forecast ?? undefined, period_mode: request.mode, month: request.month };
          return forkJoin({ variance: this.api.getVariance({ ...query, group_by: request.group }), waterfall: this.api.getWaterfall(query) }).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((result) => {
        this.report.set(result?.variance ?? null);
        this.steps.set(result?.waterfall.data.steps ?? []);
      });
  }

  ngOnInit(): void {
    this.api.getBudgets(this.filters.fiscalYear()).subscribe({
      next: (response) => {
        this.budgets.set(response.data);
        const budget = response.data.find((plan) => plan.plan_type === 'annual_budget' && ['approved', 'locked'].includes(plan.status)) ?? response.data.find((plan) => plan.plan_type === 'annual_budget');
        if (budget && !this.budgetId()) this.budgetId.set(budget.id);
      },
    });
  }
}
