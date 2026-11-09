import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrLeaveApiService, I18nService, LeaveCalendarEntry } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';

/** Leave calendar of a period (from / to are mandatory, Y-m-d). */
@Component({
  selector: 'app-leave-calendar',
  imports: [DatePipe, FormsModule, NzButtonModule, NzInputModule, NzTableModule, TranslatePipe, HrStatusTagComponent],
  template: `
    <div class="flex items-end gap-2 mb-3 flex-wrap">
      <div>
        <label for="cal-from">{{ 'hrmCommon.from' | translate }}</label>
        <input nz-input id="cal-from" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
      </div>
      <div>
        <label for="cal-to">{{ 'hrmCommon.to' | translate }}</label>
        <input nz-input id="cal-to" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
      </div>
      <button nz-button nzType="primary" type="button" [disabled]="!canSearch()" [nzLoading]="loading()" (click)="search()">
        {{ 'hrmLeave.show' | translate }}
      </button>
    </div>
    <nz-table #table [nzData]="entries()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th>{{ 'hrmCommon.employee' | translate }}</th>
          <th>{{ 'hrmCommon.type' | translate }}</th>
          <th>{{ 'hrmCommon.from' | translate }}</th>
          <th>{{ 'hrmCommon.to' | translate }}</th>
          <th>{{ 'hrmCommon.hours' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.employee_name }}</td>
            <td>{{ row.leave_type_name }}</td>
            <td>{{ row.start_date | date: 'mediumDate' }}</td>
            <td>{{ row.end_date | date: 'mediumDate' }}</td>
            <td>{{ row.total_hours }}</td>
            <td><app-hr-status-tag [value]="row.status" /></td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class LeaveCalendarComponent {
  private readonly api = inject(HrLeaveApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly entries = signal<LeaveCalendarEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly canSearch = computed(() => this.from() !== '' && this.to() !== '' && this.from() <= this.to());

  protected search(): void {
    this.loading.set(true);
    this.api.getLeaveCalendar({ from: this.from(), to: this.to() }).subscribe({
      next: (res) => {
        this.entries.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }
}
