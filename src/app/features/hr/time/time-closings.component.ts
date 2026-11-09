import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrTimeApiService, I18nService, TimeClosingResource } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';
import { ReasonButtonComponent } from '../shared/reason-button.component';

/** Monthly time closings: close a month, reopen it with a mandatory reason. */
@Component({
  selector: 'app-time-closings',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzTableModule,
    TranslatePipe,
    HrStatusTagComponent,
    ReasonButtonComponent,
  ],
  template: `
    <div class="flex items-end gap-2 mb-3 flex-wrap">
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
    <nz-table #table [nzData]="closings()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.year' | translate }}</th>
          <th>{{ 'hrmLeave.month' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
          <th>{{ 'hrmTime.closedAt' | translate }}</th>
          <th>{{ 'hrmTime.reopenCount' | translate }}</th>
          <th>{{ 'hrmTime.lastReopenReason' | translate }}</th>
          @if (canWrite()) {
            <th>{{ 'hrmCommon.actions' | translate }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.year }}</td>
            <td>{{ row.month }}</td>
            <td><app-hr-status-tag [value]="row.status" /></td>
            <td>{{ row.closed_at | date: 'medium' }}</td>
            <td>{{ row.reopen_count }}</td>
            <td>{{ row.reopen_reason }}</td>
            @if (canWrite()) {
              <td>
                @if (row.status.toLowerCase() === 'closed') {
                  <app-reason-button labelKey="hrmTime.reopen" [danger]="true" (confirmed)="reopen(row, $event)" />
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class TimeClosingsComponent implements OnInit {
  readonly canWrite = input(false);

  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly closings = signal<TimeClosingResource[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly month = signal<number | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  protected setYear(value: number): void {
    this.year.set(value);
    this.reload();
  }

  protected canClose(): boolean {
    const month = this.month();
    return month !== null && month >= 1 && month <= 12 && this.year() > 0;
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getTimeClosings(this.year() || undefined).subscribe({
      next: (res) => {
        this.closings.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
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
