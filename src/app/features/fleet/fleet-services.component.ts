import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FLEET_SERVICE_TYPES,
  FleetApiService,
  FleetScheduledService,
  FleetScheduledServiceRequest,
  FleetServiceRecord,
  FleetServiceRecordRequest,
  FleetServiceType,
  FleetVehicle,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, todayIso } from './fleet.util';

/** Scheduled services (due by date or kilometres, overdue detection) and the service records that complete them. */
@Component({
  selector: 'app-fleet-services',
  styleUrl: './fleet.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @if (!vehicleId()) {
      <app-page-header [title]="'FLEET.SERVICES_TITLE' | translate" [subtitle]="'FLEET.SERVICES_SUBTITLE' | translate">
        <button nz-button nzType="primary" (click)="openRecordModal()" appIconAction="create"></button>
      </app-page-header>
    } @else {
      <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openRecordModal()" appIconAction="create"></button></div>
    }

    <nz-card class="main-card" [nzTitle]="'FLEET.SCHEDULED_SERVICES' | translate" [nzExtra]="scheduleExtra">
      <ng-template #scheduleExtra>
        <button nz-button nzType="default" (click)="openScheduleModal()">{{ 'FLEET.NEW_SCHEDULE' | translate }}</button>
      </ng-template>
      <nz-table #scheduleTable [nzData]="schedules()" [nzLoading]="loadingSchedules()" nzSize="small" [nzPageSize]="10">
        <thead>
          <tr>
            @if (!vehicleId()) {
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            }
            <th>{{ 'FLEET.NAME' | translate }}</th>
            <th>{{ 'FLEET.NEXT_DUE_ON' | translate }}</th>
            <th class="num">{{ 'FLEET.NEXT_DUE_KM' | translate }}</th>
            <th>{{ 'FLEET.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of scheduleTable.data; track row.id) {
            <tr>
              @if (!vehicleId()) {
                <td>{{ row.vehicle?.license_plate }}</td>
              }
              <td>{{ row.name }}</td>
              <td [class.row-overdue]="row.days_to_due !== null && row.days_to_due < 0">{{ row.next_due_on }}</td>
              <td class="num" [class.row-overdue]="row.km_to_due !== null && row.km_to_due <= 0">{{ row.next_due_km !== null ? (row.next_due_km | number: '1.0-0') : '' }}</td>
              <td>
                @if (!row.is_active) {
                  <nz-tag>{{ 'FLEET.INACTIVE' | translate }}</nz-tag>
                } @else if (row.is_overdue) {
                  <nz-tag nzColor="red">{{ 'FLEET.OVERDUE' | translate }}</nz-tag>
                } @else {
                  <nz-tag nzColor="green">{{ 'FLEET.ON_SCHEDULE' | translate }}</nz-tag>
                }
              </td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openScheduleModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeSchedule(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loadingSchedules() && schedules().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_SCHEDULES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'FLEET.SERVICE_RECORDS' | translate">
      <nz-table #recordTable [nzData]="records()" [nzLoading]="loadingRecords()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'FLEET.DATE' | translate }}</th>
            @if (!vehicleId()) {
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            }
            <th>{{ 'FLEET.SERVICE_TYPE' | translate }}</th>
            <th>{{ 'FLEET.DESCRIPTION' | translate }}</th>
            <th>{{ 'FLEET.VENDOR' | translate }}</th>
            <th class="num">{{ 'FLEET.ODOMETER_KM' | translate }}</th>
            <th class="num">{{ 'FLEET.COST' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of recordTable.data; track row.id) {
            <tr>
              <td>{{ row.service_date }}</td>
              @if (!vehicleId()) {
                <td>{{ row.vehicle?.license_plate }}</td>
              }
              <td>{{ ('FLEET.SERVICE_' + row.service_type.toUpperCase()) | translate }}</td>
              <td>{{ row.description }}</td>
              <td>{{ row.vendor }}</td>
              <td class="num">{{ row.odometer_km | number: '1.0-0' }}</td>
              <td class="num">{{ row.cost | number: '1.2-2' }} {{ row.currency }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openRecordModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeRecord(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loadingRecords() && records().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_SERVICES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="recordVisible" [nzTitle]="(editingRecord() ? 'FLEET.EDIT_SERVICE' : 'FLEET.NEW_SERVICE') | translate" (nzOnCancel)="recordVisible.set(false)" (nzOnOk)="saveRecord()" okAction="save" [nzOkDisabled]="recordForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="recordForm" nzLayout="vertical">
          @if (!editingRecord()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FLEET.VEHICLE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="vehicle_id" nzShowSearch>
                  @for (vehicle of vehicles(); track vehicle.id) {
                    <nz-option [nzValue]="vehicle.id" [nzLabel]="vehicle.license_plate + ' - ' + vehicle.make + ' ' + vehicle.model"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="service-date">{{ 'FLEET.DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="service-date" type="date" formControlName="service_date" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="service-odometer">{{ 'FLEET.ODOMETER_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="service-odometer" type="number" min="0" formControlName="odometer_km" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FLEET.SERVICE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="service_type">
                  @for (type of serviceTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('FLEET.SERVICE_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="service-description">{{ 'FLEET.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="service-description" formControlName="description" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="service-vendor">{{ 'FLEET.VENDOR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="service-vendor" formControlName="vendor" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="service-cost">{{ 'FLEET.COST' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="service-cost" type="number" min="0" step="any" formControlName="cost" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="service-reference">{{ 'FLEET.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="service-reference" formControlName="reference" maxlength="80" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'FLEET.COMPLETES_SCHEDULE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="scheduled_service_id" nzAllowClear>
                @for (schedule of schedulesOfSelectedVehicle(); track schedule.id) {
                  <nz-option [nzValue]="schedule.id" [nzLabel]="schedule.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="scheduleVisible" [nzTitle]="(editingSchedule() ? 'FLEET.EDIT_SCHEDULE' : 'FLEET.NEW_SCHEDULE') | translate" (nzOnCancel)="scheduleVisible.set(false)" (nzOnOk)="saveSchedule()" okAction="save" [nzOkDisabled]="scheduleForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="scheduleForm" nzLayout="vertical">
          @if (!editingSchedule()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FLEET.VEHICLE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="vehicle_id" nzShowSearch>
                  @for (vehicle of vehicles(); track vehicle.id) {
                    <nz-option [nzValue]="vehicle.id" [nzLabel]="vehicle.license_plate + ' - ' + vehicle.make + ' ' + vehicle.model"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="schedule-name">{{ 'FLEET.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="schedule-name" formControlName="name" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FLEET.SERVICE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="service_type">
                  @for (type of serviceTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('FLEET.SERVICE_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="schedule-interval-days">{{ 'FLEET.INTERVAL_DAYS' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="schedule-interval-days" type="number" min="1" formControlName="interval_days" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="schedule-interval-km">{{ 'FLEET.INTERVAL_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="schedule-interval-km" type="number" min="1" formControlName="interval_km" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="schedule-next-on">{{ 'FLEET.NEXT_DUE_ON' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'FLEET.DUE_COMPUTED_HINT' | translate"><input nz-input id="schedule-next-on" type="date" formControlName="next_due_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="schedule-next-km">{{ 'FLEET.NEXT_DUE_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="schedule-next-km" type="number" min="0" formControlName="next_due_km" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control><label for="fleet-services-is-active" nzId="fleet-services-is-active" nz-checkbox formControlName="is_active">{{ 'FLEET.ACTIVE' | translate }}</label></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FleetServicesComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** When set, the lists are limited to this vehicle (vehicle page). */
  readonly vehicleId = input<string | null>(null);

  readonly serviceTypes = FLEET_SERVICE_TYPES;
  readonly records = signal<FleetServiceRecord[]>([]);
  readonly schedules = signal<FleetScheduledService[]>([]);
  readonly vehicles = signal<FleetVehicle[]>([]);
  readonly loadingRecords = signal(false);
  readonly loadingSchedules = signal(false);
  readonly recordVisible = signal(false);
  readonly scheduleVisible = signal(false);
  readonly editingRecord = signal<FleetServiceRecord | null>(null);
  readonly editingSchedule = signal<FleetScheduledService | null>(null);
  readonly schedulesOfSelectedVehicle = signal<FleetScheduledService[]>([]);

  readonly recordForm = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    scheduled_service_id: this.fb.control<string | null>(null),
    service_type: ['maintenance' as FleetServiceType],
    service_date: [todayIso(), [Validators.required]],
    odometer_km: [0, [Validators.required, Validators.min(0)]],
    vendor: [''],
    description: ['', [Validators.required, Validators.maxLength(255)]],
    reference: [''],
    cost: this.fb.control<number | null>(null, [Validators.min(0)]),
  });

  readonly scheduleForm = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    service_type: ['maintenance' as FleetServiceType],
    interval_days: this.fb.control<number | null>(null, [Validators.min(1)]),
    interval_km: this.fb.control<number | null>(null, [Validators.min(1)]),
    next_due_on: [''],
    next_due_km: this.fb.control<number | null>(null, [Validators.min(0)]),
    is_active: [true],
  });

  constructor() {
    effect(() => {
      this.vehicleId();
      this.load();
    });
    this.recordForm.controls.vehicle_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.schedulesOfSelectedVehicle.set(this.schedules().filter((schedule) => schedule.vehicle_id === id && schedule.is_active));
      const vehicle = this.vehicles().find((candidate) => candidate.id === id);
      if (vehicle && !this.editingRecord()) {
        this.recordForm.controls.odometer_km.setValue(vehicle.odometer_km);
      }
    });
  }

  ngOnInit(): void {
    this.api.getVehicles({ per_page: 100 }).subscribe((response) => this.vehicles.set(response.data));
  }

  load(): void {
    this.loadingRecords.set(true);
    this.loadingSchedules.set(true);
    const vehicle_id = this.vehicleId() ?? undefined;

    this.api.getServices({ vehicle_id, per_page: 100 }).subscribe({
      next: (response) => {
        this.records.set(response.data);
        this.loadingRecords.set(false);
      },
      error: () => {
        this.loadingRecords.set(false);
        this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
      },
    });
    this.api.getScheduledServices({ vehicle_id, per_page: 100 }).subscribe({
      next: (response) => {
        this.schedules.set(response.data);
        this.loadingSchedules.set(false);
      },
      error: () => {
        this.loadingSchedules.set(false);
        this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
      },
    });
  }

  openRecordModal(record: FleetServiceRecord | null = null): void {
    this.editingRecord.set(record);
    this.recordForm.reset({
      vehicle_id: record?.vehicle_id ?? this.vehicleId() ?? '',
      scheduled_service_id: record?.scheduled_service_id ?? null,
      service_type: record?.service_type ?? 'maintenance',
      service_date: record?.service_date ?? todayIso(),
      odometer_km: record?.odometer_km ?? this.vehicles().find((vehicle) => vehicle.id === this.vehicleId())?.odometer_km ?? 0,
      vendor: record?.vendor ?? '',
      description: record?.description ?? '',
      reference: record?.reference ?? '',
      cost: record ? Number(record.cost) : null,
    });
    this.recordVisible.set(true);
  }

  saveRecord(): void {
    const value = this.recordForm.getRawValue();
    const payload: FleetServiceRecordRequest = {
      scheduled_service_id: value.scheduled_service_id,
      service_type: value.service_type,
      service_date: value.service_date,
      odometer_km: value.odometer_km,
      vendor: blankToNull(value.vendor),
      description: value.description,
      reference: blankToNull(value.reference),
      cost: decimalOrNull(value.cost) ?? '0',
    };
    const current = this.editingRecord();
    const request = current ? this.api.updateService(current.id, payload) : this.api.createService({ ...payload, vehicle_id: value.vehicle_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.SERVICE_SAVED'));
        this.recordVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  removeRecord(record: FleetServiceRecord): void {
    this.run(this.api.deleteService(record.id), 'FLEET.DELETED');
  }

  openScheduleModal(schedule: FleetScheduledService | null = null): void {
    this.editingSchedule.set(schedule);
    this.scheduleForm.reset({
      vehicle_id: schedule?.vehicle_id ?? this.vehicleId() ?? '',
      name: schedule?.name ?? '',
      service_type: schedule?.service_type ?? 'maintenance',
      interval_days: schedule?.interval_days ?? null,
      interval_km: schedule?.interval_km ?? null,
      next_due_on: schedule?.next_due_on ?? '',
      next_due_km: schedule?.next_due_km ?? null,
      is_active: schedule?.is_active ?? true,
    });
    this.scheduleVisible.set(true);
  }

  saveSchedule(): void {
    const value = this.scheduleForm.getRawValue();
    const payload: FleetScheduledServiceRequest = {
      name: value.name,
      service_type: value.service_type,
      interval_days: value.interval_days,
      interval_km: value.interval_km,
      next_due_on: blankToNull(value.next_due_on),
      next_due_km: value.next_due_km,
      is_active: value.is_active,
    };
    const current = this.editingSchedule();
    const request = current ? this.api.updateScheduledService(current.id, payload) : this.api.createScheduledService({ ...payload, vehicle_id: value.vehicle_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.SCHEDULE_SAVED'));
        this.scheduleVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  removeSchedule(schedule: FleetScheduledService): void {
    this.run(this.api.deleteScheduledService(schedule.id), 'FLEET.DELETED');
  }

  private run(request: ReturnType<FleetApiService['deleteService']>, successKey: string): void {
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant(successKey));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }
}
