import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import {
  EXM_SEVERITIES,
  ExmEmployeeRef,
  ExmPageMeta,
  ExmSeverity,
  ExmViolationFilters,
  ExmViolationRow,
  ExpenseManagementApiService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { failureOf } from './expense-management.util';
import { ViolationBadgesComponent } from './violation-badges.component';

/** Policy violations overview (Mod 075): every flagged line with its violations, filtered by severity and employee. */
@Component({
  selector: 'app-exm-violations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    ViolationBadgesComponent,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.EXPENSE_MANAGEMENT_VIOLATIONS' | translate"
    ></app-page-header>

    <div class="toolbar">
      <label class="field" for="exm-vio-severity">
        <span>{{ 'expenseManagement.field.severity' | translate }}</span>
        <nz-select
          nzId="exm-vio-severity"
          nzAllowClear
          [nzPlaceHolder]="'expenseManagement.action.all' | translate"
          [ngModel]="filters().severity ?? null"
          (ngModelChange)="setFilters({ severity: $event ?? undefined })"
        >
          @for (severity of severities; track severity) {
            <nz-option
              [nzValue]="severity"
              [nzLabel]="'expenseManagement.severity.' + severity | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="exm-vio-employee">
        <span>{{ 'expenseManagement.field.employee' | translate }}</span>
        <nz-select
          nzId="exm-vio-employee"
          nzAllowClear
          nzShowSearch
          [nzPlaceHolder]="'expenseManagement.action.all' | translate"
          [ngModel]="filters().employee_id ?? null"
          (ngModelChange)="setFilters({ employee_id: $event ?? undefined })"
        >
          @for (employee of employees(); track employee.id) {
            <nz-option [nzValue]="employee.id" [nzLabel]="employee.name"></nz-option>
          }
        </nz-select>
      </label>
    </div>

    @if (error(); as key) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="key | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="rows()"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'expenseManagement.field.number' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.employee' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.expenseDate' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.merchant' | translate }}</th>
            <th scope="col" class="num">{{ 'expenseManagement.field.amount' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.violations' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.line_id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/expense-management/reports', row.report_id]">{{
                  row.report_number
                }}</a>
              </th>
              <td>{{ row.employee?.name }}</td>
              <td>{{ row.expense_date }}</td>
              <td>{{ row.merchant_name }}</td>
              <td class="num">{{ row.amount | money: currency() }}</td>
              <td>
                <app-exm-violation-badges [violations]="row.violations"></app-exm-violation-badges>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">
                <nz-empty
                  [nzNotFoundContent]="'expenseManagement.empty.violations' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      gap: 4px;
    }
    .feedback {
      margin-bottom: 12px;
    }
    .num {
      text-align: right;
    }
  `,
})
export class ViolationsComponent implements OnInit {
  private readonly api = inject(ExpenseManagementApiService);

  protected readonly severities: readonly ExmSeverity[] = EXM_SEVERITIES;
  protected readonly filters = signal<ExmViolationFilters>({ page: 1, per_page: 25 });
  protected readonly rows = signal<ExmViolationRow[]>([]);
  protected readonly meta = signal<ExmPageMeta | null>(null);
  protected readonly employees = signal<ExmEmployeeRef[]>([]);
  protected readonly currency = signal('EUR');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly total = computed(() => this.meta()?.total ?? 0);
  protected readonly page = computed(() => this.meta()?.current_page ?? 1);
  protected readonly pageSize = computed(() => this.meta()?.per_page ?? 25);

  ngOnInit(): void {
    void firstValueFrom(this.api.getLookups())
      .then((response) => {
        this.employees.set(response.data.employees);
        this.currency.set(response.data.base_currency);
      })
      .catch(() => this.employees.set([]));
    void this.load(this.filters());
  }

  protected setFilters(patch: Partial<ExmViolationFilters>): Promise<void> {
    return this.load({ ...this.filters(), ...patch, page: 1 });
  }

  protected setPage(page: number): Promise<void> {
    return this.load({ ...this.filters(), page });
  }

  private async load(filters: ExmViolationFilters): Promise<void> {
    this.filters.set(filters);
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.listViolations(filters));
      this.rows.set(response.data);
      this.meta.set(response.meta);
    } catch (error) {
      this.error.set((await failureOf(error)).errorKey);
    } finally {
      this.loading.set(false);
    }
  }
}
