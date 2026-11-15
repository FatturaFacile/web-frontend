import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TranslateService, WmsApiService, WmsDashboard, WMS_TASK_TYPES } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** Task throughput per day, open work, short picks and dock utilization of the warehouse. */
@Component({
  selector: 'app-wms-dashboard',
  imports: [DecimalPipe, FormsModule, PageHeaderComponent, TranslatePipe, NzCardModule, NzSelectModule, NzStatisticModule, NzTableModule],
  template: `
    <app-page-header [title]="'WMS.DASHBOARD_TITLE' | translate" [subtitle]="'WMS.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" [ngModel]="days()" (ngModelChange)="days.set($event); load()" [attr.aria-label]="'WMS.PERIOD' | translate">
        @for (value of windows; track value) {
          <nz-option [nzValue]="value" [nzLabel]="'WMS.LAST_DAYS' | translate: { days: value }"></nz-option>
        }
      </nz-select>
    </div>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'WMS.TASKS_DONE' | translate" [nzValue]="data.throughput.total"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'WMS.TASKS_OPEN' | translate" [nzValue]="data.open_tasks.total"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'WMS.PICK_SHORT_RATE' | translate" [nzValue]="data.pick_short_rate_percent !== null ? data.pick_short_rate_percent + ' %' : '-'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'WMS.DOCK_UTILIZATION' | translate" [nzValue]="data.dock_utilization.overall_percent + ' %'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'WMS.PENDING_RECOMMENDATIONS' | translate" [nzValue]="data.pending_recommendations"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'WMS.OPEN_WAVES' | translate" [nzValue]="data.open_waves"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'WMS.OPEN_CROSS_DOCKS' | translate" [nzValue]="data.open_cross_docks"></nz-statistic></nz-card>
      </div>

      <nz-card [nzTitle]="'WMS.THROUGHPUT' | translate" style="margin-bottom: 16px">
        <nz-table #throughputTable [nzData]="data.throughput.per_day" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'WMS.DATE' | translate }}</th>
              @for (type of types; track type) {
                <th>{{ 'WMS.TYPE_' + type.toUpperCase() | translate }}</th>
              }
              <th>{{ 'WMS.TOTAL' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of throughputTable.data; track row.date) {
              <tr>
                <td>{{ row.date }}</td>
                @for (type of types; track type) {
                  <td>{{ row[type] }}</td>
                }
                <td>{{ row.total }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card [nzTitle]="'WMS.DOCK_DOORS' | translate">
        <nz-table #doorTable [nzData]="data.dock_utilization.doors" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'WMS.DOOR' | translate }}</th>
              <th>{{ 'WMS.BOOKED_HOURS' | translate }}</th>
              <th>{{ 'WMS.UTILIZATION' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (door of doorTable.data; track door.door_id) {
              <tr>
                <td>{{ door.code }}</td>
                <td>{{ door.booked_hours | number: '1.2-2' }}</td>
                <td>{{ door.utilization_percent | number: '1.2-2' }} %</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class WmsDashboardComponent implements OnInit {
  private readonly api = inject(WmsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly windows = [7, 14, 30, 90];
  readonly types = WMS_TASK_TYPES;
  readonly days = signal(14);
  readonly dashboard = signal<WmsDashboard | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getDashboard({ days: this.days() }).subscribe({
      next: (response) => this.dashboard.set(response.data),
      error: () => this.message.error(this.translate.instant('WMS.LOAD_ERROR')),
    });
  }
}
