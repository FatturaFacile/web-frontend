import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { I18nService, PayrollApiService, PayrollRunRecord } from '@core';
import { ModalActionsDirective, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';
import { PayrollRunDetailComponent } from './payroll-run-detail.component';
import { PayrollRunStatusTagComponent } from './payroll-run-status-tag.component';

/** Monthly payroll runs: calculate / recalculate a month and open the run (approve, finalize, reopen). */
@Component({
  selector: 'app-payroll-runs',
  styleUrl: './payroll-runs.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    ModalActionsDirective,
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzModalModule,
    NzInputModule,
    NzTableModule,
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

    <nz-table #table [nzData]="runs()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th [nzSortFn]="'year' | gridSort">{{ 'hrmCommon.year' | translate }}</th>
          <th [nzSortFn]="'month' | gridSort">{{ 'hrmLeave.month' | translate }}</th>
          <th [nzSortFn]="'country' | gridSort">{{ 'hrmPayroll.country' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
          <th [nzSortFn]="'payment_date' | gridSort">{{ 'hrmPayroll.paymentDate' | translate }}</th>
          <th [nzSortFn]="'reopen_count' | gridSort">{{ 'hrmPayroll.reopenCount' | translate }}</th>
          <th>{{ 'hrmCommon.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (run of table.data; track run.id) {
          <tr>
            <td>{{ run.year }}</td>
            <td>{{ run.month }}</td>
            <td>{{ run.country }} ({{ run.currency }})</td>
            <td><app-payroll-run-status-tag [status]="run.status" /></td>
            <td>{{ run.payment_date | date: 'mediumDate' }}</td>
            <td>{{ run.reopen_count }}</td>
            <td>
              <button nz-button nzSize="small" type="button" (click)="selectedId.set(run.id)">
                {{ 'hrmCommon.view' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

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
export class PayrollRunsComponent implements OnInit {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly runs = signal<PayrollRunRecord[]>([]);
  protected readonly loading = signal(true);
  protected readonly calculating = signal(false);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly month = signal<number | null>(null);
  protected readonly paymentDate = signal('');

  ngOnInit(): void {
    this.reload();
  }

  protected setYear(value: number): void {
    this.year.set(value);
    this.reload();
  }

  protected canCalculate(): boolean {
    const month = this.month();
    return month !== null && month >= 1 && month <= 12 && this.year() >= 2000 && this.year() <= 2100;
  }

  protected closeDetail(): void {
    this.selectedId.set(null);
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getRuns({ year: this.year() || undefined, per_page: 50 }).subscribe({
      next: (res) => {
        this.runs.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
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
