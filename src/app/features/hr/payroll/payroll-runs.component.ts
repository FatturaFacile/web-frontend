import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { FetchGridModel, I18nService, PayrollApiService, PayrollRunRecord, QueryFilterParams } from '@core';
import { BaseTableComponent, ModalActionsDirective, TableColumnDef, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { reportHttpError } from '../shared/hr-http.util';
import { PayrollRunDetailComponent } from './payroll-run-detail.component';
import { PayrollRunStatusTagComponent } from './payroll-run-status-tag.component';

/** Monthly payroll runs: calculate / recalculate a month and open the run (approve, finalize, reopen). */
@Component({
  selector: 'app-payroll-runs',
  styleUrl: './payroll-runs.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzModalModule,
    NzInputModule,
    TranslatePipe,
    PayrollRunDetailComponent,
    PayrollRunStatusTagComponent,
  ],
  template: `
    <div class="filter-bar">
      <div>
        <label for="run-filter-year">{{ 'hrmCommon.year' | translate }}</label>
        <input nz-input id="run-filter-year" type="number" [ngModel]="year()" (ngModelChange)="setYear($event)" />
      </div>
      @if (canWrite()) {
        <div>
          <label for="run-month">{{ 'hrmLeave.month' | translate }}</label>
          <input nz-input id="run-month" type="number" min="1" max="12" [ngModel]="month()" (ngModelChange)="month.set($event)" />
        </div>
        <div>
          <label for="run-payment">{{ 'hrmPayroll.paymentDate' | translate }}</label>
          <input nz-input id="run-payment" type="date" [ngModel]="paymentDate()" (ngModelChange)="paymentDate.set($event)" />
        </div>
        <button nz-button nzType="primary" type="button" [disabled]="!canCalculate()" [nzLoading]="calculating()" (click)="calculate()">
          {{ 'hrmPayroll.calculate' | translate }}
        </button>
      }
    </div>

    <app-base-table
      [grid]="grid"
      [columns]="columns()"
      [actionsTemplate]="actionsTpl"
      [scroll]="{}"
      exportFileName="payroll-runs"
    />

    <ng-template #countryTpl let-run>{{ run.country }} ({{ run.currency }})</ng-template>
    <ng-template #statusTpl let-run><app-payroll-run-status-tag [status]="run.status" /></ng-template>
    <ng-template #paymentDateTpl let-run>{{ run.payment_date | date: 'mediumDate' }}</ng-template>
    <ng-template #actionsTpl let-run>
      <button nz-button nzSize="small" type="button" (click)="selectedId.set(run.id)">
        {{ 'hrmCommon.view' | translate }}
      </button>
    </ng-template>

    <nz-modal
      [nzVisible]="selectedId() !== null"
      [nzTitle]="'hrmPayroll.run' | translate"
      [nzWidth]="860"
      [nzFooter]="null"
      (nzOnCancel)="closeDetail()"
    >
      <ng-container *nzModalContent>
        @if (selectedId(); as id) {
          <app-payroll-run-detail [runId]="id" [canWrite]="canWrite()" (changed)="reload()" />
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PayrollRunsComponent {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Server-driven grid of the runs: paging, sorting, filters and grouping run over the whole dataset. */
  protected readonly grid = new FetchGridModel<PayrollRunRecord, QueryFilterParams & { year?: number }>((query) =>
    this.api.getRuns(query),
  );
  private readonly countryTpl = viewChild<TemplateRef<unknown>>('countryTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');
  private readonly paymentDateTpl = viewChild<TemplateRef<unknown>>('paymentDateTpl');

  protected readonly columns = computed<TableColumnDef<PayrollRunRecord>[]>(() => {
    return [
      { key: 'year', header: 'hrmCommon.year' },
      { key: 'month', header: 'hrmLeave.month' },
      { key: 'country', header: 'hrmPayroll.country', customCellTemplate: this.countryTpl() },
      { key: 'status', header: 'hrmCommon.statusCol', customCellTemplate: this.statusTpl() },
      { key: 'payment_date', header: 'hrmPayroll.paymentDate', customCellTemplate: this.paymentDateTpl() },
      { key: 'reopen_count', header: 'hrmPayroll.reopenCount', align: 'right' },
    ];
  });
  protected readonly calculating = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly month = signal<number | null>(null);
  protected readonly paymentDate = signal('');

  constructor() {
    this.grid.setFilter({ year: this.year() });
  }

  protected setYear(value: number): void {
    this.year.set(value);
    this.grid.setFilter({ year: value || undefined });
  }

  protected canCalculate(): boolean {
    const month = this.month();
    return month !== null && month >= 1 && month <= 12 && this.year() >= 2000 && this.year() <= 2100;
  }

  protected closeDetail(): void {
    this.selectedId.set(null);
  }

  protected reload(): void {
    this.grid.reload();
  }

  protected calculate(): void {
    this.calculating.set(true);
    this.api
      .calculateRun({
        year: this.year(),
        month: this.month() ?? 0,
        payment_date: this.paymentDate() || null,
      })
      .subscribe({
        next: (res) => {
          this.calculating.set(false);
          this.message.success(this.i18n.translate('hrmPayroll.calculated'));
          this.reload();
          this.selectedId.set(res.data.id);
        },
        error: (err: unknown) => {
          this.calculating.set(false);
          if (err instanceof HttpErrorResponse && err.status === 409) {
            // An approved run cannot be recalculated: reopen it first.
            this.message.error(this.i18n.translate('hrmPayroll.recalculateApproved'));
          } else {
            reportHttpError(err, this.message, this.i18n);
          }
        },
      });
  }
}
