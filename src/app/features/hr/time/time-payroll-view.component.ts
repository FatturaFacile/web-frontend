import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore, HrTimeApiService, I18nService, NightWorkBalance, TimePayrollView } from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CrudOption } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

/** The working time as payroll sees it (rounding, allowances, night work) and the ArG Art. 17b night work balances of a year. */
@Component({
  selector: 'app-time-payroll-view',
  styleUrl: './time-payroll-view.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    FormsModule,
    MoneyPipe,
    NzButtonModule,
    NzDescriptionsModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <h3>{{ 'hrmTimeX.payrollView' | translate }}</h3>
    <div class="filter-bar">
      <div>
        <label for="pv-employee">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select
          id="pv-employee"
          class="w-field-md"
          nzAllowClear
          nzShowSearch
          [ngModel]="employeeId()"
          (ngModelChange)="employeeId.set($event)"
        >
          @for (option of employees(); track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.label ?? option.value" />
          }
        </nz-select>
      </div>
      <div>
        <label for="pv-from">{{ 'hrmCommon.from' | translate }}</label>
        <input
          nz-input
          id="pv-from"
          type="date"
          [ngModel]="from()"
          (ngModelChange)="from.set($event)"
        />
      </div>
      <div>
        <label for="pv-to">{{ 'hrmCommon.to' | translate }}</label>
        <input nz-input id="pv-to" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
      </div>
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="!from() || !to()"
        [nzLoading]="loading()"
        (click)="loadView()"
      >
        {{ 'hrmTimeX.show' | translate }}
      </button>
    </div>

    @if (view(); as v) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" class="mb-3">
        <nz-descriptions-item [nzTitle]="'hrmTimeX.recorded' | translate"
          >{{ v.totals.recorded_minutes }} min</nz-descriptions-item
        >
        <nz-descriptions-item [nzTitle]="'hrmTimeX.payrollMinutes' | translate"
          >{{ v.totals.payroll_minutes }} min</nz-descriptions-item
        >
        <nz-descriptions-item [nzTitle]="'hrmTimeX.night' | translate"
          >{{ v.totals.night_minutes }} min</nz-descriptions-item
        >
        <nz-descriptions-item [nzTitle]="'hrmTimeX.nightAllowance' | translate"
          >{{ v.totals.night_allowance_minutes }} min</nz-descriptions-item
        >
        <nz-descriptions-item [nzTitle]="'hrmTimeX.sundayAllowance' | translate"
          >{{ v.totals.sunday_allowance_minutes }} min</nz-descriptions-item
        >
        <nz-descriptions-item [nzTitle]="'hrmTimeX.holidayAllowance' | translate"
          >{{ v.totals.holiday_allowance_minutes }} min</nz-descriptions-item
        >
        <nz-descriptions-item [nzTitle]="'hrmTimeX.dailyAllowance' | translate">{{
          v.totals.daily_allowance_amount | money: currency()
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTimeX.nightShifts' | translate">
          {{ v.totals.ytd_night_shifts }}
          @if (v.totals.is_regular_night_worker) {
            ({{ 'hrmTimeX.regularNightWorker' | translate }})
          }
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTimeX.compensationMode' | translate">{{
          v.totals.night_compensation_mode
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTimeX.timeCompensation' | translate"
          >{{ v.totals.night_time_compensation_minutes }} min</nz-descriptions-item
        >
      </nz-descriptions>
      <nz-table #daysTable [nzData]="v.days" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th [nzSortFn]="'date' | gridSort">{{ 'hrmCommon.date' | translate }}</th>
            <th [nzSortFn]="'recorded_minutes' | gridSort">{{ 'hrmTimeX.recorded' | translate }}</th>
            <th [nzSortFn]="'payroll_minutes' | gridSort">{{ 'hrmTimeX.payrollMinutes' | translate }}</th>
            <th [nzSortFn]="'adjustment_minutes' | gridSort">{{ 'hrmTimeX.adjustment' | translate }}</th>
            <th [nzSortFn]="'night_minutes' | gridSort">{{ 'hrmTimeX.night' | translate }}</th>
            <th [nzSortFn]="'daily_allowance_amount' | gridSort">{{ 'hrmTimeX.dailyAllowance' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (day of daysTable.data; track day.date) {
            <tr>
              <td>{{ day.date }}</td>
              <td>{{ day.recorded_minutes }}</td>
              <td>{{ day.payroll_minutes }}</td>
              <td>{{ day.adjustment_minutes }}</td>
              <td>{{ day.night_minutes }}</td>
              <td>{{ day.daily_allowance_amount | money: currency() }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <h3 class="mt-4">{{ 'hrmTimeX.nightBalances' | translate }}</h3>
    <div class="filter-bar">
      <div>
        <label for="nb-year">{{ 'hrmCommon.year' | translate }}</label>
        <input
          nz-input
          id="nb-year"
          type="number"
          [ngModel]="year()"
          (ngModelChange)="year.set($event)"
        />
      </div>
      <button nz-button type="button" [nzLoading]="loadingBalances()" (click)="loadBalances()">
        {{ 'hrmTimeX.show' | translate }}
      </button>
    </div>
    @if (balances(); as rows) {
      <nz-table #balanceTable [nzData]="rows" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmCommon.employee' | translate }}</th>
            <th [nzSortFn]="'ytd_night_shifts' | gridSort">{{ 'hrmTimeX.nightShifts' | translate }}</th>
            <th>{{ 'hrmTimeX.regularNightWorker' | translate }}</th>
            <th [nzSortFn]="'accrued_rest_minutes' | gridSort">{{ 'hrmTimeX.accruedRest' | translate }}</th>
            <th [nzSortFn]="'taken_rest_minutes' | gridSort">{{ 'hrmTimeX.takenRest' | translate }}</th>
            <th [nzSortFn]="'remaining_rest_minutes' | gridSort">{{ 'hrmTimeX.remainingRest' | translate }}</th>
            <th [nzSortFn]="'cash_supplement_minutes' | gridSort">{{ 'hrmTimeX.cashSupplement' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of balanceTable.data; track row.id) {
            <tr>
              <td>{{ employeeName(row.employee_id) }}</td>
              <td>{{ row.ytd_night_shifts }}</td>
              <td>
                {{ (row.is_regular_night_worker ? 'hrmCommon.yes' : 'hrmCommon.no') | translate }}
              </td>
              <td>{{ row.accrued_rest_minutes }}</td>
              <td>{{ row.taken_rest_minutes }}</td>
              <td>{{ row.remaining_rest_minutes }}</td>
              <td>{{ row.cash_supplement_minutes }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class TimePayrollViewComponent {
  readonly employees = input<CrudOption[]>([]);

  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);

  protected readonly employeeId = signal<string | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly view = signal<TimePayrollView | null>(null);
  protected readonly balances = signal<NightWorkBalance[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadingBalances = signal(false);
  protected readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');
  private readonly names = computed(
    () => new Map(this.employees().map((o) => [o.value, o.label ?? o.value])),
  );

  protected employeeName(id: string | null): string {
    return id ? (this.names().get(id) ?? id.slice(0, 8)) : '-';
  }

  protected loadView(): void {
    this.loading.set(true);
    this.api
      .getPayrollView({ employee_id: this.employeeId(), from: this.from(), to: this.to() })
      .subscribe({
        next: (res) => {
          this.view.set(res.data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  protected loadBalances(): void {
    this.loadingBalances.set(true);
    this.api.getNightWorkBalances({ year: this.year() }).subscribe({
      next: (res) => {
        this.balances.set(res.data);
        this.loadingBalances.set(false);
      },
      error: (err: unknown) => {
        this.loadingBalances.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
