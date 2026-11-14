import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  FACILITY_CURRENCIES,
  FACILITY_METER_KINDS,
  FACILITY_METER_UNITS,
  FacilityApiService,
  FacilityBuilding,
  FacilityCurrency,
  FacilityMeter,
  FacilityMeterKind,
  FacilityMeterReading,
  FacilityMeterRequest,
  FacilityMeterSummary,
  FacilityReadingType,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, facilityAbilities, todayIso } from './facility.util';

/** Utility meters (electricity, gas, water): readings with the consumption since the previous one, cost and monthly summary. */
@Component({
  selector: 'app-facility-meters',
  styleUrl: './facility.scss',
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
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'FACILITY.METERS_TITLE' | translate" [subtitle]="'FACILITY.METERS_SUBTITLE' | translate">
      @if (abilities().manage) {
        <button nz-button nzType="primary" (click)="openMeter()" appIconAction="create"></button>
      }
    </app-page-header>

    @if (!abilities().operate) {
      <nz-empty [nzNotFoundContent]="'FACILITY.OPERATORS_ONLY' | translate"></nz-empty>
    } @else {
      <nz-card class="main-card">
        <nz-tabs>
          <nz-tab [nzTitle]="'FACILITY.TAB_METERS' | translate">
            <nz-table #meterTable [nzData]="meters()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
              <thead>
                <tr>
                  <th>{{ 'FACILITY.CODE' | translate }}</th>
                  <th>{{ 'FACILITY.NAME' | translate }}</th>
                  <th>{{ 'FACILITY.KIND' | translate }}</th>
                  <th class="num">{{ 'FACILITY.LAST_VALUE' | translate }}</th>
                  <th>{{ 'FACILITY.LAST_READ_ON' | translate }}</th>
                  <th class="num">{{ 'FACILITY.TARIFF' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of meterTable.data; track row.id) {
                  <tr>
                    <td>{{ row.code }}</td>
                    <td>{{ row.name }} @if (!row.is_active) { <nz-tag>{{ 'FACILITY.INACTIVE' | translate }}</nz-tag> }</td>
                    <td>{{ ('FACILITY.METER_' + row.kind.toUpperCase()) | translate }}</td>
                    <td class="num">{{ row.last_value === null ? '-' : (row.last_value | number: '1.0-3') }} {{ row.unit }}</td>
                    <td>{{ row.last_read_on ?? '-' }}</td>
                    <td class="num">{{ row.tariff_per_unit === null ? '-' : (row.tariff_per_unit | number: '1.2-6') + ' ' + row.currency }}</td>
                    <td>
                      <button nz-button nzSize="small" nzType="primary" [disabled]="!row.is_active" (click)="openReading(row)">{{ 'FACILITY.RECORD_READING' | translate }}</button>
                      <button nz-button nzSize="small" (click)="openHistory(row)">{{ 'FACILITY.READINGS' | translate }}</button>
                      @if (abilities().manage) {
                        <button nz-button nzSize="small" (click)="openMeter(row)" appIconAction="edit"></button>
                        <button nz-button nzSize="small" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FACILITY.DELETE_METER_CONFIRM' | translate" (nzOnConfirm)="removeMeter(row)"></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (!loading() && meters().length === 0) {
              <nz-empty [nzNotFoundContent]="'FACILITY.NO_METERS' | translate"></nz-empty>
            }
          </nz-tab>

          <nz-tab [nzTitle]="'FACILITY.TAB_SUMMARY' | translate">
            <div class="toolbar">
              <input nz-input type="number" style="width: 120px" min="2000" max="2100" [ngModel]="year()" (ngModelChange)="year.set($event)" (change)="loadSummary()" [attr.aria-label]="'FACILITY.YEAR' | translate" />
              <nz-select style="width: 180px" nzAllowClear [ngModel]="summaryKind()" (ngModelChange)="summaryKind.set($event); loadSummary()" [nzPlaceHolder]="'FACILITY.KIND' | translate">
                @for (value of kinds; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('FACILITY.METER_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </div>
            <nz-table #summaryTable [nzData]="summary()?.rows ?? []" nzSize="small" [nzShowPagination]="false" [nzPageSize]="200">
              <thead>
                <tr>
                  <th>{{ 'FACILITY.MONTH' | translate }}</th>
                  <th>{{ 'FACILITY.KIND' | translate }}</th>
                  <th class="num">{{ 'FACILITY.CONSUMPTION' | translate }}</th>
                  <th class="num">{{ 'FACILITY.COST' | translate }}</th>
                  <th class="num">{{ 'FACILITY.READINGS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of summaryTable.data; track row.month + row.kind + row.unit + row.currency) {
                  <tr>
                    <td>{{ row.month }}</td>
                    <td>{{ ('FACILITY.METER_' + row.kind.toUpperCase()) | translate }}</td>
                    <td class="num">{{ row.consumption | number: '1.0-3' }} {{ row.unit }}</td>
                    <td class="num">{{ row.cost === null ? '-' : (row.cost | number: '1.2-2') + ' ' + row.currency }}</td>
                    <td class="num">{{ row.readings }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if ((summary()?.totals ?? []).length > 0) {
              <h4 style="margin-top: 16px">{{ 'FACILITY.TOTALS' | translate }}</h4>
              @for (total of summary()?.totals ?? []; track total.kind + total.unit + total.currency) {
                <div>
                  <strong>{{ ('FACILITY.METER_' + total.kind.toUpperCase()) | translate }}</strong>:
                  {{ total.consumption | number: '1.0-3' }} {{ total.unit }}
                  @if (total.cost !== null) {
                    · {{ total.cost | number: '1.2-2' }} {{ total.currency }}
                  }
                </div>
              }
            } @else {
              <nz-empty [nzNotFoundContent]="'FACILITY.NO_READINGS' | translate"></nz-empty>
            }
          </nz-tab>
        </nz-tabs>
      </nz-card>
    }

    <nz-modal [(nzVisible)]="meterVisible" [nzTitle]="'FACILITY.METER' | translate" (nzOnCancel)="meterVisible.set(false)" (nzOnOk)="saveMeter()" okAction="save" [nzOkDisabled]="meterForm.invalid" nzWidth="680px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="meterForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.BUILDING' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="building_id">
                  @for (building of buildings(); track building.id) {
                    <nz-option [nzValue]="building.id" [nzLabel]="building.code + ' - ' + building.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.KIND' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="kind">
                  @for (value of kinds; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('FACILITY.METER_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" maxlength="150" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.UNIT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="unit">
                  @for (unit of unitsOfKind(); track unit) {
                    <nz-option [nzValue]="unit" [nzLabel]="unit"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.TARIFF' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="tariff_per_unit" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="currency">
                  @for (currency of currencies; track currency) {
                    <nz-option [nzValue]="currency" [nzLabel]="currency"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.ROLLOVER_VALUE' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'FACILITY.ROLLOVER_HINT' | translate"><input nz-input type="number" min="0" step="any" formControlName="rollover_value" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'FACILITY.ACTIVE' | translate }}</nz-form-label>
              <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="readingVisible" [nzTitle]="(reading()?.code ?? '') + ' ' + (reading()?.name ?? '')" (nzOnCancel)="readingVisible.set(false)" (nzOnOk)="saveReading()" okAction="save" [nzOkDisabled]="readingForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="readingForm" nzLayout="vertical">
          @if (reading(); as meter) {
            <p class="muted">{{ 'FACILITY.LAST_VALUE' | translate }}: {{ meter.last_value ?? '-' }} {{ meter.unit }} ({{ meter.last_read_on ?? '-' }})</p>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.READ_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="read_on" [max]="today" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'FACILITY.VALUE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="value" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'FACILITY.READING_TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="reading_type">
                <nz-option nzValue="regular" [nzLabel]="'FACILITY.READING_REGULAR' | translate"></nz-option>
                <nz-option nzValue="rollover" [nzLabel]="'FACILITY.READING_ROLLOVER' | translate"></nz-option>
                <nz-option nzValue="replacement" [nzLabel]="'FACILITY.READING_REPLACEMENT' | translate"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="historyVisible" [nzTitle]="'FACILITY.READINGS' | translate" [nzFooter]="null" (nzOnCancel)="historyVisible.set(false)" nzWidth="720px">
      <ng-container *nzModalContent>
        <nz-table #historyTable [nzData]="readings()" nzSize="small" [nzPageSize]="12">
          <thead>
            <tr>
              <th>{{ 'FACILITY.READ_ON' | translate }}</th>
              <th class="num">{{ 'FACILITY.VALUE' | translate }}</th>
              <th class="num">{{ 'FACILITY.CONSUMPTION' | translate }}</th>
              <th class="num">{{ 'FACILITY.COST' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of historyTable.data; track row.id; let first = $first) {
              <tr>
                <td>{{ row.read_on }} @if (row.reading_type !== 'regular') { <nz-tag>{{ ('FACILITY.READING_' + row.reading_type.toUpperCase()) | translate }}</nz-tag> }</td>
                <td class="num">{{ row.value | number: '1.0-3' }}</td>
                <td class="num">{{ row.consumption | number: '1.0-3' }}</td>
                <td class="num">{{ row.cost === null ? '-' : (row.cost | number: '1.2-2') + ' ' + row.currency }}</td>
                <td>
                  @if (first && abilities().manage && history(); as meter) {
                    <button nz-button nzSize="small" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'FACILITY.DELETE_READING_CONFIRM' | translate" (nzOnConfirm)="removeReading(meter, row)"></button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>
  `,
})
export class FacilityMetersComponent implements OnInit {
  private readonly api = inject(FacilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  readonly kinds = FACILITY_METER_KINDS;
  readonly currencies = FACILITY_CURRENCIES;
  readonly today = todayIso();
  readonly abilities = computed(() => facilityAbilities(this.authStore.activeRoles(), this.authStore.userPermissions()));

  readonly meters = signal<FacilityMeter[]>([]);
  readonly buildings = signal<FacilityBuilding[]>([]);
  readonly readings = signal<FacilityMeterReading[]>([]);
  readonly summary = signal<FacilityMeterSummary | null>(null);
  readonly loading = signal(false);
  readonly year = signal(new Date().getFullYear());
  readonly summaryKind = signal<string | null>(null);
  readonly meterVisible = signal(false);
  readonly readingVisible = signal(false);
  readonly historyVisible = signal(false);
  readonly reading = signal<FacilityMeter | null>(null);
  readonly history = signal<FacilityMeter | null>(null);
  readonly selectedKind = signal<FacilityMeterKind>('electricity');
  readonly unitsOfKind = computed(() => FACILITY_METER_UNITS[this.selectedKind()]);
  private editing: FacilityMeter | null = null;

  readonly meterForm = this.fb.group({
    building_id: ['', [Validators.required]],
    kind: ['electricity' as FacilityMeterKind, [Validators.required]],
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    unit: ['kWh', [Validators.required]],
    tariff_per_unit: [null as number | null, [Validators.min(0)]],
    currency: ['EUR' as FacilityCurrency],
    rollover_value: [null as number | null, [Validators.min(0)]],
    is_active: [true],
  });

  readonly readingForm = this.fb.group({
    read_on: [todayIso(), [Validators.required]],
    value: [null as number | null, [Validators.required, Validators.min(0)]],
    reading_type: ['regular' as FacilityReadingType],
  });

  constructor() {
    this.meterForm.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe((kind) => {
      this.selectedKind.set(kind);
      this.meterForm.patchValue({ unit: FACILITY_METER_UNITS[kind][0] });
    });
  }

  ngOnInit(): void {
    if (!this.abilities().operate) {
      return;
    }

    this.loadMeters();
    this.loadSummary();
    this.api.getBuildings({ active: true, per_page: 100 }).subscribe({ next: (response) => this.buildings.set(response.data) });
  }

  loadMeters(): void {
    this.loading.set(true);
    this.api.getMeters({ per_page: 100 }).subscribe({
      next: (response) => {
        this.meters.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('FACILITY.ACTION_ERROR'));
      },
    });
  }

  loadSummary(): void {
    this.api.getMeterSummary({ year: Number(this.year()), kind: this.summaryKind() ?? undefined }).subscribe({ next: (response) => this.summary.set(response.data), error: () => this.summary.set(null) });
  }

  openMeter(meter: FacilityMeter | null = null): void {
    this.editing = meter;
    this.selectedKind.set(meter?.kind ?? 'electricity');
    this.meterForm.reset({
      building_id: meter?.building_id ?? this.buildings()[0]?.id ?? '',
      kind: meter?.kind ?? 'electricity',
      code: meter?.code ?? '',
      name: meter?.name ?? '',
      unit: meter?.unit ?? 'kWh',
      tariff_per_unit: meter?.tariff_per_unit === null || meter?.tariff_per_unit === undefined ? null : Number(meter.tariff_per_unit),
      currency: meter?.currency ?? 'EUR',
      rollover_value: meter?.rollover_value === null || meter?.rollover_value === undefined ? null : Number(meter.rollover_value),
      is_active: meter?.is_active ?? true,
    });
    this.meterVisible.set(true);
  }

  saveMeter(): void {
    const value = this.meterForm.getRawValue();
    const payload: FacilityMeterRequest = {
      building_id: value.building_id,
      kind: value.kind,
      code: value.code,
      name: value.name,
      unit: value.unit,
      tariff_per_unit: value.tariff_per_unit,
      currency: value.currency,
      rollover_value: value.rollover_value,
      is_active: value.is_active,
    };
    const request = this.editing ? this.api.updateMeter(this.editing.id, payload) : this.api.createMeter(payload);

    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.METER_SAVED'));
        this.meterVisible.set(false);
        this.loadMeters();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  removeMeter(meter: FacilityMeter): void {
    this.api.deleteMeter(meter.id).subscribe({
      next: () => this.loadMeters(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  openReading(meter: FacilityMeter): void {
    this.reading.set(meter);
    this.readingForm.reset({ read_on: todayIso(), value: null, reading_type: 'regular' });
    this.readingVisible.set(true);
  }

  saveReading(): void {
    const meter = this.reading();
    if (!meter) {
      return;
    }

    const value = this.readingForm.getRawValue();
    this.api.recordMeterReading(meter.id, { read_on: value.read_on, value: Number(value.value), reading_type: value.reading_type }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('FACILITY.READING_SAVED'));
        this.readingVisible.set(false);
        this.loadMeters();
        this.loadSummary();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }

  openHistory(meter: FacilityMeter): void {
    this.history.set(meter);
    this.api.getMeterReadings(meter.id, { per_page: 100 }).subscribe({ next: (response) => this.readings.set(response.data) });
    this.historyVisible.set(true);
  }

  removeReading(meter: FacilityMeter, reading: FacilityMeterReading): void {
    this.api.deleteMeterReading(meter.id, reading.id).subscribe({
      next: () => {
        this.openHistory(meter);
        this.loadMeters();
        this.loadSummary();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('FACILITY.ACTION_ERROR')),
    });
  }
}
