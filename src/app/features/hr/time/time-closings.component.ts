import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FetchGridModel, HrTimeApiService, I18nService, QueryFilterParams, TimeClosingResource, TimeTransferResult } from '@core';
import { BaseTableComponent, TableColumnDef, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { reportHttpError } from '../shared/hr-http.util';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';
import { ReasonButtonComponent } from '../shared/reason-button.component';

/** Monthly time closings: close a month, reopen it with a mandatory reason. */
@Component({
  selector: 'app-time-closings',
  styleUrl: './time-closings.component.scss',
  imports: [
    BaseTableComponent,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    TranslatePipe,
    HrStatusTagComponent,
    ReasonButtonComponent,
  ],
  template: `
    <div class="filter-bar">
      <div>
        <label for="closing-year">{{ 'hrmCommon.year' | translate }}</label>
        <input nz-input id="closing-year" type="number" [ngModel]="year()" (ngModelChange)="setYear($event)" />
      </div>
      @if (canWrite()) {
        <div>
          <label for="closing-month">{{ 'hrmLeave.month' | translate }}</label>
          <input
            nz-input
            id="closing-month"
            type="number"
            min="1"
            max="12"
            [ngModel]="month()"
            (ngModelChange)="month.set($event)"
          />
        </div>
        <button nz-button nzType="primary" type="button" [disabled]="!canClose()" [nzLoading]="saving()" (click)="close()">
          {{ 'hrmTime.closeMonth' | translate }}
        </button>
      }
    </div>
    @if (transfer(); as t) {
      <nz-alert
        class="mb-3"
        nzType="success"
        nzShowIcon
        [nzMessage]="'hrmTime.transferDone' | translate: { month: t.month + '/' + t.year, employees: t.employees_processed, inputs: t.inputs_upserted, credits: t.night_time_bank_credits }"
      />
    }
    <app-base-table [grid]="grid" [columns]="columns()" [actionsTemplate]="canWrite() ? actionsTpl : undefined" [scroll]="{}" exportFileName="time-closings" />

    <ng-template #statusTpl let-row><app-hr-status-tag [value]="row.status" /></ng-template>
    <ng-template #closedAtTpl let-row>{{ row.closed_at | date: 'medium' }}</ng-template>
    <ng-template #actionsTpl let-row>
      @if (row.status.toLowerCase() === 'closed') {
        <app-reason-button labelKey="hrmTime.reopen" [danger]="true" (confirmed)="reopen(row, $event)" />
      }
      @if (canTransfer(row)) {
        <button nz-button nzSize="small" type="button" (click)="transferToPayroll(row)">
          {{ 'hrmTime.transferToPayroll' | translate }}
        </button>
      }
    </ng-template>
  `,
})
export class TimeClosingsComponent {
  readonly canWrite = input(false);

  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Server-driven grid of the closings of the selected year. */
  protected readonly grid = new FetchGridModel<TimeClosingResource, QueryFilterParams & { year?: number }>((query) =>
    this.api.getTimeClosings(query.year, query),
  );
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');
  private readonly closedAtTpl = viewChild<TemplateRef<unknown>>('closedAtTpl');
  protected readonly columns = computed<TableColumnDef<TimeClosingResource>[]>(() => {
    return [
      { key: 'year', header: 'hrmCommon.year' },
      { key: 'month', header: 'hrmLeave.month' },
      { key: 'status', header: 'hrmCommon.statusCol', customCellTemplate: this.statusTpl() },
      { key: 'closed_at', header: 'hrmTime.closedAt', customCellTemplate: this.closedAtTpl() },
      { key: 'reopen_count', header: 'hrmTime.reopenCount', align: 'right' },
      { key: 'reopen_reason', header: 'hrmTime.lastReopenReason' },
    ];
  });
  protected readonly saving = signal(false);
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly month = signal<number | null>(null);
  protected readonly transfer = signal<TimeTransferResult | null>(null);

  constructor() {
    this.grid.setFilter({ year: this.year() });
  }

  protected setYear(value: number): void {
    this.year.set(value);
    this.grid.setFilter({ year: value || undefined });
  }

  protected canClose(): boolean {
    const month = this.month();
    return month !== null && month >= 1 && month <= 12 && this.year() >= 2000 && this.year() <= 2100;
  }

  protected reload(): void {
    this.grid.reload();
  }

  protected close(): void {
    this.saving.set(true);
    this.api.closeMonth(this.year(), this.month() ?? 0).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('hrmCommon.saved'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  /** A closed (or approved) period can be carried into the payroll variable inputs. */
  protected canTransfer(row: TimeClosingResource): boolean {
    return ['closed', 'approved'].includes(row.status.toLowerCase());
  }

  protected transferToPayroll(row: TimeClosingResource): void {
    this.api.transferToPayroll(row.year, row.month).subscribe({
      next: (res) => this.transfer.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected reopen(row: TimeClosingResource, reason: string): void {
    this.api.reopenMonth(row.id, reason).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmCommon.saved'));
        this.reload();
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
