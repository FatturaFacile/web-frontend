import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, OnInit, signal } from '@angular/core';
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
import {
  EmployeeResource,
  FleetApiService,
  FleetEnergyUnit,
  fleetEnergyUnitsFor,
  FleetFuelEntry,
  FleetFuelEntryRequest,
  FleetVehicle,
  HrApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, loadEmployees, todayIso } from './fleet.util';

/** Fuel and charging entries with the consumption per 100 km and the cost per km computed by the API. */
@Component({
  selector: 'app-fleet-fuel',
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
  ],
  template: `
    @if (!vehicleId()) {
      <app-page-header [title]="'FLEET.FUEL_TITLE' | translate" [subtitle]="'FLEET.FUEL_SUBTITLE' | translate">
        <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
      </app-page-header>
    } @else {
      <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button></div>
    }

    <nz-card class="main-card">
      <nz-table #table [nzData]="entries()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'FLEET.DATE' | translate }}</th>
            @if (!vehicleId()) {
              <th>{{ 'FLEET.VEHICLE' | translate }}</th>
            }
            <th class="num">{{ 'FLEET.QUANTITY' | translate }}</th>
            <th class="num">{{ 'FLEET.UNIT_PRICE' | translate }}</th>
            <th class="num">{{ 'FLEET.TOTAL_COST' | translate }}</th>
            <th class="num">{{ 'FLEET.ODOMETER_KM' | translate }}</th>
            <th class="num">{{ 'FLEET.DISTANCE_KM' | translate }}</th>
            <th class="num">{{ 'FLEET.CONSUMPTION_PER_100KM' | translate }}</th>
            <th class="num">{{ 'FLEET.COST_PER_KM' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.entry_date }}</td>
              @if (!vehicleId()) {
                <td>{{ row.vehicle?.license_plate }}</td>
              }
              <td class="num">{{ row.quantity | number: '1.0-3' }} {{ ('FLEET.UNIT_' + row.energy_unit.toUpperCase()) | translate }}</td>
              <td class="num">{{ row.unit_price !== null ? (row.unit_price | number: '1.2-4') : '' }}</td>
              <td class="num">{{ row.total_cost | number: '1.2-2' }} {{ row.currency }}</td>
              <td class="num">{{ row.odometer_km | number: '1.0-0' }}</td>
              <td class="num">{{ row.distance_km !== null ? (row.distance_km | number: '1.0-0') : '' }}</td>
              <td class="num">{{ row.consumption_per_100km !== null ? (row.consumption_per_100km | number: '1.1-2') : '' }}</td>
              <td class="num">{{ row.cost_per_km !== null ? (row.cost_per_km | number: '1.3-4') : '' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" appIconAction="edit" (click)="openModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FLEET.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && entries().length === 0) {
        <nz-empty [nzNotFoundContent]="'FLEET.NO_FUEL' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'FLEET.EDIT_FUEL' : 'FLEET.NEW_FUEL') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
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
              <nz-form-label nzRequired nzFor="fuel-date">{{ 'FLEET.DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fuel-date" type="date" formControlName="entry_date" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="fuel-odometer">{{ 'FLEET.ODOMETER_KM' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fuel-odometer" type="number" min="0" formControlName="odometer_km" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FLEET.ENERGY_UNIT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="energy_unit">
                  @for (unit of units(); track unit) {
                    <nz-option [nzValue]="unit" [nzLabel]="('FLEET.UNIT_' + unit.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="fuel-quantity">{{ 'FLEET.QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fuel-quantity" type="number" min="0" step="any" formControlName="quantity" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="fuel-price">{{ 'FLEET.UNIT_PRICE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fuel-price" type="number" min="0" step="any" formControlName="unit_price" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="fuel-total">{{ 'FLEET.TOTAL_COST' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'FLEET.PRICE_OR_TOTAL_HINT' | translate"><input nz-input id="fuel-total" type="number" min="0" step="any" formControlName="total_cost" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control><label nz-checkbox formControlName="is_full_tank">{{ 'FLEET.FULL_TANK' | translate }}</label></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="fuel-station">{{ 'FLEET.STATION' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="fuel-station" formControlName="station" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FLEET.DRIVER' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="employee_id" nzAllowClear nzShowSearch>
                  @for (employee of employees(); track employee.id) {
                    <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
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
export class FleetFuelComponent implements OnInit {
  private readonly api = inject(FleetApiService);
  private readonly hr = inject(HrApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** When set, the list is limited to this vehicle (vehicle page). */
  readonly vehicleId = input<string | null>(null);

  readonly entries = signal<FleetFuelEntry[]>([]);
  readonly vehicles = signal<FleetVehicle[]>([]);
  readonly employees = signal<EmployeeResource[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly editing = signal<FleetFuelEntry | null>(null);
  private readonly selectedVehicleId = signal('');

  /** Units the fuel type of the chosen vehicle is bought in. */
  readonly units = computed<readonly FleetEnergyUnit[]>(() => {
    const vehicle = this.vehicles().find((candidate) => candidate.id === (this.editing()?.vehicle_id ?? this.selectedVehicleId()));
    return vehicle ? fleetEnergyUnitsFor(vehicle.fuel_type) : ['liter', 'kwh', 'kg'];
  });

  readonly form = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    entry_date: [todayIso(), [Validators.required]],
    energy_unit: ['liter' as FleetEnergyUnit, [Validators.required]],
    quantity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.001)]),
    unit_price: this.fb.control<number | null>(null, [Validators.min(0)]),
    total_cost: this.fb.control<number | null>(null, [Validators.min(0)]),
    odometer_km: [0, [Validators.required, Validators.min(0)]],
    is_full_tank: [true],
    station: [''],
    employee_id: this.fb.control<string | null>(null),
  });

  constructor() {
    effect(() => {
      this.vehicleId();
      this.load();
    });
    this.form.controls.vehicle_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.selectedVehicleId.set(id);
      const vehicle = this.vehicles().find((candidate) => candidate.id === id);
      if (vehicle) {
        this.form.controls.odometer_km.setValue(vehicle.odometer_km);
        this.form.controls.energy_unit.setValue(fleetEnergyUnitsFor(vehicle.fuel_type)[0]);
      }
    });
  }

  ngOnInit(): void {
    this.api.getVehicles({ per_page: 100 }).subscribe((response) => this.vehicles.set(response.data.filter((vehicle) => vehicle.status === 'active' || vehicle.status === 'maintenance')));
    loadEmployees(this.hr).subscribe((employees) => this.employees.set(employees));
  }

  load(): void {
    this.loading.set(true);
    this.api.getFuelEntries({ vehicle_id: this.vehicleId() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.entries.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('FLEET.ACTION_ERROR'));
      },
    });
  }

  openModal(entry: FleetFuelEntry | null = null): void {
    this.editing.set(entry);
    this.form.reset({
      vehicle_id: entry?.vehicle_id ?? this.vehicleId() ?? '',
      entry_date: entry?.entry_date ?? todayIso(),
      energy_unit: entry?.energy_unit ?? 'liter',
      quantity: entry ? Number(entry.quantity) : null,
      unit_price: entry?.unit_price ? Number(entry.unit_price) : null,
      total_cost: entry ? Number(entry.total_cost) : null,
      odometer_km: entry?.odometer_km ?? 0,
      is_full_tank: entry?.is_full_tank ?? true,
      station: entry?.station ?? '',
      employee_id: entry?.employee_id ?? null,
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: FleetFuelEntryRequest = {
      entry_date: value.entry_date,
      energy_unit: value.energy_unit,
      quantity: String(value.quantity),
      unit_price: decimalOrNull(value.unit_price),
      total_cost: decimalOrNull(value.total_cost),
      odometer_km: value.odometer_km,
      is_full_tank: value.is_full_tank,
      station: blankToNull(value.station),
      employee_id: value.employee_id,
    };
    const current = this.editing();
    if (current && value.total_cost === Number(current.total_cost)) {
      // The total follows the quantity and the price unless the user typed a new one.
      payload.total_cost = null;
    }

    const request = current ? this.api.updateFuelEntry(current.id, payload) : this.api.createFuelEntry({ ...payload, vehicle_id: value.vehicle_id });

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.FUEL_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }

  remove(entry: FleetFuelEntry): void {
    this.api.deleteFuelEntry(entry.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FLEET.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR')),
    });
  }
}
