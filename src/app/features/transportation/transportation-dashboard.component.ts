import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TMS_ORDER_STATUSES, TMS_TRIP_STATUSES, TranslateService, TransportationApiService, TransportationDashboard } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/** On-time delivery, cost per km and per kg, the workload by status and the open disputes. */
@Component({
  selector: 'app-transportation-dashboard',
  imports: [DecimalPipe, FormsModule, PageHeaderComponent, TranslatePipe, NzCardModule, NzSelectModule, NzStatisticModule, NzTableModule],
  template: `
    <app-page-header [title]="'TMS.DASHBOARD_TITLE' | translate" [subtitle]="'TMS.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" [ngModel]="days()" (ngModelChange)="days.set($event); load()" [attr.aria-label]="'TMS.PERIOD' | translate">
        @for (value of windows; track value) {
          <nz-option [nzValue]="value" [nzLabel]="'TMS.LAST_DAYS' | translate: { days: value }"></nz-option>
        }
      </nz-select>
    </div>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'TMS.ON_TIME' | translate" [nzValue]="data.on_time.percent !== null ? data.on_time.percent + ' % (' + data.on_time.on_time + '/' + data.on_time.delivered + ')' : '-'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TMS.COST_PER_KM' | translate" [nzValue]="data.cost_per_km.value !== null ? ((data.cost_per_km.value | number: '1.2-4') ?? '') : '-'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TMS.COST_PER_KG' | translate" [nzValue]="data.cost_per_kg.value !== null ? ((data.cost_per_kg.value | number: '1.2-4') ?? '') : '-'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TMS.OPEN_DISPUTES' | translate" [nzValue]="data.disputes.open"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TMS.OVER_BILLED' | translate" [nzValue]="(data.disputes.over_billed_amount | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TMS.CREDITED' | translate" [nzValue]="(data.disputes.credited_amount | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
      </div>

      <div class="stats-grid">
        <nz-card [nzTitle]="'TMS.ORDERS_BY_STATUS' | translate">
          @for (status of orderStatuses; track status) {
            <p>{{ 'RES.V.' + status | translate }}: {{ data.orders_by_status[status] }}</p>
          }
        </nz-card>
        <nz-card [nzTitle]="'TMS.TRIPS_BY_STATUS' | translate">
          @for (status of tripStatuses; track status) {
            <p>{{ 'RES.V.' + status | translate }}: {{ data.trips_by_status[status] }}</p>
          }
        </nz-card>
      </div>
    }
  `,
})
export class TransportationDashboardComponent implements OnInit {
  private readonly api = inject(TransportationApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly windows = [7, 30, 90, 365];
  readonly orderStatuses = TMS_ORDER_STATUSES;
  readonly tripStatuses = TMS_TRIP_STATUSES;
  readonly days = signal(30);
  readonly dashboard = signal<TransportationDashboard | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getDashboard(this.days()).subscribe({
      next: (response) => this.dashboard.set(response.data),
      error: () => this.message.error(this.translate.instant('TMS.LOAD_ERROR')),
    });
  }
}
