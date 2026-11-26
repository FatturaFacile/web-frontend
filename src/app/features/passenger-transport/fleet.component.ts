import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  PTR_VEHICLE_CATEGORIES,
  PtrVehicle,
  PtrVehicleCategory,
  PtrVehiclePayload,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { FleetStore } from './fleet.store';
import { PASSENGER_TRANSPORT_MODULE, PtrOutcome, toNumber } from './passenger-transport.util';

/** The passenger fleet: plates, category, capacity, digital tachograph, PSVA and the NCC authorisation of the municipality. */
@Component({
  selector: 'app-ptr-fleet',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [FleetStore],
  styleUrl: './passenger-transport.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.PASSENGER_TRANSPORT_FLEET' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="ptr-v-q">
        <span>{{ 'passengerTransport.field.search' | translate }}</span>
        <input nz-input id="ptr-v-q" [ngModel]="query()" (ngModelChange)="onSearch($event)" />
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'passengerTransport.action.newVehicle' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          failure.errorKey ?? 'passengerTransport.error.generic' | translate: failure.params
        "
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.vehicles()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '900px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'passengerTransport.field.licensePlate' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.vehicleCategory' | translate }}</th>
            <th scope="col" class="num">{{ 'passengerTransport.field.capacity' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.nccAuthorization' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.equipment' | translate }}</th>
            <th scope="col" class="num">{{ 'passengerTransport.field.odometer' | translate }}</th>
            <th scope="col">{{ 'passengerTransport.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (vehicle of table.data; track vehicle.id) {
            <tr>
              <th scope="row">
                {{ vehicle.license_plate }}
                @if (!vehicle.active) {
                  <nz-tag>{{ 'passengerTransport.field.inactive' | translate }}</nz-tag>
                }
              </th>
              <td>
                {{ 'passengerTransport.vehicleCategory.' + vehicle.vehicle_category | translate }}
              </td>
              <td class="num">{{ vehicle.passenger_capacity }}</td>
              <td>
                {{ vehicle.ncc_authorization_number ?? '—' }}
                @if (vehicle.ncc_issuing_municipality) {
                  <small class="muted">{{ vehicle.ncc_issuing_municipality }}</small>
                }
              </td>
              <td>
                @if (vehicle.has_digital_tachograph) {
                  <nz-tag nzColor="blue">{{
                    'passengerTransport.field.digitalTachograph' | translate
                  }}</nz-tag>
                }
                @if (vehicle.psva_subject) {
                  <nz-tag nzColor="purple">PSVA</nz-tag>
                }
              </td>
              <td class="num">{{ vehicle.odometer_km }}</td>
              <td class="row-actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(vehicle)">
                    {{ 'passengerTransport.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'passengerTransport.confirm.deleteVehicle' | translate"
                    [nzOkText]="'passengerTransport.action.confirm' | translate"
                    [nzCancelText]="'passengerTransport.action.cancel' | translate"
                    (nzOnConfirm)="remove(vehicle)"
                  >
                    {{ 'passengerTransport.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">
                <nz-empty
                  [nzNotFoundContent]="'passengerTransport.empty.vehicles' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="520"
      [nzTitle]="'passengerTransport.section.vehicle' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'passengerTransport.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="ptr-v-plate">
            <span>{{ 'passengerTransport.field.licensePlate' | translate }}</span>
            <input nz-input id="ptr-v-plate" formControlName="license_plate" maxlength="20" />
          </label>
          <label class="field" for="ptr-v-category">
            <span>{{ 'passengerTransport.field.vehicleCategory' | translate }}</span>
            <nz-select nzId="ptr-v-category" formControlName="vehicle_category">
              @for (category of categories; track category) {
                <nz-option
                  [nzValue]="category"
                  [nzLabel]="'passengerTransport.vehicleCategory.' + category | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="ptr-v-capacity">
            <span>{{ 'passengerTransport.field.capacity' | translate }}</span>
            <nz-input-number
              nzId="ptr-v-capacity"
              formControlName="passenger_capacity"
              [nzMin]="1"
              [nzMax]="100"
            ></nz-input-number>
          </label>
          <label class="field" for="ptr-v-weight">
            <span>{{ 'passengerTransport.field.grossWeight' | translate }}</span>
            <nz-input-number
              nzId="ptr-v-weight"
              formControlName="gross_weight_tons"
              [nzMin]="0"
              [nzStep]="0.5"
            ></nz-input-number>
          </label>
          <label class="field" for="ptr-v-odo">
            <span>{{ 'passengerTransport.field.odometer' | translate }}</span>
            <nz-input-number
              nzId="ptr-v-odo"
              formControlName="odometer_km"
              [nzMin]="0"
            ></nz-input-number>
          </label>
          <label class="field" for="ptr-v-ncc">
            <span>{{ 'passengerTransport.field.nccAuthorization' | translate }}</span>
            <input
              nz-input
              id="ptr-v-ncc"
              formControlName="ncc_authorization_number"
              maxlength="60"
            />
          </label>
          <label class="field" for="ptr-v-municipality">
            <span>{{ 'passengerTransport.field.issuingMunicipality' | translate }}</span>
            <input
              nz-input
              id="ptr-v-municipality"
              formControlName="ncc_issuing_municipality"
              maxlength="120"
            />
          </label>
          <label
            nz-checkbox
            for="ptr-cb-1"
            nzId="ptr-cb-1"
            formControlName="has_digital_tachograph"
            >{{ 'passengerTransport.field.digitalTachograph' | translate }}</label
          >
          <label nz-checkbox for="ptr-cb-2" nzId="ptr-cb-2" formControlName="psva_subject"
            >PSVA</label
          >
          <label nz-checkbox for="ptr-cb-3" nzId="ptr-cb-3" formControlName="active">{{
            'passengerTransport.field.active' | translate
          }}</label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="form.invalid"
            >
              {{ 'passengerTransport.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="close()">
              {{ 'passengerTransport.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class FleetComponent implements OnInit {
  protected readonly store = inject(FleetStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(PASSENGER_TRANSPORT_MODULE);
  protected readonly categories = PTR_VEHICLE_CATEGORIES;

  protected readonly query = signal('');
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<PtrVehicle | null>(null);
  protected readonly formError = signal<PtrOutcome | null>(null);
  protected readonly feedback = signal<PtrOutcome | null>(null);

  protected readonly form = this.fb.group({
    license_plate: this.fb.control('', Validators.required),
    vehicle_category: this.fb.control<PtrVehicleCategory>('sedan_ncc', Validators.required),
    passenger_capacity: this.fb.control(4, [Validators.required, Validators.min(1)]),
    gross_weight_tons: this.fb.control(0),
    odometer_km: this.fb.control(0),
    ncc_authorization_number: this.fb.control(''),
    ncc_issuing_municipality: this.fb.control(''),
    has_digital_tachograph: this.fb.control(false),
    psva_subject: this.fb.control(false),
    active: this.fb.control(true),
  });

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.store.load();
  }

  protected onSearch(term: string): void {
    this.query.set(term);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => void this.store.load(term || undefined), 350);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset();
    this.drawerOpen.set(true);
  }

  protected openEdit(vehicle: PtrVehicle): void {
    this.editing.set(vehicle);
    this.formError.set(null);
    this.form.reset({
      license_plate: vehicle.license_plate,
      vehicle_category: vehicle.vehicle_category,
      passenger_capacity: vehicle.passenger_capacity,
      gross_weight_tons: toNumber(vehicle.gross_weight_tons),
      odometer_km: vehicle.odometer_km,
      ncc_authorization_number: vehicle.ncc_authorization_number ?? '',
      ncc_issuing_municipality: vehicle.ncc_issuing_municipality ?? '',
      has_digital_tachograph: vehicle.has_digital_tachograph,
      psva_subject: vehicle.psva_subject,
      active: vehicle.active,
    });
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
    this.editing.set(null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const payload: PtrVehiclePayload = {
      ...value,
      license_plate: value.license_plate.trim().toUpperCase(),
      ncc_authorization_number: value.ncc_authorization_number.trim() || null,
      ncc_issuing_municipality: value.ncc_issuing_municipality.trim() || null,
    };
    const outcome = await this.store.save(payload, this.editing()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('passengerTransport.notification.vehicleSaved'));
      this.close();
    } else {
      this.formError.set(outcome);
    }
  }

  protected async remove(vehicle: PtrVehicle): Promise<void> {
    const outcome = await this.store.remove(vehicle.id);
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('passengerTransport.notification.vehicleDeleted'));
    } else {
      this.feedback.set(outcome);
    }
  }
}
