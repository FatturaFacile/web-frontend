import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import {
  EmployeeResource,
  FLEET_INCIDENT_KINDS,
  FLEET_PAYMENT_STATUSES,
  FleetApiService,
  FleetIncident,
  FleetIncidentKind,
  FleetIncidentRequest,
  FleetPaymentStatus,
  FleetVehicle,
  HrApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, loadEmployees, PAYMENT_STATUS_COLORS, todayIso } from './fleet.util';

/** Traffic fines, accidents and damages with the driver attribution and the payment status. */
@Component({
  selector: 'app-fleet-fines',
  styleUrl: './fleet.scss',
  imports: [
    DecimalPipe,
    FormsModule,
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
      <app-page-header [title]="'FLEET.FINES_TITLE' | translate" [subtitle]="'FLEET.FINES_SUBTITLE' | translate">
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      </app-page-header>
    }

    <div class="toolbar">
      <nz-select style="width: 180px" nzAllowClear [ngModel]="kind()" (ngModelChange)="kind.set($event); load()" [nzPlaceHolder]="'FLEET.INCIDENT_KIND' | translate">
        @for (value of kinds; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('FLEET.KIND_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 180px" nzAllowClear [ngModel]="paymentStatus()" (ngModelChange)="paymentStatus.set($event); load()" [nzPlaceHolder]="'FLEET.PAYMENT_STATUS' | translate">
        @for (value of paymentStatuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('FLEET.PAYMENT_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <span class="spacer"></span>
      @if (vehicleId()) {
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      }
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="incidents()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'FLEET.DATE' | translate }}</th>
            @if (!vehicleId()) {
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            }
            <th>{{ 'FLEET.INCIDENT_KIND' | translate }}</th>
            <th>{{ 'FLEET.DESCRIPTION' | translate }}</th>
            <th>{{ 'FLEET.DRIVER' | translate }}</th>
            <th class="num">{{ 'FLEET.AMOUNT' | translate }}</th>
            <th>{{ 'FLEET.PAYMENT_STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.occurred_on }}</td>
              @if (!vehicleId()) {
                <td>{{ row.vehicle?.license_plate }}</td>
              }
              <td>{{ ('FLEET.KIND_' + row.kind.toUpperCase()) | translate }}</td>
              <td>{{ row.description }}</td>
              <td>{{ row.employee?.full_name }}</td>
              <td class="num">{{ row.amount | number: '1.2-2' }} {{ row.currency }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.payment_status)">{{ ('FLEET.PAYMENT_' + row.payment_status.toUpperCase()) | translate }}</nz-tag>
                @if (row.is_overdue) {
                  <nz-tag nzColor="red">{{ 'FLEET.OVERDUE' | translate }}</nz-tag>
                }
              </td>
              <td>
                <div class="row-actions">
                  @if (row.payment_status === 'unpaid' || row.payment_status === 'contested') {
                    <button nz-button nzType="default" (click)="pay(row)">{{ 'FLEET.MARK_PAID' | translate }}</button>
                  }
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && incidents().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_FINES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'FLEET.EDIT_FINE' : 'FLEET.NEW_FINE') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
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
              <nz-form-label>{{ 'FLEET.INCIDENT_KIND' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="kind">
                  @for (value of kinds; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FLEET.KIND_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="fine-date">{{ 'FLEET.DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fine-date" type="date" formControlName="occurred_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="fine-due">{{ 'FLEET.DUE_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fine-due" type="date" formControlName="due_on" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="fine-description">{{ 'FLEET.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="fine-description" formControlName="description" maxlength="255" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="fine-reference">{{ 'FLEET.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fine-reference" formControlName="reference" maxlength="80" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="fine-location">{{ 'FLEET.LOCATION' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fine-location" formControlName="location" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="fine-amount">{{ 'FLEET.AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fine-amount" type="number" min="0" step="any" formControlName="amount" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FLEET.DRIVER' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'FLEET.DRIVER_AUTO_HINT' | translate">
                <nz-select formControlName="employee_id" nzAllowClear nzShowSearch>
                  @for (employee of employees(); track employee.id) {
                    <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FLEET.PAYMENT_STATUS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="payment_status">
                  @for (value of paymentStatuses; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FLEET.PAYMENT_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class FleetFinesComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly hr = inject(HrApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** When set, the list is limited to this vehicle (vehicle page). */
  readonly vehicleId = input<string | null>(null);

  readonly kinds = FLEET_INCIDENT_KINDS;
  readonly paymentStatuses = FLEET_PAYMENT_STATUSES;
  readonly incidents = signal<FleetIncident[]>([]);
  readonly vehicles = signal<FleetVehicle[]>([]);
  readonly employees = signal<EmployeeResource[]>([]);
  readonly loading = signal(false);
  readonly kind = signal<FleetIncidentKind | null>(null);
  readonly paymentStatus = signal<FleetPaymentStatus | null>(null);
  readonly modalVisible = signal(false);
  readonly editing = signal<FleetIncident | null>(null);

  readonly form = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    kind: ['fine' as FleetIncidentKind],
    occurred_on: [todayIso(), [Validators.required]],
    due_on: [''],
    description: ['', [Validators.required, Validators.maxLength(255)]],
    reference: [''],
    location: [''],
    amount: this.fb.control<number | null>(null, [Validators.min(0)]),
    employee_id: this.fb.control<string | null>(null),
    payment_status: ['unpaid' as FleetPaymentStatus],
  });

  constructor() {
    effect(() => {
      this.vehicleId();
      this.load();
    });
  }

  ngOnInit(): void {
    this.api.getVehicles({ per_page: 100 }).subscribe((response) => this.vehicles.set(response.data));
    loadEmployees(this.hr).subscribe((employees) => this.employees.set(employees));
  }

  statusColor(status: FleetPaymentStatus): string {
    return PAYMENT_STATUS_COLORS[status] ?? 'default';
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getIncidents({ vehicle_id: this.vehicleId() ?? undefined, kind: this.kind() ?? undefined, payment_status: this.paymentStatus() ?? undefined, per_page: 100 })
      .subscribe({
        next: (response) => {
          this.incidents.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
        },
      });
  }

  openModal(incident: FleetIncident | null = null): void {
    this.editing.set(incident);
    this.form.reset({
      vehicle_id: incident?.vehicle_id ?? this.vehicleId() ?? '',
      kind: incident?.kind ?? 'fine',
      occurred_on: incident?.occurred_on ?? todayIso(),
      due_on: incident?.due_on ?? '',
      description: incident?.description ?? '',
      reference: incident?.reference ?? '',
      location: incident?.location ?? '',
      amount: incident ? Number(incident.amount) : null,
      employee_id: incident?.employee_id ?? null,
      payment_status: incident?.payment_status ?? 'unpaid',
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: FleetIncidentRequest = {
      employee_id: value.employee_id,
      kind: value.kind,
      occurred_on: value.occurred_on,
      reference: blankToNull(value.reference),
      description: value.description,
      location: blankToNull(value.location),
      amount: decimalOrNull(value.amount) ?? '0',
      payment_status: value.payment_status,
      due_on: blankToNull(value.due_on),
    };
    const current = this.editing();
    const request = current ? this.api.updateIncident(current.id, payload) : this.api.createIncident({ ...payload, vehicle_id: value.vehicle_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.FINE_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  pay(incident: FleetIncident): void {
    this.api.payIncident(incident.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.FINE_PAID'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  remove(incident: FleetIncident): void {
    this.api.deleteIncident(incident.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }
}
