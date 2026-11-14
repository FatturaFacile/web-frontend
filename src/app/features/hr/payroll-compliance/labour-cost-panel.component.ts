import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuthStore,
  ChildAllowanceRow,
  I18nService,
  LabourCostGroupBy,
  LabourCostReport,
  PayrollComplianceApiService,
} from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CrudOption } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

/** Hours and labour cost by department or site, and the family allowance of each child for a month. */
@Component({
  selector: 'app-labour-cost-panel',
  styleUrl: './labour-cost-panel.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <h4>{{ 'hrmCompliance.labour.title' | translate }}</h4>
    <div class="filter-bar">
      <div>
        <label for="lc-year">{{ 'hrmCommon.year' | translate }}</label>
        <input
          nz-input
          id="lc-year"
          type="number"
          [ngModel]="year()"
          (ngModelChange)="year.set($event)"
        />
      </div>
      <div>
        <label for="lc-month">{{ 'hrmLeave.month' | translate }}</label>
        <input
          nz-input
          id="lc-month"
          type="number"
          min="1"
          max="12"
          [ngModel]="month()"
          (ngModelChange)="month.set($event)"
        />
      </div>
      <div>
        <label for="lc-group">{{ 'hrmCompliance.labour.groupBy' | translate }}</label>
        <nz-select
          id="lc-group"
          class="w-field-sm"
          nzAllowClear
          [ngModel]="groupBy()"
          (ngModelChange)="groupBy.set($event)"
        >
          <nz-option
            nzValue="department"
            [nzLabel]="'hrmCompliance.labour.department' | translate"
          />
          <nz-option nzValue="site" [nzLabel]="'hrmCompliance.labour.site' | translate" />
        </nz-select>
      </div>
      <button nz-button type="button" [nzLoading]="loadingCost()" (click)="loadCost()">
        {{ 'hrmCompliance.labour.run' | translate }}
      </button>
    </div>
    @if (report(); as r) {
      @if (r.employees_without_hours > 0) {
        <nz-alert
          class="mb-2"
          nzType="warning"
          nzShowIcon
          [nzMessage]="
            'hrmCompliance.labour.withoutHours' | translate: { count: r.employees_without_hours }
          "
        />
      }
      <nz-table #costTable [nzData]="r.rows" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmCompliance.labour.group' | translate }}</th>
            <th [nzSortFn]="'headcount' | gridSort" [nzFilters]="'headcount' | gridFilterList: costTable.nzData" [nzFilterFn]="'headcount' | gridFilterFn">{{ 'hrmCompliance.labour.headcount' | translate }}</th>
            <th [nzSortFn]="'hours' | gridSort" [nzFilters]="'hours' | gridFilterList: costTable.nzData" [nzFilterFn]="'hours' | gridFilterFn">{{ 'hrmCommon.hours' | translate }}</th>
            <th [nzSortFn]="'gross_salary' | gridSort" [nzFilters]="'gross_salary' | gridFilterList: costTable.nzData" [nzFilterFn]="'gross_salary' | gridFilterFn">{{ 'hrmPayroll.gross' | translate }}</th>
            <th [nzSortFn]="'employer_contributions' | gridSort" [nzFilters]="'employer_contributions' | gridFilterList: costTable.nzData" [nzFilterFn]="'employer_contributions' | gridFilterFn">{{ 'hrmPayroll.employerContributions' | translate }}</th>
            <th [nzSortFn]="'labour_cost' | gridSort" [nzFilters]="'labour_cost' | gridFilterList: costTable.nzData" [nzFilterFn]="'labour_cost' | gridFilterFn">{{ 'hrmCompliance.labour.cost' | translate }}</th>
            <th [nzSortFn]="'cost_per_hour' | gridSort" [nzFilters]="'cost_per_hour' | gridFilterList: costTable.nzData" [nzFilterFn]="'cost_per_hour' | gridFilterFn">{{ 'hrmCompliance.labour.costPerHour' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of costTable.data; track $index) {
            <tr>
              <td>{{ row.group_name ?? '-' }}</td>
              <td>{{ row.headcount }}</td>
              <td>{{ row.hours }}</td>
              <td>{{ row.gross_salary | money: currency() }}</td>
              <td>{{ row.employer_contributions | money: currency() }}</td>
              <td>{{ row.labour_cost | money: currency() }}</td>
              <td>{{ row.cost_per_hour | money: currency() }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <h4 class="mt-4">{{ 'hrmCompliance.children.title' | translate }}</h4>
    <div class="filter-bar">
      <div>
        <label for="ch-employee">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select
          id="ch-employee"
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
      <button nz-button type="button" [nzLoading]="loadingChildren()" (click)="loadChildren()">
        {{ 'hrmCompliance.children.run' | translate }}
      </button>
    </div>
    @if (children(); as rows) {
      <nz-table #childTable [nzData]="rows" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th [nzSortFn]="'employee_name' | gridSort" [nzFilters]="'employee_name' | gridFilterList: childTable.nzData" [nzFilterFn]="'employee_name' | gridFilterFn">{{ 'hrmCommon.employee' | translate }}</th>
            <th>{{ 'hrmCommon.type' | translate }}</th>
            <th [nzSortFn]="'amount' | gridSort" [nzFilters]="'amount' | gridFilterList: childTable.nzData" [nzFilterFn]="'amount' | gridFilterFn">{{ 'hrmCompliance.children.amount' | translate }}</th>
            <th [nzSortFn]="'canton' | gridSort" [nzFilters]="'canton' | gridFilterList: childTable.nzData" [nzFilterFn]="'canton' | gridFilterFn">{{ 'hrmPayroll.canton' | translate }}</th>
            <th>{{ 'hrmCompliance.children.rateValidFrom' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of childTable.data; track row.child_id) {
            <tr>
              <td>{{ row.employee_name }}</td>
              <td>
                {{ row.kind ? ('hrmCompliance.children.kinds.' + row.kind | translate) : '-' }}
              </td>
              <td>{{ row.amount | money: currency() }}</td>
              <td>{{ row.canton }}</td>
              <td>{{ row.rate_valid_from ?? '-' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class LabourCostPanelComponent {
  readonly employees = input<CrudOption[]>([]);

  private readonly api = inject(PayrollComplianceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly authStore = inject(AuthStore);

  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly month = signal<number | null>(new Date().getMonth() + 1);
  protected readonly groupBy = signal<LabourCostGroupBy | null>('department');
  protected readonly employeeId = signal<string | null>(null);
  protected readonly report = signal<LabourCostReport | null>(null);
  protected readonly children = signal<ChildAllowanceRow[] | null>(null);
  protected readonly loadingCost = signal(false);
  protected readonly loadingChildren = signal(false);
  protected readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');

  protected loadCost(): void {
    this.loadingCost.set(true);
    this.api
      .getLabourCostReport({ year: this.year(), month: this.month(), group_by: this.groupBy() })
      .subscribe({
        next: (res) => {
          this.report.set(res.data);
          this.loadingCost.set(false);
        },
        error: (err: unknown) => {
          this.loadingCost.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  protected loadChildren(): void {
    this.loadingChildren.set(true);
    this.api
      .getChildAllowances({
        year: this.year(),
        month: this.month() ?? new Date().getMonth() + 1,
        employee_id: this.employeeId(),
      })
      .subscribe({
        next: (res) => {
          this.children.set(res.data);
          this.loadingChildren.set(false);
        },
        error: (err: unknown) => {
          this.loadingChildren.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }
}
