import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HrLeaveApiService, I18nService, LeaveCalendarEntry } from '@core';
import { TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';

/** Leave calendar of a period (from / to are mandatory, Y-m-d). */
@Component({
  selector: 'app-leave-calendar',
  styleUrl: './leave-calendar.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    DatePipe, FormsModule, NzButtonModule, NzInputModule, NzTableModule, TranslatePipe, HrStatusTagComponent],
  template: `
    <div class="filter-bar">
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
          <th [nzSortFn]="'employee_name' | gridSort" [nzFilters]="'employee_name' | gridFilterList: table.nzData" [nzFilterFn]="'employee_name' | gridFilterFn">{{ 'hrmCommon.employee' | translate }}</th>
          <th [nzSortFn]="'leave_type_name' | gridSort" [nzFilters]="'leave_type_name' | gridFilterList: table.nzData" [nzFilterFn]="'leave_type_name' | gridFilterFn">{{ 'hrmCommon.type' | translate }}</th>
          <th [nzSortFn]="'start_date' | gridSort" [nzFilters]="'start_date' | gridFilterList: table.nzData" [nzFilterFn]="'start_date' | gridFilterFn">{{ 'hrmCommon.from' | translate }}</th>
          <th [nzSortFn]="'end_date' | gridSort" [nzFilters]="'end_date' | gridFilterList: table.nzData" [nzFilterFn]="'end_date' | gridFilterFn">{{ 'hrmCommon.to' | translate }}</th>
          <th [nzSortFn]="'total_hours' | gridSort" [nzFilters]="'total_hours' | gridFilterList: table.nzData" [nzFilterFn]="'total_hours' | gridFilterFn">{{ 'hrmCommon.hours' | translate }}</th>
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
