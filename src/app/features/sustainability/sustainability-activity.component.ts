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
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESG_ACTIVITY_TYPES,
  ESG_ACTIVITY_UNITS,
  ESG_REGIONS,
  EsgActivityRecord,
  EsgActivityRecordRequest,
  EsgActivityType,
  EsgDataQuality,
  EsgEmissionFactor,
  EsgRegion,
  EsgScope,
  EsgUnit,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, todayIso } from './sustainability.util';

/** Activity data entry: quantities mapped to GHG scopes 1, 2 and 3, with the emission factor frozen on every record. */
@Component({
  selector: 'app-sustainability-activity',
  styleUrl: './sustainability.scss',
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
    <app-page-header [title]="'SUSTAINABILITY.ACTIVITY_TITLE' | translate" [subtitle]="'SUSTAINABILITY.ACTIVITY_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <input nz-input type="date" style="width: 160px" [ngModel]="from()" (ngModelChange)="from.set($event)" (change)="load()" [attr.aria-label]="'SUSTAINABILITY.FROM' | translate" />
      <input nz-input type="date" style="width: 160px" [ngModel]="to()" (ngModelChange)="to.set($event)" (change)="load()" [attr.aria-label]="'SUSTAINABILITY.TO' | translate" />
      <nz-select style="width: 160px" nzAllowClear [ngModel]="scope()" (ngModelChange)="scope.set($event); load()" [nzPlaceHolder]="'SUSTAINABILITY.SCOPE' | translate">
        @for (value of scopes; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('SUSTAINABILITY.SCOPE_' + value) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 180px" nzAllowClear [ngModel]="quality()" (ngModelChange)="quality.set($event); load()" [nzPlaceHolder]="'SUSTAINABILITY.DATA_QUALITY' | translate">
        <nz-option nzValue="measured" [nzLabel]="'SUSTAINABILITY.QUALITY_MEASURED' | translate"></nz-option>
        <nz-option nzValue="estimated" [nzLabel]="'SUSTAINABILITY.QUALITY_ESTIMATED' | translate"></nz-option>
      </nz-select>
      <span class="spacer"></span>
      <span class="muted">{{ 'SUSTAINABILITY.TOTAL_KG' | translate }}: <strong>{{ totalKg() | number: '1.0-2' }}</strong></span>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="records()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'SUSTAINABILITY.DATE' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.ACTIVITY_TYPE' | translate }}</th>
            <th class="num">{{ 'SUSTAINABILITY.QUANTITY' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.SCOPE' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.FACTOR' | translate }}</th>
            <th class="num">{{ 'SUSTAINABILITY.CO2E_KG' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.DATA_QUALITY' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.SITE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.activity_date }}</td>
              <td>{{ ('SUSTAINABILITY.TYPE_' + row.activity_type.toUpperCase()) | translate }}</td>
              <td class="num">{{ row.quantity | number: '1.0-4' }} {{ row.unit }}</td>
              <td>{{ ('SUSTAINABILITY.SCOPE_' + row.scope) | translate }}</td>
              <td>{{ row.factor_code }} v{{ row.factor_version }}</td>
              <td class="num">{{ row.co2e_kg | number: '1.0-2' }}</td>
              <td>
                <nz-tag [nzColor]="row.data_quality === 'measured' ? 'green' : 'orange'">{{ ('SUSTAINABILITY.QUALITY_' + row.data_quality.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>{{ row.site }}</td>
              <td>
                <button nz-button nzType="text" appIconAction="edit" (click)="openEdit(row)"></button>
                <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'SUSTAINABILITY.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && records().length === 0) {
        <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_DATA' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="(editingId() ? 'SUSTAINABILITY.EDIT_ACTIVITY' : 'SUSTAINABILITY.NEW_ACTIVITY') | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="640px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.ACTIVITY_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="activity_type">
                  @for (type of activityTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('SUSTAINABILITY.TYPE_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="activity_date" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.QUANTITY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="quantity" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.UNIT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="unit">
                  @for (unit of unitsOfType(); track unit) {
                    <nz-option [nzValue]="unit" [nzLabel]="unit"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.REGION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="region">
                  @for (region of regions; track region) {
                    <nz-option [nzValue]="region" [nzLabel]="region"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.DATA_QUALITY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="data_quality">
                  <nz-option nzValue="measured" [nzLabel]="'SUSTAINABILITY.QUALITY_MEASURED' | translate"></nz-option>
                  <nz-option nzValue="estimated" [nzLabel]="'SUSTAINABILITY.QUALITY_ESTIMATED' | translate"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'SUSTAINABILITY.FACTOR' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'SUSTAINABILITY.FACTOR_AUTO_HINT' | translate">
              <nz-select formControlName="emission_factor_id" nzAllowClear>
                @for (factor of factorsOfType(); track factor.id) {
                  <nz-option [nzValue]="factor.id" [nzLabel]="factor.code + ' v' + factor.version + ' - ' + factor.kg_co2e_per_unit + ' kg/' + factor.unit"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.SITE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="site" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="reference" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityActivityComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly activityTypes = ESG_ACTIVITY_TYPES;
  readonly regions = ESG_REGIONS;
  readonly scopes: readonly EsgScope[] = [1, 2, 3];

  readonly records = signal<EsgActivityRecord[]>([]);
  readonly factors = signal<EsgEmissionFactor[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly from = signal('');
  readonly to = signal('');
  readonly scope = signal<EsgScope | null>(null);
  readonly quality = signal<EsgDataQuality | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly selectedType = signal<EsgActivityType>('electricity_grid');

  readonly unitsOfType = computed<readonly EsgUnit[]>(() => ESG_ACTIVITY_UNITS[this.selectedType()]);
  readonly factorsOfType = computed(() => this.factors().filter((factor) => factor.activity_type === this.selectedType() && factor.is_active));
  readonly totalKg = computed(() => this.records().reduce((sum, record) => sum + Number(record.co2e_kg), 0));

  readonly form = this.fb.group({
    activity_type: ['electricity_grid' as EsgActivityType, [Validators.required]],
    activity_date: [todayIso(), [Validators.required]],
    quantity: ['', [Validators.required, Validators.min(0.0001)]],
    unit: ['kWh' as EsgUnit, [Validators.required]],
    region: ['IT' as EsgRegion],
    data_quality: ['measured' as EsgDataQuality],
    emission_factor_id: [''],
    site: ['', [Validators.maxLength(120)]],
    reference: ['', [Validators.maxLength(120)]],
  });

  constructor() {
    this.form.controls.activity_type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => this.onTypeChange(type));
  }

  ngOnInit(): void {
    this.load();
    this.api.getFactors({ is_active: true, latest_only: true, per_page: 100 }).subscribe({
      next: (response) => this.factors.set(response.data),
    });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getActivityRecords({
        from: this.from() || undefined,
        to: this.to() || undefined,
        scope: this.scope() ?? undefined,
        data_quality: this.quality() ?? undefined,
        per_page: 100,
      })
      .subscribe({
        next: (response) => {
          this.records.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
        },
      });
  }

  openModal(): void {
    this.editingId.set(null);
    this.form.reset({ activity_type: 'electricity_grid', activity_date: todayIso(), quantity: '', unit: 'kWh', region: 'IT', data_quality: 'measured', emission_factor_id: '', site: '', reference: '' });
    this.selectedType.set('electricity_grid');
    this.modalVisible.set(true);
  }

  openEdit(record: EsgActivityRecord): void {
    this.editingId.set(record.id);
    this.selectedType.set(record.activity_type);
    this.form.reset(
      {
        activity_type: record.activity_type,
        activity_date: record.activity_date.slice(0, 10),
        quantity: record.quantity,
        unit: record.unit,
        region: 'IT',
        data_quality: record.data_quality,
        emission_factor_id: record.emission_factor_id,
        site: record.site ?? '',
        reference: record.reference ?? '',
      },
      { emitEvent: false },
    );
    this.modalVisible.set(true);
  }

  private onTypeChange(type: EsgActivityType): void {
    this.selectedType.set(type);
    this.form.patchValue({ unit: ESG_ACTIVITY_UNITS[type][0], emission_factor_id: '' });
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: EsgActivityRecordRequest = {
      activity_type: value.activity_type,
      activity_date: value.activity_date,
      quantity: String(value.quantity),
      unit: value.unit,
      region: value.region,
      data_quality: value.data_quality,
      emission_factor_id: value.emission_factor_id || null,
      site: value.site || null,
      reference: value.reference || null,
    };

    const id = this.editingId();
    const request = id === null ? this.api.createActivityRecord(payload) : this.api.updateActivityRecord(id, payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ACTIVITY_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  remove(record: EsgActivityRecord): void {
    this.api.deleteActivityRecord(record.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ACTIVITY_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
