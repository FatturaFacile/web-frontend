import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { HrTimeApiService, I18nService, TimePresenceRow } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';

/** Who is in now: the state of every employee from the last punch. */
@Component({
  selector: 'app-time-presence',
  imports: [DatePipe, NzButtonModule, NzIconModule, NzTableModule, TranslatePipe],
  template: `
    <div class="flex justify-between items-center mb-3">
      <h3 class="m-0">{{ 'hrmTimeX.presence' | translate }}</h3>
      <button
        nz-button
        type="button"
        [attr.aria-label]="'hrmCommon.refresh' | translate"
        (click)="reload()"
      >
        <nz-icon nzType="reload" />
      </button>
    </div>
    <nz-table
      #table
      [nzData]="rows()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      nzSize="middle"
    >
      <thead>
        <tr>
          <th>{{ 'hrmCommon.employee' | translate }}</th>
          <th>{{ 'hrmCommon.statusCol' | translate }}</th>
          <th>{{ 'hrmTimeX.since' | translate }}</th>
          <th>{{ 'hrmTime.source' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.employee_id) {
          <tr>
            <td>{{ row.employee_name }}</td>
            <td>{{ row.state }}</td>
            <td>{{ row.since | date: 'medium' }}</td>
            <td>{{ row.source }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class TimePresenceComponent implements OnInit {
  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly rows = signal<TimePresenceRow[]>([]);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getPresence().subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
