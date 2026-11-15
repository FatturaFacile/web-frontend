import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FLEET_VEHICLE_STATUSES, FleetApiService, FleetVehicle, FleetVehicleStatus, TranslateService } from '@core';
import { IconActionDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { FleetVehicleFormComponent } from './fleet-vehicle-form.component';
import { apiErrorText, VEHICLE_STATUS_COLORS } from './fleet.util';

/** The company vehicles with their status, odometer and current driver. */
@Component({
  selector: 'app-fleet-vehicles',
  styleUrl: './fleet.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    FleetVehicleFormComponent,
    IconActionDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FLEET.VEHICLES_TITLE' | translate" [subtitle]="'FLEET.VEHICLES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <input nz-input style="width: 240px" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" (blur)="load()" [placeholder]="'FLEET.SEARCH_VEHICLES' | translate" [attr.aria-label]="'FLEET.SEARCH_VEHICLES' | translate" />
      <nz-select style="width: 180px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); load()" [nzPlaceHolder]="'FLEET.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('FLEET.STATUS_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="vehicles()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'FLEET.LICENSE_PLATE' | translate }}</th>
            <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            <th>{{ 'FLEET.FUEL_TYPE' | translate }}</th>
            <th>{{ 'FLEET.OWNERSHIP' | translate }}</th>
            <th>{{ 'FLEET.STATUS' | translate }}</th>
            <th class="num">{{ 'FLEET.ODOMETER_KM' | translate }}</th>
            <th>{{ 'FLEET.CURRENT_DRIVER' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/fleet/vehicles', row.id]">{{ row.license_plate }}</a></td>
              <td>{{ row.make }} {{ row.model }}</td>
              <td>{{ ('FLEET.FUEL_' + row.fuel_type.toUpperCase()) | translate }}</td>
              <td>{{ ('FLEET.OWNERSHIP_' + row.ownership.toUpperCase()) | translate }}</td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('FLEET.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.odometer_km | number: '1.0-0' }}</td>
              <td>{{ driverName(row) }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_VEHICLE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && vehicles().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_VEHICLES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'FLEET.EDIT_VEHICLE' : 'FLEET.NEW_VEHICLE') | translate" [nzFooter]="null" nzWidth="860px" (nzOnCancel)="modalVisible.set(false)">
      <ng-container *nzModalContent>
        <app-fleet-vehicle-form [vehicle]="editing()" (saved)="onSaved()"></app-fleet-vehicle-form>
      </ng-container>
    </nz-modal>
  `,
})
export class FleetVehiclesComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly statuses = FLEET_VEHICLE_STATUSES;
  readonly vehicles = signal<FleetVehicle[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly status = signal<FleetVehicleStatus | null>(null);
  readonly modalVisible = signal(false);
  readonly editing = signal<FleetVehicle | null>(null);

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: FleetVehicleStatus): string {
    return VEHICLE_STATUS_COLORS[status] ?? 'default';
  }

  driverName(vehicle: FleetVehicle): string {
    const assignment = vehicle.current_assignment;
    return assignment ? (assignment.employee?.full_name ?? assignment.driver_label ?? '') : '';
  }

  load(): void {
    this.loading.set(true);
    this.api.getVehicles({ search: this.search().trim() || undefined, status: this.status() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.vehicles.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
      },
    });
  }

  openModal(vehicle: FleetVehicle | null = null): void {
    this.editing.set(vehicle);
    this.modalVisible.set(true);
  }

  onSaved(): void {
    this.modalVisible.set(false);
    this.load();
  }

  remove(vehicle: FleetVehicle): void {
    this.api.deleteVehicle(vehicle.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.VEHICLE_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }
}
