import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AbsenteeismAnalytics,
  HeadcountAnalytics,
  HrAnalyticsQuery,
  HrWorkforceApiService,
  I18nService,
  PositionsAnalytics,
  TenureAnalytics,
  TurnoverAnalytics,
  UpcomingExpiriesAnalytics,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Observable } from 'rxjs';
import { reportHttpError } from '../shared/hr-http.util';

/** `Y-m-d` of a local date. */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Width in percent of a bar against the largest value of its series (never negative, 0 when all are 0). */
export function barPercent(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
}

/** Dashboard of the workforce: headcount, turnover, tenure, absenteeism, open positions and what expires soon. */
@Component({
  selector: 'app-hr-analytics',
  styleUrl: './hr-analytics.component.scss',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'hrmAnalytics.title' | translate" [subtitle]="'hrmAnalytics.subtitle' | translate" />

    <form class="analytics__filters" [formGroup]="filters" (ngSubmit)="load()">
      <label>
        <span>{{ 'hrmAnalytics.from' | translate }}</span>
        <input nz-input type="date" formControlName="from" />
      </label>
      <label>
        <span>{{ 'hrmAnalytics.to' | translate }}</span>
        <input nz-input type="date" formControlName="to" />
      </label>
      <div class="analytics__field">
        <span id="analytics-granularity">{{ 'hrmAnalytics.granularity' | translate }}</span>
        <nz-select formControlName="granularity" class="analytics__select" aria-labelledby="analytics-granularity">
          @for (option of granularities; track option) {
            <nz-option [nzValue]="option" [nzLabel]="'hrmAnalytics.granularities.' + option | translate" />
          }
        </nz-select>
      </div>
      <label>
        <span>{{ 'hrmAnalytics.expiryDays' | translate }}</span>
        <input nz-input type="number" min="1" max="365" formControlName="days" />
      </label>
      <button nz-button nzType="primary" type="submit" [nzLoading]="loading()" [disabled]="filters.invalid">
        {{ 'hrmAnalytics.refresh' | translate }}
      </button>
    </form>

    <div class="analytics__kpis">
      <nz-card>
        <nz-statistic [nzTitle]="'hrmAnalytics.headcount' | translate" [nzValue]="headcount()?.total ?? 0" />
      </nz-card>
      <nz-card>
        <nz-statistic [nzTitle]="'hrmAnalytics.turnoverRate' | translate" [nzValue]="rate(turnover()?.totals?.turnover_rate)" />
      </nz-card>
      <nz-card>
        <nz-statistic [nzTitle]="'hrmAnalytics.averageTenure' | translate" [nzValue]="years(tenure()?.average_tenure_years)" />
      </nz-card>
      <nz-card>
        <nz-statistic [nzTitle]="'hrmAnalytics.absenteeismRate' | translate" [nzValue]="rate(absenteeism()?.absenteeism_rate)" />
      </nz-card>
      <nz-card>
        <nz-statistic
          [nzTitle]="'hrmAnalytics.openPositions' | translate"
          [nzValue]="(positions()?.open ?? 0) + ' / ' + (positions()?.budget ?? 0)"
        />
      </nz-card>
    </div>

    <nz-card [nzTitle]="'hrmAnalytics.headcountOverTime' | translate">
      @for (point of headcount()?.series ?? []; track point.period) {
        <div class="analytics__bar-row">
          <span class="analytics__bar-label">{{ point.period }}</span>
          <div class="analytics__bar-track">
            <div class="analytics__bar" [style.width.%]="percent(point.headcount, seriesMax())"></div>
          </div>
          <span class="analytics__bar-value">{{ point.headcount }}</span>
        </div>
      }
    </nz-card>

    <div class="analytics__grid">
      <nz-card [nzTitle]="'hrmAnalytics.byDepartment' | translate">
        <nz-table [nzData]="headcount()?.by_department ?? []" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmAnalytics.department' | translate }}</th>
              <th>{{ 'hrmAnalytics.headcount' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of headcount()?.by_department ?? []; track row.department_id) {
              <tr>
                <td>{{ row.department_name ?? ('hrmAnalytics.noDepartment' | translate) }}</td>
                <td>{{ row.headcount }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
      <nz-card [nzTitle]="'hrmAnalytics.byContractType' | translate">
        <nz-table [nzData]="headcount()?.by_contract_type ?? []" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmAnalytics.contractType' | translate }}</th>
              <th>{{ 'hrmAnalytics.headcount' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of headcount()?.by_contract_type ?? []; track row.contract_type) {
              <tr>
                <td>{{ row.contract_type }}</td>
                <td>{{ row.headcount }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </div>

    <nz-card [nzTitle]="'hrmAnalytics.turnover' | translate">
      <nz-table [nzData]="turnover()?.periods ?? []" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmAnalytics.period' | translate }}</th>
            <th>{{ 'hrmAnalytics.hires' | translate }}</th>
            <th>{{ 'hrmAnalytics.terminations' | translate }}</th>
            <th>{{ 'hrmAnalytics.averageHeadcount' | translate }}</th>
            <th>{{ 'hrmAnalytics.turnoverRate' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of turnover()?.periods ?? []; track row.period) {
            <tr>
              <td>{{ row.period }}</td>
              <td>{{ row.hires }}</td>
              <td>{{ row.terminations }}</td>
              <td>{{ row.average_headcount }}</td>
              <td>{{ rate(row.turnover_rate) }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if ((turnover()?.by_reason ?? []).length > 0) {
        <h4 class="analytics__subtitle">{{ 'hrmAnalytics.exitReasons' | translate }}</h4>
        <nz-table [nzData]="turnover()?.by_reason ?? []" [nzFrontPagination]="false" nzSize="small">
          <tbody>
            @for (row of turnover()?.by_reason ?? []; track row.reason_code) {
              <tr>
                <td>{{ 'hrmOffboarding.reason.' + row.reason_code | translate }}</td>
                <td>{{ row.count }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-card>

    <div class="analytics__grid">
      <nz-card [nzTitle]="'hrmAnalytics.tenure' | translate">
        <nz-table [nzData]="tenure()?.distribution ?? []" [nzFrontPagination]="false" nzSize="small">
          <tbody>
            @for (row of tenure()?.distribution ?? []; track row.bucket) {
              <tr>
                <td>{{ 'hrmAnalytics.tenureBucket.' + row.bucket | translate }}</td>
                <td>{{ row.employees }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p class="analytics__note">
          {{ 'hrmAnalytics.leaversTenure' | translate }}: {{ years(tenure()?.average_tenure_leavers_years) }}
        </p>
      </nz-card>
      <nz-card [nzTitle]="'hrmAnalytics.absenteeism' | translate">
        <nz-table [nzData]="absenteeism()?.by_category ?? []" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmAnalytics.category' | translate }}</th>
              <th>{{ 'hrmAnalytics.days' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of absenteeism()?.by_category ?? []; track row.category) {
              <tr>
                <td>{{ row.category }} @if (row.planned) { ({{ 'hrmAnalytics.planned' | translate }}) }</td>
                <td>{{ row.days }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <p class="analytics__note">
          {{ 'hrmAnalytics.scheduledDays' | translate }}: {{ absenteeism()?.scheduled_days ?? 0 }}
        </p>
      </nz-card>
    </div>

    <nz-card [nzTitle]="'hrmAnalytics.positions' | translate">
      <nz-table [nzData]="positions()?.positions ?? []" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmCommon.code' | translate }}</th>
            <th>{{ 'hrmCommon.title' | translate }}</th>
            <th>{{ 'hrmAnalytics.budget' | translate }}</th>
            <th>{{ 'hrmAnalytics.filled' | translate }}</th>
            <th>{{ 'hrmAnalytics.open' | translate }}</th>
            <th>{{ 'hrmAnalytics.openPostings' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of positions()?.positions ?? []; track row.position_id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.title }}</td>
              <td>{{ row.budget }}</td>
              <td>{{ row.filled }}</td>
              <td>{{ row.open }}</td>
              <td>{{ row.open_postings }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <div class="analytics__grid">
      <nz-card [nzTitle]="'hrmAnalytics.probationEnds' | translate">
        <nz-table [nzData]="expiries()?.probation_ends ?? []" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmCommon.employee' | translate }}</th>
              <th>{{ 'hrmAnalytics.endsOn' | translate }}</th>
              <th>{{ 'hrmAnalytics.daysRemaining' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of expiries()?.probation_ends ?? []; track row.employee_id) {
              <tr>
                <td>{{ row.employee_number }} - {{ row.full_name }}</td>
                <td>{{ row.probation_end_date }}</td>
                <td>{{ row.days_remaining }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
      <nz-card [nzTitle]="'hrmAnalytics.contractExpiries' | translate">
        <nz-table [nzData]="expiries()?.contract_expiries ?? []" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmCommon.employee' | translate }}</th>
              <th>{{ 'hrmAnalytics.endsOn' | translate }}</th>
              <th>{{ 'hrmAnalytics.daysRemaining' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of expiries()?.contract_expiries ?? []; track row.contract_id) {
              <tr>
                <td>{{ row.full_name }} ({{ row.contract_number }})</td>
                <td>{{ row.end_date }}</td>
                <td>{{ row.days_remaining }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
})
export class HrAnalyticsComponent implements OnInit {
  private readonly api = inject(HrWorkforceApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly granularities = ['month', 'quarter', 'year'] as const;
  protected readonly loading = signal(false);
  protected readonly headcount = signal<HeadcountAnalytics | null>(null);
  protected readonly turnover = signal<TurnoverAnalytics | null>(null);
  protected readonly tenure = signal<TenureAnalytics | null>(null);
  protected readonly absenteeism = signal<AbsenteeismAnalytics | null>(null);
  protected readonly positions = signal<PositionsAnalytics | null>(null);
  protected readonly expiries = signal<UpcomingExpiriesAnalytics | null>(null);

  protected readonly filters = this.fb.group({
    from: this.fb.control(this.defaultFrom()),
    to: this.fb.control(toIsoDate(new Date())),
    granularity: this.fb.control<'month' | 'quarter' | 'year'>('month'),
    days: this.fb.control(90),
  });

  ngOnInit(): void {
    this.load();
  }

  protected seriesMax(): number {
    return Math.max(0, ...(this.headcount()?.series ?? []).map((point) => point.headcount));
  }

  protected percent(value: number, max: number): number {
    return barPercent(value, max);
  }

  protected rate(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : `${value}%`;
  }

  protected years(value: number | null | undefined): string {
    return value === null || value === undefined ? '-' : String(value);
  }

  protected load(): void {
    const { from, to, granularity, days } = this.filters.getRawValue();
    const range: HrAnalyticsQuery = { from, to, as_of: to };
    this.loading.set(true);
    let pending = 6;
    const done = (): void => {
      pending -= 1;
      if (pending === 0) {
        this.loading.set(false);
      }
    };
    const run = <T>(request: Observable<{ data: T }>, target: (value: T) => void): void => {
      request.subscribe({
        next: (res) => {
          target(res.data);
          done();
        },
        error: (err: unknown) => {
          reportHttpError(err, this.message, this.i18n);
          done();
        },
      });
    };

    run(this.api.getHeadcountAnalytics(range), (data) => this.headcount.set(data));
    run(this.api.getTurnoverAnalytics({ from, to, granularity }), (data) => this.turnover.set(data));
    run(this.api.getTenureAnalytics({ as_of: to }), (data) => this.tenure.set(data));
    run(this.api.getAbsenteeismAnalytics({ from, to }), (data) => this.absenteeism.set(data));
    run(this.api.getPositionsAnalytics({ as_of: to }), (data) => this.positions.set(data));
    run(this.api.getUpcomingExpiries({ days }), (data) => this.expiries.set(data));
  }

  private defaultFrom(): string {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  }
}
