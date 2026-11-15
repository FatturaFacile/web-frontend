import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FleetApiService, FleetDashboard, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './fleet.util';

/** Cost of ownership per vehicle, cost per km and what is about to expire or is overdue. */
@Component({
  selector: 'app-fleet-dashboard',
  styleUrl: './fleet.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FLEET.DASHBOARD_TITLE' | translate" [subtitle]="'FLEET.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 240px" [ngModel]="days()" (ngModelChange)="days.set($event); load()" [attr.aria-label]="'FLEET.EXPIRY_WINDOW' | translate">
        @for (value of windows; track value) {
          <nz-option [nzValue]="value" [nzLabel]="'FLEET.WITHIN_DAYS' | translate: { days: value }"></nz-option>
        }
      </nz-select>
    </div>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'FLEET.VEHICLES_TOTAL' | translate" [nzValue]="data.vehicles.total"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'FLEET.RUNNING_COST' | translate" [nzValue]="(data.totals.running_cost | number: '1.2-2') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'FLEET.DISTANCE_KM' | translate" [nzValue]="(data.totals.distance_km | number: '1.0-0') ?? ''"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'FLEET.COST_PER_KM' | translate" [nzValue]="data.totals.cost_per_km !== null ? ((data.totals.cost_per_km | number: '1.3-4') ?? '') : '-'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'FLEET.UNPAID_FINES' | translate" [nzValue]="((data.unpaid_incidents.amount | number: '1.2-2') ?? '') + ' (' + data.unpaid_incidents.count + ')'"></nz-statistic></nz-card>
      </div>

      <nz-card class="main-card" [nzTitle]="'FLEET.UPCOMING_DEADLINES' | translate">
        <nz-table #deadlineTable [nzData]="data.upcoming_deadlines" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
              <th>{{ 'FLEET.DEADLINE_TYPE' | translate }}</th>
              <th>{{ 'FLEET.EXPIRES_ON' | translate }}</th>
              <th>{{ 'FLEET.STATUS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of deadlineTable.data; track row.id) {
              <tr>
                <td><a [routerLink]="['/fleet/vehicles', row.vehicle_id]">{{ row.license_plate }}</a></td>
                <td>{{ ('FLEET.DEADLINE_' + row.deadline_type.toUpperCase()) | translate }}</td>
                <td [class.row-overdue]="row.is_expired">{{ row.expires_on }}</td>
                <td>
                  @if (row.is_expired) {
                    <nz-tag nzColor="red">{{ 'FLEET.EXPIRED' | translate }}</nz-tag>
                  } @else {
                    <nz-tag nzColor="orange">{{ 'FLEET.EXPIRES_IN_DAYS' | translate: { days: row.days_to_expiry } }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.upcoming_deadlines.length === 0) {
          <nz-empty [nzNotFoundContent]="'FLEET.NO_UPCOMING_DEADLINES' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'FLEET.OVERDUE_SERVICES' | translate">
        <nz-table #serviceTable [nzData]="data.overdue_services" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
              <th>{{ 'FLEET.NAME' | translate }}</th>
              <th class="num">{{ 'FLEET.DAYS_TO_DUE' | translate }}</th>
              <th class="num">{{ 'FLEET.KM_TO_DUE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of serviceTable.data; track row.id) {
              <tr>
                <td><a [routerLink]="['/fleet/vehicles', row.vehicle_id]">{{ row.license_plate }}</a></td>
                <td>{{ row.name }}</td>
                <td class="num">{{ row.days_to_due }}</td>
                <td class="num">{{ row.km_to_due }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.overdue_services.length === 0) {
          <nz-empty [nzNotFoundContent]="'FLEET.NO_OVERDUE_SERVICES' | translate"></nz-empty>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'FLEET.COST_OF_OWNERSHIP' | translate">
        <nz-table #costTable [nzData]="data.per_vehicle" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
              <th class="num">{{ 'FLEET.DISTANCE_KM' | translate }}</th>
              <th class="num">{{ 'FLEET.FUEL_COST' | translate }}</th>
              <th class="num">{{ 'FLEET.SERVICE_COST' | translate }}</th>
              <th class="num">{{ 'FLEET.DEADLINE_COST' | translate }}</th>
              <th class="num">{{ 'FLEET.FINES_COST' | translate }}</th>
              <th class="num">{{ 'FLEET.RUNNING_COST' | translate }}</th>
              <th class="num">{{ 'FLEET.TOTAL_COST_OF_OWNERSHIP' | translate }}</th>
              <th class="num">{{ 'FLEET.COST_PER_KM' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of costTable.data; track row.vehicle_id) {
              <tr>
                <td><a [routerLink]="['/fleet/vehicles', row.vehicle_id]">{{ row.license_plate }}</a> <span class="muted">{{ row.make }} {{ row.model }}</span></td>
                <td class="num">{{ row.distance_km | number: '1.0-0' }}</td>
                <td class="num">{{ row.fuel_cost | number: '1.2-2' }}</td>
                <td class="num">{{ row.service_cost | number: '1.2-2' }}</td>
                <td class="num">{{ row.deadline_cost | number: '1.2-2' }}</td>
                <td class="num">{{ row.incident_cost | number: '1.2-2' }}</td>
                <td class="num">{{ row.running_cost | number: '1.2-2' }}</td>
                <td class="num">{{ row.total_cost_of_ownership | number: '1.2-2' }}</td>
                <td class="num">{{ row.cost_per_km !== null ? (row.cost_per_km | number: '1.3-4') : '' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.per_vehicle.length === 0) {
          <nz-empty [nzNotFoundContent]="'FLEET.NO_VEHICLES' | translate"></nz-empty>
        }
      </nz-card>
    }
  `,
})
export class FleetDashboardComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly windows = [15, 30, 60, 90];
  readonly days = signal(30);
  readonly dashboard = signal<FleetDashboard | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getDashboard(this.days()).subscribe({
      next: (response) => this.dashboard.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }
}
