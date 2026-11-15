import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  FLEET_FUEL_TYPES,
  FLEET_OWNERSHIPS,
  FLEET_VEHICLE_STATUSES,
  FLEET_VEHICLE_TYPES,
  FleetApiService,
  FleetFuelType,
  FleetOwnership,
  FleetVehicle,
  FleetVehicleRequest,
  FleetVehicleStatus,
  FleetVehicleType,
  TranslateService,
} from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull } from './fleet.util';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Create or edit form of a vehicle, shared by the list (modal) and the detail page. */
@Component({
  selector: 'app-fleet-vehicle-form',
  styleUrl: './fleet.scss',
  imports: [ReactiveFormsModule, IconActionDirective, TranslatePipe, NzButtonModule, NzFormModule, NzInputModule, NzSelectModule],
  template: `
    <form nz-form [formGroup]="form" nzLayout="vertical">
      <div class="form-row">
        <nz-form-item>
          <nz-form-label nzRequired nzFor="vehicle-plate">{{ 'FLEET.LICENSE_PLATE' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-plate" formControlName="license_plate" maxlength="20" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="vehicle-vin">{{ 'FLEET.VIN' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-vin" formControlName="vin" maxlength="32" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="vehicle-make">{{ 'FLEET.MAKE' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-make" formControlName="make" maxlength="80" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzRequired nzFor="vehicle-model">{{ 'FLEET.MODEL' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-model" formControlName="model" maxlength="80" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="vehicle-year">{{ 'FLEET.MODEL_YEAR' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-year" type="number" min="1950" max="2100" formControlName="model_year" /></nz-form-control>
        </nz-form-item>
      </div>
      <div class="form-row">
        <nz-form-item>
          <nz-form-label>{{ 'FLEET.VEHICLE_TYPE' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="vehicle_type">
              @for (type of types; track type) {
                <nz-option [nzValue]="type" [nzLabel]="('FLEET.TYPE_' + type.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ 'FLEET.FUEL_TYPE' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="fuel_type">
              @for (fuel of fuels; track fuel) {
                <nz-option [nzValue]="fuel" [nzLabel]="('FLEET.FUEL_' + fuel.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ 'FLEET.STATUS' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="status">
              @for (status of statuses; track status) {
                <nz-option [nzValue]="status" [nzLabel]="('FLEET.STATUS_' + status.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label>{{ 'FLEET.OWNERSHIP' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select formControlName="ownership">
              @for (ownership of ownerships; track ownership) {
                <nz-option [nzValue]="ownership" [nzLabel]="('FLEET.OWNERSHIP_' + ownership.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
      </div>
      <div class="form-row">
        <nz-form-item>
          <nz-form-label nzRequired nzFor="vehicle-odometer">{{ (vehicle() ? 'FLEET.ODOMETER_KM' : 'FLEET.STARTING_ODOMETER_KM') | translate }}</nz-form-label>
          <nz-form-control [nzExtra]="vehicle() ? ('FLEET.ODOMETER_NEVER_DECREASES' | translate) : ''">
            <input nz-input id="vehicle-odometer" type="number" [min]="minimumOdometer()" formControlName="odometer_km" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="vehicle-acquired">{{ 'FLEET.ACQUIRED_ON' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-acquired" type="date" formControlName="acquired_on" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="vehicle-contract">{{ 'FLEET.CONTRACT_ENDS_ON' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-contract" type="date" formControlName="contract_ends_on" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="vehicle-value">{{ 'FLEET.PURCHASE_VALUE' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-value" type="number" min="0" step="any" formControlName="purchase_value" /></nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="vehicle-currency">{{ 'FLEET.CURRENCY' | translate }}</nz-form-label>
          <nz-form-control><input nz-input id="vehicle-currency" formControlName="currency" maxlength="3" /></nz-form-control>
        </nz-form-item>
      </div>
      <nz-form-item>
        <nz-form-label nzFor="vehicle-asset">{{ 'FLEET.ASSET_ID' | translate }}</nz-form-label>
        <nz-form-control><input nz-input id="vehicle-asset" formControlName="asset_id" /></nz-form-control>
      </nz-form-item>
      <nz-form-item>
        <nz-form-label nzFor="vehicle-notes">{{ 'FLEET.NOTES' | translate }}</nz-form-label>
        <nz-form-control><textarea nz-input id="vehicle-notes" rows="2" formControlName="notes"></textarea></nz-form-control>
      </nz-form-item>
      <button nz-button nzType="primary" type="button" appIconAction="save" [disabled]="form.invalid || saving()" (click)="save()"></button>
    </form>
  `,
})
export class FleetVehicleFormComponent {
  private readonly api = inject(FleetApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** The vehicle to edit; none creates a new one. */
  readonly vehicle = input<FleetVehicle | null>(null);
  readonly saved = output<FleetVehicle>();

  readonly types = FLEET_VEHICLE_TYPES;
  readonly fuels = FLEET_FUEL_TYPES;
  readonly statuses = FLEET_VEHICLE_STATUSES;
  readonly ownerships = FLEET_OWNERSHIPS;
  readonly saving = signal(false);
  readonly minimumOdometer = signal(0);

  readonly form = this.fb.group({
    license_plate: ['', [Validators.required, Validators.maxLength(20)]],
    vin: ['', [Validators.maxLength(32)]],
    make: ['', [Validators.required, Validators.maxLength(80)]],
    model: ['', [Validators.required, Validators.maxLength(80)]],
    model_year: this.fb.control<number | null>(null, [Validators.min(1950), Validators.max(2100)]),
    vehicle_type: ['car' as FleetVehicleType],
    fuel_type: ['diesel' as FleetFuelType],
    status: ['active' as FleetVehicleStatus],
    odometer_km: [0, [Validators.required, Validators.min(0), Validators.max(9999999)]],
    ownership: ['owned' as FleetOwnership],
    acquired_on: [''],
    contract_ends_on: [''],
    purchase_value: this.fb.control<number | null>(null, [Validators.min(0)]),
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    asset_id: ['', [Validators.pattern(UUID_PATTERN)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  constructor() {
    effect(() => {
      const vehicle = this.vehicle();
      this.minimumOdometer.set(vehicle?.odometer_km ?? 0);
      this.form.reset({
        license_plate: vehicle?.license_plate ?? '',
        vin: vehicle?.vin ?? '',
        make: vehicle?.make ?? '',
        model: vehicle?.model ?? '',
        model_year: vehicle?.model_year ?? null,
        vehicle_type: vehicle?.vehicle_type ?? 'car',
        fuel_type: vehicle?.fuel_type ?? 'diesel',
        status: vehicle?.status ?? 'active',
        odometer_km: vehicle?.odometer_km ?? 0,
        ownership: vehicle?.ownership ?? 'owned',
        acquired_on: vehicle?.acquired_on ?? '',
        contract_ends_on: vehicle?.contract_ends_on ?? '',
        purchase_value: vehicle?.purchase_value !== null && vehicle?.purchase_value !== undefined ? Number(vehicle.purchase_value) : null,
        currency: vehicle?.currency ?? 'EUR',
        asset_id: vehicle?.asset_id ?? '',
        notes: vehicle?.notes ?? '',
      });
    });
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: FleetVehicleRequest = {
      license_plate: value.license_plate,
      vin: blankToNull(value.vin),
      make: value.make,
      model: value.model,
      model_year: value.model_year,
      vehicle_type: value.vehicle_type,
      fuel_type: value.fuel_type,
      status: value.status,
      odometer_km: value.odometer_km,
      ownership: value.ownership,
      acquired_on: blankToNull(value.acquired_on),
      contract_ends_on: blankToNull(value.contract_ends_on),
      purchase_value: decimalOrNull(value.purchase_value),
      currency: value.currency.toUpperCase(),
      asset_id: blankToNull(value.asset_id),
      notes: blankToNull(value.notes),
    };
    const current = this.vehicle();
    const request = current ? this.api.updateVehicle(current.id, payload) : this.api.createVehicle(payload);

    this.saving.set(true);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.message.success(this.translate.instant('FLEET.VEHICLE_SAVED'));
        this.saved.emit(response.data);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('FLEET.ACTION_ERROR'));
      },
    });
  }
}
