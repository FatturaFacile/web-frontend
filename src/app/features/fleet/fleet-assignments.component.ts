import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { EmployeeResource, FleetApiService, FleetAssignment, FleetAssignmentRequest, FleetVehicle, HrApiService, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, loadEmployees, todayIso } from './fleet.util';

/** Vehicle to driver assignments with the odometer at handover and at return. The vehicle page embeds it for one vehicle. */
@Component({
  selector: 'app-fleet-assignments',
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
      <app-page-header [title]="'FLEET.ASSIGNMENTS_TITLE' | translate" [subtitle]="'FLEET.ASSIGNMENTS_SUBTITLE' | translate">
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      </app-page-header>
    } @else {
      <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button></div>
    }

    <nz-card class="main-card">
      <nz-table #table [nzData]="assignments()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            @if (!vehicleId()) {
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            }
            <th>{{ 'FLEET.DRIVER' | translate }}</th>
            <th>{{ 'FLEET.STARTS_ON' | translate }}</th>
            <th>{{ 'FLEET.ENDS_ON' | translate }}</th>
            <th class="num">{{ 'FLEET.START_ODOMETER_KM' | translate }}</th>
            <th class="num">{{ 'FLEET.END_ODOMETER_KM' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              @if (!vehicleId()) {
                <td>{{ row.vehicle?.license_plate }}</td>
              }
              <td>{{ row.employee?.full_name ?? row.driver_label }}</td>
              <td>{{ row.starts_on }}</td>
              <td>
                @if (row.is_open) {
                  <nz-tag nzColor="blue">{{ 'FLEET.OPEN' | translate }}</nz-tag>
                } @else {
                  {{ row.ends_on }}
                }
              </td>
              <td class="num">{{ row.start_odometer_km | number: '1.0-0' }}</td>
              <td class="num">{{ row.end_odometer_km !== null ? (row.end_odometer_km | number: '1.0-0') : '' }}</td>
              <td>
                <div class="row-actions">
                  @if (row.is_open) {
                    <button nz-button nzType="default" (click)="openEnd(row)">{{ 'FLEET.END_ASSIGNMENT' | translate }}</button>
                  }
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && assignments().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_ASSIGNMENTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'FLEET.EDIT_ASSIGNMENT' : 'FLEET.NEW_ASSIGNMENT') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FLEET.VEHICLE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="vehicle_id" nzShowSearch>
                  @for (vehicle of activeVehicles(); track vehicle.id) {
                    <nz-option [nzValue]="vehicle.id" [nzLabel]="vehicle.license_plate + ' - ' + vehicle.make + ' ' + vehicle.model"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label>{{ 'FLEET.EMPLOYEE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="employee_id" nzAllowClear nzShowSearch>
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="assignment-label">{{ 'FLEET.EXTERNAL_DRIVER' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="assignment-label" formControlName="driver_label" maxlength="120" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="assignment-start">{{ 'FLEET.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="assignment-start" type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="assignment-start-km">{{ 'FLEET.START_ODOMETER_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="assignment-start-km" type="number" min="0" formControlName="start_odometer_km" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="assignment-notes">{{ 'FLEET.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="assignment-notes" rows="2" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="endVisible" [nzTitle]="'FLEET.END_ASSIGNMENT' | translate" (nzOnCancel)="endVisible.set(false)" (nzOnOk)="saveEnd()" okAction="save" [nzOkDisabled]="endForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="endForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="assignment-end">{{ 'FLEET.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="assignment-end" type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="assignment-end-km">{{ 'FLEET.END_ODOMETER_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="assignment-end-km" type="number" min="0" formControlName="end_odometer_km" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FleetAssignmentsComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly hr = inject(HrApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** When set, the list is limited to this vehicle (vehicle page). */
  readonly vehicleId = input<string | null>(null);

  readonly assignments = signal<FleetAssignment[]>([]);
  readonly activeVehicles = signal<FleetVehicle[]>([]);
  readonly employees = signal<EmployeeResource[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly endVisible = signal(false);
  readonly editing = signal<FleetAssignment | null>(null);
  readonly ending = signal<FleetAssignment | null>(null);

  readonly form = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    employee_id: this.fb.control<string | null>(null),
    driver_label: [''],
    starts_on: [todayIso(), [Validators.required]],
    start_odometer_km: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  readonly endForm = this.fb.group({
    ends_on: [todayIso(), [Validators.required]],
    end_odometer_km: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    effect(() => {
      this.vehicleId();
      this.load();
    });
    // The odometer of the vehicle is the default reading at handover.
    this.form.controls.vehicle_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((vehicleId) => this.form.controls.start_odometer_km.setValue(this.odometerOf(vehicleId)));
  }

  ngOnInit(): void {
    this.api.getVehicles({ per_page: 100 }).subscribe((response) => this.activeVehicles.set(response.data.filter((vehicle) => vehicle.status === 'active' || vehicle.status === 'maintenance')));
    loadEmployees(this.hr).subscribe((employees) => this.employees.set(employees));
  }

  load(): void {
    this.loading.set(true);
    this.api.getAssignments({ vehicle_id: this.vehicleId() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.assignments.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
      },
    });
  }

  openModal(assignment: FleetAssignment | null = null): void {
    this.editing.set(assignment);
    this.form.reset({
      vehicle_id: assignment?.vehicle_id ?? this.vehicleId() ?? '',
      employee_id: assignment?.employee_id ?? null,
      driver_label: assignment?.driver_label ?? '',
      starts_on: assignment?.starts_on ?? todayIso(),
      start_odometer_km: assignment?.start_odometer_km ?? this.odometerOf(this.vehicleId()),
      notes: assignment?.notes ?? '',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: FleetAssignmentRequest = {
      employee_id: value.employee_id,
      driver_label: blankToNull(value.driver_label),
      starts_on: value.starts_on,
      start_odometer_km: value.start_odometer_km,
      notes: blankToNull(value.notes),
    };
    const current = this.editing();
    const request = current ? this.api.updateAssignment(current.id, payload) : this.api.createAssignment({ ...payload, vehicle_id: value.vehicle_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.ASSIGNMENT_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  openEnd(assignment: FleetAssignment): void {
    this.ending.set(assignment);
    this.endForm.reset({ ends_on: todayIso(), end_odometer_km: this.odometerOf(assignment.vehicle_id) || assignment.start_odometer_km });
    this.endVisible.set(true);
  }

  saveEnd(): void {
    const assignment = this.ending();
    if (!assignment) {
      return;
    }

    this.api.endAssignment(assignment.id, this.endForm.getRawValue()).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.ASSIGNMENT_ENDED'));
        this.endVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  remove(assignment: FleetAssignment): void {
    this.api.deleteAssignment(assignment.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  private odometerOf(vehicleId: string | null): number {
    return this.activeVehicles().find((vehicle) => vehicle.id === vehicleId)?.odometer_km ?? 0;
  }
}
