import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { QualityApiService, QualityExtraApiService, SpcCharacteristic, SpcCharacteristicRequest, SpcChart, SpcSampleRequest, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull } from '../fleet/fleet.util';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const CHART_PADDING = 24;

/** Statistical process control: characteristics, subgroup entry, X-bar chart, capability indices and rule violations. */
@Component({
  selector: 'app-quality-spc',
  styleUrl: './quality.scss',
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
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'QUALITY.SPC_TITLE' | translate" [subtitle]="'QUALITY.SPC_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCharacteristicModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="characteristics()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'QUALITY.CODE' | translate }}</th>
            <th>{{ 'QUALITY.NAME' | translate }}</th>
            <th class="num">{{ 'QUALITY.LSL' | translate }}</th>
            <th class="num">{{ 'QUALITY.USL' | translate }}</th>
            <th class="num">{{ 'QUALITY.SUBGROUP_SIZE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr [class.selected-row]="selected()?.id === row.id" (click)="select(row)">
              <td>{{ row.code }}</td>
              <td>{{ row.name }} @if (row.unit) { <span class="muted">({{ row.unit }})</span> }</td>
              <td class="num">{{ row.lower_spec_limit !== null ? (row.lower_spec_limit | number: '1.0-5') : '' }}</td>
              <td class="num">{{ row.upper_spec_limit !== null ? (row.upper_spec_limit | number: '1.0-5') : '' }}</td>
              <td class="num">{{ row.subgroup_size }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" (click)="openEditCharacteristic(row); $event.stopPropagation()">{{ 'QUALITY.ACTION_EDIT' | translate }}</button>
                  <button nz-button nzType="text" (click)="openSampleModal(row); $event.stopPropagation()">{{ 'QUALITY.ADD_SAMPLE' | translate }}</button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'QUALITY.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)" (click)="$event.stopPropagation()"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && characteristics().length === 0) {
        <nz-empty [nzNotFoundContent]="'QUALITY.NO_CHARACTERISTICS' | translate"></nz-empty>
      }
    </nz-card>

    @if (chart(); as data) {
      <nz-card class="main-card" [nzTitle]="selected()?.name ?? ''">
        <div class="toolbar">
          <nz-tag [nzColor]="data.in_control ? 'green' : 'red'">{{ (data.in_control ? 'QUALITY.IN_CONTROL' : 'QUALITY.OUT_OF_CONTROL') | translate }}</nz-tag>
          <span class="muted">{{ 'QUALITY.SUBGROUPS' | translate }}: {{ data.subgroup_count }}</span>
          @if (!data.is_reliable) {
            <nz-tag nzColor="orange">{{ 'QUALITY.NOT_RELIABLE' | translate }}</nz-tag>
          }
        </div>

        @if (data.limits) {
          <svg class="spc-chart" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="'QUALITY.XBAR_CHART' | translate">
            <line [attr.x1]="padding" [attr.x2]="width - padding" [attr.y1]="yFor(data.limits.xbar.ucl)" [attr.y2]="yFor(data.limits.xbar.ucl)" class="limit" />
            <line [attr.x1]="padding" [attr.x2]="width - padding" [attr.y1]="yFor(data.limits.xbar.center)" [attr.y2]="yFor(data.limits.xbar.center)" class="center" />
            <line [attr.x1]="padding" [attr.x2]="width - padding" [attr.y1]="yFor(data.limits.xbar.lcl)" [attr.y2]="yFor(data.limits.xbar.lcl)" class="limit" />
            <polyline [attr.points]="polyline()" class="series" />
            @for (point of plotted(); track point.sample_id) {
              <circle [attr.cx]="point.x" [attr.cy]="point.y" r="3" [class.violation]="point.violated" />
            }
          </svg>
          <div class="limits-row muted">
            UCL {{ data.limits.xbar.ucl | number: '1.0-4' }} · CL {{ data.limits.xbar.center | number: '1.0-4' }} · LCL {{ data.limits.xbar.lcl | number: '1.0-4' }}
            · R UCL {{ data.limits.range.ucl | number: '1.0-4' }} · R̄ {{ data.limits.range.center | number: '1.0-4' }}
          </div>
        } @else {
          <nz-empty [nzNotFoundContent]="'QUALITY.NEED_SAMPLES' | translate"></nz-empty>
        }

        @if (data.capability; as capability) {
          <div class="stats-grid">
            @for (index of capabilityIndices(capability); track index.key) {
              <nz-card nzSize="small">
                <div class="muted">{{ index.key }}</div>
                <strong>{{ index.value !== null ? (index.value | number: '1.2-3') : '-' }}</strong>
              </nz-card>
            }
          </div>
        }

        <h4>{{ 'QUALITY.SAMPLES' | translate }}</h4>
        <nz-table #samples [nzData]="data.points" nzSize="small" [nzPageSize]="10">
          <thead>
            <tr>
              <th>{{ 'QUALITY.SAMPLED_AT' | translate }}</th>
              <th>{{ 'QUALITY.LOT' | translate }}</th>
              <th class="num">{{ 'QUALITY.MEAN' | translate }}</th>
              <th class="num">{{ 'QUALITY.RANGE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (point of samples.data; track point.sample_id) {
              <tr>
                <td>{{ point.sampled_at }}</td>
                <td>{{ point.lot }}</td>
                <td class="num">{{ point.mean | number: '1.0-5' }}</td>
                <td class="num">{{ point.range | number: '1.0-5' }}</td>
                <td><button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'QUALITY.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeSample(point.sample_id)"></button></td>
              </tr>
            }
          </tbody>
        </nz-table>

        @if (data.violations.length > 0) {
          <h4>{{ 'QUALITY.VIOLATIONS' | translate }}</h4>
          <ul>
            @for (violation of data.violations; track $index) {
              <li>#{{ violation.index + 1 }} · {{ violation.chart === 'xbar' ? 'X̄' : 'R' }} · {{ ('QUALITY.RULE_' + violation.rule) | translate }}</li>
            }
          </ul>
        }
      </nz-card>
    }

    <nz-modal appModalActions [(nzVisible)]="characteristicVisible" [nzTitle]="(editingId() ? 'QUALITY.ACTION_EDIT' : 'QUALITY.NEW_CHARACTERISTIC') | translate" (nzOnCancel)="characteristicVisible.set(false)" (nzOnOk)="saveCharacteristic()" okAction="save" [nzOkDisabled]="characteristicForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="characteristicForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="spc-code">{{ 'QUALITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="spc-name">{{ 'QUALITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="spc-unit">{{ 'QUALITY.UNIT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-unit" formControlName="unit" maxlength="20" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="spc-size">{{ 'QUALITY.SUBGROUP_SIZE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-size" type="number" min="2" max="10" formControlName="subgroup_size" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="spc-lsl">{{ 'QUALITY.LSL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-lsl" type="number" step="any" formControlName="lower_spec_limit" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="spc-usl">{{ 'QUALITY.USL' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-usl" type="number" step="any" formControlName="upper_spec_limit" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="spc-target">{{ 'QUALITY.TARGET' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="spc-target" type="number" step="any" formControlName="target" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="sampleVisible" [nzTitle]="'QUALITY.ADD_SAMPLE' | translate" (nzOnCancel)="sampleVisible.set(false)" (nzOnOk)="saveSample()" okAction="save" [nzOkDisabled]="sampleForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="sampleForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="sample-values">{{ 'QUALITY.MEASUREMENTS' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="('QUALITY.MEASUREMENTS_HINT' | translate) + ' ' + (sampleTarget()?.subgroup_size ?? '')">
              <input nz-input id="sample-values" formControlName="measurements" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="sample-lot">{{ 'QUALITY.LOT' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="sample-lot" formControlName="lot" maxlength="80" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class QualitySpcComponent implements OnInit {
  private readonly api = inject(QualityApiService);
  private readonly extraApi = inject(QualityExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly width = CHART_WIDTH;
  readonly height = CHART_HEIGHT;
  readonly padding = CHART_PADDING;

  readonly characteristics = signal<SpcCharacteristic[]>([]);
  readonly selected = signal<SpcCharacteristic | null>(null);
  readonly chart = signal<SpcChart | null>(null);
  readonly loading = signal(false);
  readonly characteristicVisible = signal(false);
  readonly sampleVisible = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly sampleTarget = signal<SpcCharacteristic | null>(null);

  readonly characteristicForm = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    unit: [''],
    lower_spec_limit: this.fb.control<number | null>(null),
    upper_spec_limit: this.fb.control<number | null>(null),
    target: this.fb.control<number | null>(null),
    subgroup_size: [5, [Validators.required, Validators.min(2), Validators.max(10)]],
  });

  readonly sampleForm = this.fb.group({
    measurements: ['', [Validators.required]],
    lot: [''],
  });

  /** Vertical scale of the X-bar chart: control limits and every plotted mean. */
  private readonly scale = computed(() => {
    const data = this.chart();
    if (!data?.limits) {
      return { min: 0, max: 1 };
    }
    const values = [data.limits.xbar.ucl, data.limits.xbar.lcl, ...data.points.map((point) => point.mean)];
    return { min: Math.min(...values), max: Math.max(...values) };
  });

  readonly plotted = computed(() => {
    const data = this.chart();
    if (!data) {
      return [];
    }
    const violated = new Set(data.violations.filter((violation) => violation.chart === 'xbar').map((violation) => violation.sample_id));
    const step = data.points.length > 1 ? (CHART_WIDTH - 2 * CHART_PADDING) / (data.points.length - 1) : 0;
    return data.points.map((point, index) => ({
      sample_id: point.sample_id,
      x: CHART_PADDING + index * step,
      y: this.yFor(point.mean),
      violated: violated.has(point.sample_id),
    }));
  });

  readonly polyline = computed(() => this.plotted().map((point) => `${point.x},${point.y}`).join(' '));

  ngOnInit(): void {
    this.load();
  }

  yFor(value: number): number {
    const { min, max } = this.scale();
    const span = max - min || 1;
    return CHART_PADDING + ((max - value) / span) * (CHART_HEIGHT - 2 * CHART_PADDING);
  }

  capabilityIndices(capability: NonNullable<SpcChart['capability']>): { key: string; value: number | null }[] {
    return [
      { key: 'Cp', value: capability.cp },
      { key: 'Cpk', value: capability.cpk },
      { key: 'Pp', value: capability.pp },
      { key: 'Ppk', value: capability.ppk },
    ];
  }

  load(): void {
    this.loading.set(true);
    this.api.getCharacteristics().subscribe({
      next: (response) => {
        this.characteristics.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('QUALITY.ACTION_ERROR'));
      },
    });
  }

  select(characteristic: SpcCharacteristic): void {
    this.selected.set(characteristic);
    this.api.getSpcChart(characteristic.id).subscribe({
      next: (response) => this.chart.set(response.data),
      error: () => this.message.error(this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  openEditCharacteristic(characteristic: SpcCharacteristic): void {
    this.editingId.set(characteristic.id);
    this.characteristicForm.reset({
      code: characteristic.code,
      name: characteristic.name,
      unit: characteristic.unit ?? '',
      lower_spec_limit: characteristic.lower_spec_limit === null ? null : Number(characteristic.lower_spec_limit),
      upper_spec_limit: characteristic.upper_spec_limit === null ? null : Number(characteristic.upper_spec_limit),
      target: characteristic.target === null ? null : Number(characteristic.target),
      subgroup_size: characteristic.subgroup_size,
    });
    this.characteristicVisible.set(true);
  }

  openCharacteristicModal(): void {
    this.editingId.set(null);
    this.characteristicForm.reset({ code: '', name: '', unit: '', lower_spec_limit: null, upper_spec_limit: null, target: null, subgroup_size: 5 });
    this.characteristicVisible.set(true);
  }

  saveCharacteristic(): void {
    const value = this.characteristicForm.getRawValue();
    const payload: SpcCharacteristicRequest = {
      code: value.code.trim(),
      name: value.name.trim(),
      unit: blankToNull(value.unit),
      lower_spec_limit: decimalOrNull(value.lower_spec_limit),
      upper_spec_limit: decimalOrNull(value.upper_spec_limit),
      target: decimalOrNull(value.target),
      subgroup_size: value.subgroup_size,
      instrument_id: null,
      notes: null,
    };
    const id = this.editingId();
    const request$ = id ? this.extraApi.updateCharacteristic(id, payload) : this.api.createCharacteristic(payload);
    request$.subscribe({
      next: () => {
        this.message.success(this.translate.instant('QUALITY.SAVED'));
        this.characteristicVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  openSampleModal(characteristic: SpcCharacteristic): void {
    this.sampleTarget.set(characteristic);
    this.sampleForm.reset({ measurements: '', lot: '' });
    this.sampleVisible.set(true);
  }

  saveSample(): void {
    const target = this.sampleTarget();
    if (!target) {
      return;
    }
    const value = this.sampleForm.getRawValue();
    const payload: SpcSampleRequest = {
      measurements: value.measurements.split(/[\s;,]+/).filter((part) => part !== '').map(Number),
      sampled_at: null,
      lot: blankToNull(value.lot),
      instrument_id: null,
    };
    this.api.addSpcSample(target.id, payload).subscribe({
      next: (response) => {
        if (response.violations.length > 0) {
          this.message.warning(this.translate.instant('QUALITY.SAMPLE_OUT_OF_CONTROL'));
        } else {
          this.message.success(this.translate.instant('QUALITY.SAVED'));
        }
        this.sampleVisible.set(false);
        this.select(target);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  removeSample(sampleId: string): void {
    const target = this.selected();
    this.api.deleteSpcSample(sampleId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('QUALITY.SAMPLE_DELETED'));
        if (target) {
          this.select(target);
        }
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  remove(characteristic: SpcCharacteristic): void {
    this.api.deleteCharacteristic(characteristic.id).subscribe({
      next: () => {
        if (this.selected()?.id === characteristic.id) {
          this.selected.set(null);
          this.chart.set(null);
        }
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }
}
