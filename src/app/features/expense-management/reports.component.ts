import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EXM_REPORT_STATUSES, ExmReport, ExmReportStatus } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { BalanceWidgetComponent } from './balance-widget.component';
import { FiscalNoticesComponent } from './fiscal-notices.component';
import { currentMonth, statusColor } from './expense-management.util';
import { ReportsStore } from './reports.store';

/**
 * Expense reports (Mod 075): the list with the filters (status, period, employee, search), the balance of the member
 * and the creation of a new report, which opens its editor.
 */
@Component({
  selector: 'app-exm-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BalanceWidgetComponent,
    FiscalNoticesComponent,
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [ReportsStore],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.EXPENSE_MANAGEMENT_REPORTS' | translate"
    ></app-page-header>

    <app-exm-balance-widget [balance]="store.balance()"></app-exm-balance-widget>
    <app-exm-fiscal-notices
      [jurisdiction]="store.jurisdiction()"
      [noticeCodes]="store.fiscalNoticeCodes()"
    ></app-exm-fiscal-notices>

    <div class="toolbar">
      <label class="field" for="exm-filter-status">
        <span>{{ 'expenseManagement.field.status' | translate }}</span>
        <nz-select
          nzId="exm-filter-status"
          nzAllowClear
          [nzPlaceHolder]="'expenseManagement.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'expenseManagement.status.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="exm-filter-employee">
        <span>{{ 'expenseManagement.field.employee' | translate }}</span>
        <nz-select
          nzId="exm-filter-employee"
          nzAllowClear
          nzShowSearch
          [nzPlaceHolder]="'expenseManagement.action.all' | translate"
          [ngModel]="store.filters().employee_id ?? null"
          (ngModelChange)="store.setFilters({ employee_id: $event ?? undefined })"
        >
          @for (employee of store.employees(); track employee.id) {
            <nz-option [nzValue]="employee.id" [nzLabel]="employee.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="exm-filter-from">
        <span>{{ 'expenseManagement.field.from' | translate }}</span>
        <input
          nz-input
          id="exm-filter-from"
          type="date"
          [ngModel]="store.filters().period_from ?? ''"
          (ngModelChange)="store.setFilters({ period_from: $event || undefined })"
        />
      </label>
      <label class="field" for="exm-filter-to">
        <span>{{ 'expenseManagement.field.to' | translate }}</span>
        <input
          nz-input
          id="exm-filter-to"
          type="date"
          [ngModel]="store.filters().period_to ?? ''"
          (ngModelChange)="store.setFilters({ period_to: $event || undefined })"
        />
      </label>
      <label class="field" for="exm-filter-search">
        <span>{{ 'expenseManagement.field.search' | translate }}</span>
        <input
          nz-input
          id="exm-filter-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setFilters({ q: search() || undefined })"
        />
      </label>
      <button nz-button type="button" (click)="store.setFilters({ q: search() || undefined })">
        {{ 'expenseManagement.action.search' | translate }}
      </button>
      <button nz-button nzType="primary" type="button" (click)="openCreate()">
        {{ 'expenseManagement.action.newReport' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.reports()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'expenseManagement.field.number' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.employee' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.period' | translate }}</th>
            <th scope="col" class="num">{{ 'expenseManagement.field.total' | translate }}</th>
            <th scope="col" class="num">
              {{ 'expenseManagement.field.reimbursable' | translate }}
            </th>
            <th scope="col">{{ 'expenseManagement.field.violations' | translate }}</th>
            <th scope="col">{{ 'expenseManagement.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (report of table.data; track report.id) {
            <tr>
              <th scope="row">
                {{ report.report_number }}
                @if (report.title) {
                  <small class="muted">{{ report.title }}</small>
                }
              </th>
              <td>{{ report.employee?.name }}</td>
              <td>{{ report.period_start }} – {{ report.period_end }}</td>
              <td class="num">{{ report.total_amount | money: report.currency }}</td>
              <td class="num">{{ report.reimbursable_amount | money: report.currency }}</td>
              <td>
                @if (report.blocking_violations_count > 0) {
                  <nz-tag nzColor="red">{{ report.blocking_violations_count }}</nz-tag>
                }
                @if (report.violations_count > report.blocking_violations_count) {
                  <nz-tag nzColor="orange">{{
                    report.violations_count - report.blocking_violations_count
                  }}</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="color(report.status)">{{
                  'expenseManagement.status.' + report.status | translate
                }}</nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="open(report)">
                  {{ 'expenseManagement.action.open' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty
                  [nzNotFoundContent]="'expenseManagement.empty.reports' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="creating()"
      [nzTitle]="'expenseManagement.action.newReport' | translate"
      [nzOkText]="'expenseManagement.action.create' | translate"
      [nzCancelText]="'expenseManagement.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="create()"
      (nzOnCancel)="creating.set(false)"
    >
      <ng-container *nzModalContent>
        <form [formGroup]="form" class="form">
          @if (createError(); as error) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
          }
          <label for="exm-new-title">{{ 'expenseManagement.field.title' | translate }}</label>
          <input nz-input id="exm-new-title" formControlName="title" maxlength="160" />
          <label for="exm-new-employee">{{ 'expenseManagement.field.employee' | translate }}</label>
          <nz-select
            nzId="exm-new-employee"
            nzAllowClear
            nzShowSearch
            formControlName="employee_id"
          >
            @for (employee of store.employees(); track employee.id) {
              <nz-option [nzValue]="employee.id" [nzLabel]="employee.name"></nz-option>
            }
          </nz-select>
          <label for="exm-new-start">{{ 'expenseManagement.field.periodStart' | translate }}</label>
          <input nz-input id="exm-new-start" type="date" formControlName="period_start" />
          <label for="exm-new-end">{{ 'expenseManagement.field.periodEnd' | translate }}</label>
          <input nz-input id="exm-new-end" type="date" formControlName="period_end" />
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      min-width: 160px;
      gap: 4px;
    }
    .feedback {
      margin-bottom: 12px;
    }
    .num {
      text-align: right;
    }
    .muted {
      display: block;
      font-weight: normal;
      opacity: 0.65;
    }
    .form {
      display: grid;
      gap: 8px;
    }
  `,
})
export class ReportsComponent implements OnInit {
  protected readonly store = inject(ReportsStore);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly statuses: readonly ExmReportStatus[] = EXM_REPORT_STATUSES;
  protected readonly search = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: [''],
    employee_id: [''],
    period_start: [currentMonth().start, Validators.required],
    period_end: [currentMonth().end, Validators.required],
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected color(status: ExmReportStatus): string {
    return statusColor(status);
  }

  protected open(report: ExmReport): void {
    void this.router.navigate(['/expense-management/reports', report.id]);
  }

  protected openCreate(): void {
    this.createError.set(null);
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const outcome = await this.store.create({
      title: value.title || null,
      employee_id: value.employee_id || null,
      period_start: value.period_start,
      period_end: value.period_end,
    });
    if (!outcome.ok) {
      this.createError.set(outcome.errorKey);
      return;
    }
    this.creating.set(false);
    const created = this.store.created();
    if (created) {
      this.open(created);
    }
  }
}
