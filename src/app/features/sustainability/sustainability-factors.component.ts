import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
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
  EsgActivityType,
  EsgEmissionFactor,
  EsgEmissionFactorRequest,
  EsgRegion,
  EsgUnit,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './sustainability.util';

/** Emission factor library: factors per activity type, unit, source, year and region, versioned. */
@Component({
  selector: 'app-sustainability-factors',
  styleUrl: './sustainability.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
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
    <app-page-header [title]="'SUSTAINABILITY.FACTORS_TITLE' | translate" [subtitle]="'SUSTAINABILITY.FACTORS_SUBTITLE' | translate">
      <button nz-button (click)="installExamples()">{{ 'SUSTAINABILITY.INSTALL_EXAMPLES' | translate }}</button>
      <button nz-button nzType="primary" (click)="openCreateModal()" appIconAction="create"></button>
    </app-page-header>

    @if (hasExamples()) {
      <nz-alert class="main-card" nzType="warning" nzShowIcon [nzMessage]="'SUSTAINABILITY.EXAMPLE_WARNING' | translate"></nz-alert>
    }

    <div class="toolbar">
      <nz-select style="width: 240px" nzAllowClear [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event); load()" [nzPlaceHolder]="'SUSTAINABILITY.ACTIVITY_TYPE' | translate">
        @for (type of activityTypes; track type) {
          <nz-option [nzValue]="type" [nzLabel]="('SUSTAINABILITY.TYPE_' + type.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 140px" nzAllowClear [ngModel]="regionFilter()" (ngModelChange)="regionFilter.set($event); load()" [nzPlaceHolder]="'SUSTAINABILITY.REGION' | translate">
        @for (region of regions; track region) {
          <nz-option [nzValue]="region" [nzLabel]="region"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="factors()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'SUSTAINABILITY.CODE' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.NAME' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.SCOPE' | translate }}</th>
            <th class="num">{{ 'SUSTAINABILITY.KG_PER_UNIT' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.REGION' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.SOURCE' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.code }} <span class="muted">v{{ row.version }}</span></td>
              <td>{{ row.name }}</td>
              <td>{{ ('SUSTAINABILITY.SCOPE_' + row.scope) | translate }}</td>
              <td class="num">{{ row.kg_co2e_per_unit }} / {{ row.unit }}</td>
              <td>{{ row.region }}</td>
              <td>{{ row.source }} ({{ row.source_year }})</td>
              <td>
                @if (row.is_example) {
                  <nz-tag nzColor="orange">{{ 'SUSTAINABILITY.EXAMPLE' | translate }}</nz-tag>
                }
                <nz-tag [nzColor]="row.is_active ? 'green' : 'default'">{{ (row.is_active ? 'SUSTAINABILITY.ACTIVE' : 'SUSTAINABILITY.INACTIVE') | translate }}</nz-tag>
              </td>
              <td>
                <button nz-button nzType="text" (click)="openVersionModal(row)" [disabled]="!row.is_active">{{ 'SUSTAINABILITY.NEW_VERSION' | translate }}</button>
                <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'SUSTAINABILITY.DELETE_FACTOR_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && factors().length === 0) {
        <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.NO_FACTORS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal
      [(nzVisible)]="createVisible"
      [nzTitle]="'SUSTAINABILITY.NEW_FACTOR' | translate"
      (nzOnCancel)="createVisible.set(false)"
      (nzOnOk)="saveFactor()"
      okAction="save"
      [nzOkDisabled]="factorForm.invalid"
      nzWidth="640px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="factorForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="code" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
            </nz-form-item>
          </div>
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
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.KG_PER_UNIT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="kg_co2e_per_unit" /></nz-form-control>
            </nz-form-item>
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
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SOURCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="source" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SOURCE_YEAR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1990" max="2100" formControlName="source_year" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="versionVisible"
      [nzTitle]="'SUSTAINABILITY.NEW_VERSION' | translate"
      (nzOnCancel)="versionVisible.set(false)"
      (nzOnOk)="saveVersion()"
      okAction="save"
      [nzOkDisabled]="versionForm.invalid"
    >
      <ng-container *nzModalContent>
        <nz-alert class="main-card" nzType="info" nzShowIcon [nzMessage]="'SUSTAINABILITY.VERSION_HINT' | translate"></nz-alert>
        <form nz-form [formGroup]="versionForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUSTAINABILITY.KG_PER_UNIT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="kg_co2e_per_unit" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SOURCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="source" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.SOURCE_YEAR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1990" max="2100" formControlName="source_year" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityFactorsComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly activityTypes = ESG_ACTIVITY_TYPES;
  readonly regions = ESG_REGIONS;

  readonly factors = signal<EsgEmissionFactor[]>([]);
  readonly loading = signal(false);
  readonly typeFilter = signal<EsgActivityType | null>(null);
  readonly regionFilter = signal<EsgRegion | null>(null);
  readonly createVisible = signal(false);
  readonly versionVisible = signal(false);
  readonly versioning = signal<EsgEmissionFactor | null>(null);
  readonly selectedType = signal<EsgActivityType>('electricity_grid');

  readonly hasExamples = computed(() => this.factors().some((factor) => factor.is_example && factor.is_active));
  readonly unitsOfType = computed<readonly EsgUnit[]>(() => ESG_ACTIVITY_UNITS[this.selectedType()]);

  readonly factorForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(60), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(190)]],
    activity_type: ['electricity_grid' as EsgActivityType, [Validators.required]],
    unit: ['kWh' as EsgUnit, [Validators.required]],
    kg_co2e_per_unit: ['', [Validators.required, Validators.min(0)]],
    region: ['EU' as EsgRegion],
    source: ['', [Validators.required, Validators.maxLength(190)]],
    source_year: [new Date().getFullYear() - 1, [Validators.required, Validators.min(1990), Validators.max(2100)]],
  });

  readonly versionForm = this.fb.group({
    kg_co2e_per_unit: ['', [Validators.required, Validators.min(0)]],
    source: ['', [Validators.required, Validators.maxLength(190)]],
    source_year: [new Date().getFullYear(), [Validators.required, Validators.min(1990), Validators.max(2100)]],
  });

  constructor() {
    this.factorForm.controls.activity_type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.selectedType.set(type);
      this.factorForm.patchValue({ unit: ESG_ACTIVITY_UNITS[type][0] });
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getFactors({ activity_type: this.typeFilter() ?? undefined, region: this.regionFilter() ?? undefined, latest_only: true, per_page: 100 }).subscribe({
      next: (response) => {
        this.factors.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
      },
    });
  }

  installExamples(): void {
    this.api.installExampleFactors().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('SUSTAINABILITY.EXAMPLES_INSTALLED', { count: response.created }));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  openCreateModal(): void {
    this.factorForm.reset({ code: '', name: '', activity_type: 'electricity_grid', unit: 'kWh', kg_co2e_per_unit: '', region: 'EU', source: '', source_year: new Date().getFullYear() - 1 });
    this.createVisible.set(true);
  }

  saveFactor(): void {
    const value = this.factorForm.getRawValue();
    const payload: EsgEmissionFactorRequest = { ...value, kg_co2e_per_unit: String(value.kg_co2e_per_unit) };

    this.api.createFactor(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.FACTOR_SAVED'));
        this.createVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  openVersionModal(factor: EsgEmissionFactor): void {
    this.versioning.set(factor);
    this.versionForm.reset({ kg_co2e_per_unit: factor.kg_co2e_per_unit, source: '', source_year: new Date().getFullYear() });
    this.versionVisible.set(true);
  }

  saveVersion(): void {
    const factor = this.versioning();
    if (factor === null) {
      return;
    }

    const value = this.versionForm.getRawValue();
    this.api.newFactorVersion(factor.id, { ...value, kg_co2e_per_unit: String(value.kg_co2e_per_unit) }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.VERSION_SAVED'));
        this.versionVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  remove(factor: EsgEmissionFactor): void {
    this.api.deleteFactor(factor.id).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant(response === null ? 'SUSTAINABILITY.FACTOR_DELETED' : 'SUSTAINABILITY.FACTOR_DEACTIVATED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
