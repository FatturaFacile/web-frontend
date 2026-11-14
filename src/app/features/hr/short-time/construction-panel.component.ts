import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuthStore,
  ConstructionHours,
  ConstructionParametersPayload,
  ConstructionQuery,
  I18nService,
  JointCommissionReport,
  ShortTimeApiService,
} from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { defer, throwError } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { CrudField, CrudOption } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/** Construction wage under a collective agreement: parameter versions, planned hours calendar, hours account and joint commission report. */
@Component({
  selector: 'app-construction-panel',
  styleUrl: './construction-panel.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ActionFormComponent,
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
    @if (canWrite()) {
      <h4>{{ 'hrmShortTime.construction.parametersTitle' | translate }}</h4>
      <app-action-form [config]="parametersConfig" />
      <h4 class="mt-4">{{ 'hrmShortTime.construction.calendarTitle' | translate }}</h4>
      <app-action-form [config]="calendarConfig" />
    }

    <h4 class="mt-4">{{ 'hrmShortTime.construction.reportsTitle' | translate }}</h4>
    <div class="filter-bar">
      <div>
        <label for="cn-code">{{ 'hrmShortTime.construction.agreementCode' | translate }}</label>
        <input
          nz-input
          id="cn-code"
          [ngModel]="agreementCode()"
          (ngModelChange)="agreementCode.set($event)"
        />
      </div>
      <div>
        <label for="cn-year">{{ 'hrmShortTime.construction.accountingYear' | translate }}</label>
        <input
          nz-input
          id="cn-year"
          type="number"
          [ngModel]="accountingYear()"
          (ngModelChange)="accountingYear.set($event)"
        />
      </div>
      <div>
        <label for="cn-employee">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select
          id="cn-employee"
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
      <button nz-button type="button" [disabled]="!agreementCode()" (click)="loadHours()">
        {{ 'hrmShortTime.construction.hours' | translate }}
      </button>
      <button nz-button type="button" [disabled]="!agreementCode()" (click)="loadReport()">
        {{ 'hrmShortTime.construction.jointReport' | translate }}
      </button>
    </div>

    @if (hours(); as h) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="1" class="mb-3">
        <nz-descriptions-item [nzTitle]="'hrmShortTime.construction.balance' | translate">{{
          h.balance_hours
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmShortTime.construction.hourlyWage' | translate">{{
          h.hourly_wage | money: currency()
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmShortTime.construction.constantWage' | translate">{{
          h.constant_monthly_wage | money: currency()
        }}</nz-descriptions-item>
      </nz-descriptions>
      <nz-table
        #monthsTable
        [nzData]="h.months"
        [nzFrontPagination]="false"
        nzSize="small"
        class="mb-3"
      >
        <thead>
          <tr>
            <th [nzSortFn]="'month' | gridSort" [nzFilters]="'month' | gridFilterList: monthsTable.nzData" [nzFilterFn]="'month' | gridFilterFn">{{ 'hrmLeave.month' | translate }}</th>
            <th [nzSortFn]="'planned_hours' | gridSort" [nzFilters]="'planned_hours' | gridFilterList: monthsTable.nzData" [nzFilterFn]="'planned_hours' | gridFilterFn">{{ 'hrmShortTime.construction.planned' | translate }}</th>
            <th [nzSortFn]="'worked_hours' | gridSort" [nzFilters]="'worked_hours' | gridFilterList: monthsTable.nzData" [nzFilterFn]="'worked_hours' | gridFilterFn">{{ 'hrmShortTime.construction.worked' | translate }}</th>
            <th [nzSortFn]="'balance_hours' | gridSort" [nzFilters]="'balance_hours' | gridFilterList: monthsTable.nzData" [nzFilterFn]="'balance_hours' | gridFilterFn">{{ 'hrmShortTime.construction.balance' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of monthsTable.data; track $index) {
            <tr>
              <td>{{ row.month }}/{{ row.year }}</td>
              <td>{{ row.planned_hours }}</td>
              <td>{{ row.worked_hours }}</td>
              <td>{{ row.balance_hours }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    @if (report(); as r) {
      <p>
        {{ 'hrmShortTime.construction.parametersFrom' | translate }}
        {{ r.parameters_valid_from }} &middot; {{ r.annual_hours }} h &middot; {{ r.source }}
      </p>
      <nz-table #reportTable [nzData]="r.rows" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th [nzSortFn]="'qualification' | gridSort" [nzFilters]="'qualification' | gridFilterList: reportTable.nzData" [nzFilterFn]="'qualification' | gridFilterFn">{{ 'hrmShortTime.construction.qualification' | translate }}</th>
            <th [nzSortFn]="'zone' | gridSort" [nzFilters]="'zone' | gridFilterList: reportTable.nzData" [nzFilterFn]="'zone' | gridFilterFn">{{ 'hrmShortTime.construction.zone' | translate }}</th>
            <th [nzSortFn]="'headcount' | gridSort" [nzFilters]="'headcount' | gridFilterList: reportTable.nzData" [nzFilterFn]="'headcount' | gridFilterFn">{{ 'hrmShortTime.construction.headcount' | translate }}</th>
            <th [nzSortFn]="'worked_hours' | gridSort" [nzFilters]="'worked_hours' | gridFilterList: reportTable.nzData" [nzFilterFn]="'worked_hours' | gridFilterFn">{{ 'hrmShortTime.construction.worked' | translate }}</th>
            <th [nzSortFn]="'gross_salary' | gridSort" [nzFilters]="'gross_salary' | gridFilterList: reportTable.nzData" [nzFilterFn]="'gross_salary' | gridFilterFn">{{ 'hrmPayroll.gross' | translate }}</th>
            <th [nzSortFn]="'average_hourly' | gridSort" [nzFilters]="'average_hourly' | gridFilterList: reportTable.nzData" [nzFilterFn]="'average_hourly' | gridFilterFn">{{ 'hrmShortTime.construction.averageHourly' | translate }}</th>
            <th [nzSortFn]="'minimum_hourly' | gridSort" [nzFilters]="'minimum_hourly' | gridFilterList: reportTable.nzData" [nzFilterFn]="'minimum_hourly' | gridFilterFn">{{ 'hrmShortTime.construction.minimumHourly' | translate }}</th>
            <th [nzSortFn]="'below_minimum.length' | gridSort" [nzFilters]="'below_minimum.length' | gridFilterList: reportTable.nzData" [nzFilterFn]="'below_minimum.length' | gridFilterFn">{{ 'hrmShortTime.construction.belowMinimum' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of reportTable.data; track $index) {
            <tr>
              <td>{{ row.qualification }}</td>
              <td>{{ row.zone }}</td>
              <td>{{ row.headcount }}</td>
              <td>{{ row.worked_hours }}</td>
              <td>{{ row.gross_salary | money: currency() }}</td>
              <td>{{ row.average_hourly | money: currency() }}</td>
              <td>{{ row.minimum_hourly | money: currency() }}</td>
              <td>{{ row.below_minimum.length || '' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class ConstructionPanelComponent {
  readonly canWrite = input(false);
  readonly employees = input<CrudOption[]>([]);

  private readonly api = inject(ShortTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);

  protected readonly agreementCode = signal('');
  protected readonly accountingYear = signal<number>(new Date().getFullYear());
  protected readonly employeeId = signal<string | null>(null);
  protected readonly hours = signal<ConstructionHours | null>(null);
  protected readonly report = signal<JointCommissionReport | null>(null);
  protected readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');

  protected readonly parametersConfig: ActionFormConfig = {
    submitLabelKey: 'hrmShortTime.construction.addParameters',
    resetOnSuccess: true,
    fields: [
      {
        key: 'agreement_code',
        labelKey: 'hrmShortTime.construction.agreementCode',
        type: 'text',
        required: true,
        maxLength: 30,
      },
      {
        key: 'valid_from',
        labelKey: 'hrmShortTime.construction.validFrom',
        type: 'date',
        required: true,
      },
      {
        key: 'annual_hours',
        labelKey: 'hrmShortTime.construction.annualHours',
        type: 'decimal',
        required: true,
        min: 1,
        max: 3000,
      },
      {
        key: 'accounting_year_start_month',
        labelKey: 'hrmShortTime.construction.yearStartMonth',
        type: 'integer',
        required: true,
        min: 1,
        max: 12,
        defaultValue: '1',
      },
      {
        key: 'source',
        labelKey: 'hrmShortTime.construction.source',
        type: 'text',
        required: true,
        minLength: 5,
        maxLength: 2000,
      },
      {
        key: 'minimum_wages',
        labelKey: 'hrmShortTime.construction.minimumWages',
        type: 'textarea',
        required: true,
      },
    ],
    submit: (payload) =>
      defer(() => {
        const wages = this.parseWages(payload['minimum_wages']);
        return wages
          ? this.api.addConstructionParameters({
              ...payload,
              minimum_wages: wages,
            } as unknown as ConstructionParametersPayload)
          : throwError(
              () =>
                new HttpErrorResponse({
                  status: 422,
                  error: { detail: this.i18n.translate('hrmCompliance.legal.invalidJson') },
                }),
            );
      }),
  };

  protected readonly calendarConfig: ActionFormConfig = {
    submitLabelKey: 'hrmShortTime.construction.saveCalendar',
    fields: [
      {
        key: 'agreement_code',
        labelKey: 'hrmShortTime.construction.agreementCode',
        type: 'text',
        required: true,
        maxLength: 30,
      },
      {
        key: 'year',
        labelKey: 'hrmCommon.year',
        type: 'integer',
        required: true,
        min: 2000,
        max: 2100,
        defaultValue: String(new Date().getFullYear()),
      },
      ...MONTHS.map((month): CrudField => ({
        key: `m${month}`,
        labelKey: `hrmShortTime.construction.months.m${month}`,
        type: 'decimal',
        min: 0,
        max: 400,
      })),
    ],
    // API: `months` needs at least one entry
    validate: (payload) => (MONTHS.some((month) => payload[`m${month}`] !== undefined) ? null : 'hrmShortTime.construction.atLeastOneMonth'),
    submit: (payload) =>
      this.api.saveConstructionCalendar({
        agreement_code: String(payload['agreement_code']),
        months: MONTHS.filter((month) => payload[`m${month}`] !== undefined).map((month) => ({
          year: Number(payload['year']),
          month,
          planned_hours: payload[`m${month}`] as unknown as number,
        })),
      }),
  };

  protected loadHours(): void {
    this.api.getConstructionHours(this.query()).subscribe({
      next: (res) => this.hours.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected loadReport(): void {
    this.api.getJointCommissionReport(this.query()).subscribe({
      next: (res) => this.report.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  private query(): ConstructionQuery {
    return {
      agreement_code: this.agreementCode(),
      accounting_year: this.accountingYear(),
      ...(this.employeeId() ? { employee_id: this.employeeId() as string } : {}),
    };
  }

  private parseWages(text: unknown): ConstructionParametersPayload['minimum_wages'] | null {
    try {
      const value: unknown = JSON.parse(String(text ?? ''));
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as ConstructionParametersPayload['minimum_wages'])
        : null;
    } catch {
      return null;
    }
  }
}
