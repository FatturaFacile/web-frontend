import { Component, inject, OnInit, signal } from '@angular/core';
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
  CALIBRATION_RESULTS,
  CalibrationResult,
  InstrumentCalibrationStatus,
  QualityApiService,
  QualityCalibration,
  QualityCalibrationImpact,
  QualityCalibrationRequest,
  QualityInstrument,
  QualityInstrumentRequest,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, decimalOrNull, todayIso } from '../fleet/fleet.util';

const STATUS_COLORS: Record<InstrumentCalibrationStatus, string> = {
  valid: 'green',
  due_soon: 'orange',
  overdue: 'red',
  quarantined: 'volcano',
  retired: 'default',
};

/** Measuring instruments with calibration due dates, certificates and the out-of-tolerance impact. */
@Component({
  selector: 'app-quality-instruments',
  styleUrl: './quality.scss',
  imports: [
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
    <app-page-header [title]="'QUALITY.INSTRUMENTS_TITLE' | translate" [subtitle]="'QUALITY.INSTRUMENTS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openInstrumentModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select [ngModel]="calibrationFilter()" (ngModelChange)="calibrationFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'QUALITY.CALIBRATION_STATUS' | translate" style="min-width: 220px">
        <nz-option nzValue="overdue" [nzLabel]="'QUALITY.STATUS_OVERDUE' | translate"></nz-option>
        <nz-option nzValue="due_soon" [nzLabel]="'QUALITY.STATUS_DUE_SOON' | translate"></nz-option>
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="instruments()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'QUALITY.CODE' | translate }}</th>
            <th>{{ 'QUALITY.NAME' | translate }}</th>
            <th>{{ 'QUALITY.LOCATION' | translate }}</th>
            <th>{{ 'QUALITY.LAST_CALIBRATED' | translate }}</th>
            <th>{{ 'QUALITY.NEXT_DUE' | translate }}</th>
            <th>{{ 'QUALITY.CALIBRATION_STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.location }}</td>
              <td>{{ row.last_calibrated_on }}</td>
              <td>{{ row.next_due_on }}</td>
              <td><nz-tag [nzColor]="color(row.calibration_status)">{{ ('QUALITY.STATUS_' + row.calibration_status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  @if (row.status !== 'retired') {
                    <button nz-button nzType="text" (click)="openCalibrationModal(row)">{{ 'QUALITY.RECORD_CALIBRATION' | translate }}</button>
                  }
                  @if (row.status !== 'retired') {
                    <button nz-button nzType="text" (click)="openEditInstrument(row)">{{ 'QUALITY.ACTION_EDIT' | translate }}</button>
                  }
                  <button nz-button nzType="text" (click)="showHistory(row)">{{ 'QUALITY.HISTORY' | translate }}</button>
                  @if (row.status !== 'retired') {
                    <button nz-button nzType="text" nzDanger nz-popconfirm [nzPopconfirmTitle]="'QUALITY.RETIRE_CONFIRM' | translate" (nzOnConfirm)="retire(row)">{{ 'QUALITY.RETIRE' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && instruments().length === 0) {
        <nz-empty [nzNotFoundContent]="'QUALITY.NO_INSTRUMENTS' | translate"></nz-empty>
      }
    </nz-card>

    @if (history(); as items) {
      <nz-card class="main-card" [nzTitle]="('QUALITY.HISTORY' | translate) + ' - ' + historyInstrument()?.code">
        <nz-table [nzData]="items" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'QUALITY.CALIBRATED_ON' | translate }}</th>
              <th>{{ 'QUALITY.NEXT_DUE' | translate }}</th>
              <th>{{ 'QUALITY.RESULT' | translate }}</th>
              <th>{{ 'QUALITY.CERTIFICATE' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (item of items; track item.id) {
              <tr>
                <td>{{ item.calibrated_on }}</td>
                <td>{{ item.next_due_on }}</td>
                <td>{{ ('QUALITY.RESULT_' + item.result.toUpperCase()) | translate }}</td>
                <td>{{ item.certificate_number }}</td>
                <td>
                  @if (item.result === 'out_of_tolerance') {
                    <button nz-button nzType="text" (click)="showImpact(item)">{{ 'QUALITY.IMPACT' | translate }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (impact(); as data) {
          <p>
            {{ 'QUALITY.IMPACT_SUMMARY' | translate }}: {{ data.sample_count }}
            @for (entry of data.characteristics; track entry.characteristic_id) {
              <br />{{ entry.code }} - {{ entry.name }}: {{ entry.sample_count }} @if (entry.lots.length > 0) { ({{ entry.lots.join(', ') }}) }
            }
          </p>
        }
      </nz-card>
    }

    <nz-modal appModalActions [(nzVisible)]="instrumentVisible" [nzTitle]="(editingId() ? 'QUALITY.ACTION_EDIT' : 'QUALITY.NEW_INSTRUMENT') | translate" (nzOnCancel)="instrumentVisible.set(false)" (nzOnOk)="saveInstrument()" okAction="save" [nzOkDisabled]="instrumentForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="instrumentForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ins-code">{{ 'QUALITY.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ins-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ins-name">{{ 'QUALITY.NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ins-name" formControlName="name" maxlength="190" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ins-serial">{{ 'QUALITY.SERIAL_NUMBER' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ins-serial" formControlName="serial_number" maxlength="80" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="ins-location">{{ 'QUALITY.LOCATION' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ins-location" formControlName="location" maxlength="120" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="ins-tolerance">{{ 'QUALITY.TOLERANCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ins-tolerance" type="number" min="0" step="any" formControlName="tolerance" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="ins-interval">{{ 'QUALITY.INTERVAL_DAYS' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="ins-interval" type="number" min="1" max="3650" formControlName="calibration_interval_days" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="calibrationVisible" [nzTitle]="'QUALITY.RECORD_CALIBRATION' | translate" (nzOnCancel)="calibrationVisible.set(false)" (nzOnOk)="saveCalibration()" okAction="save" [nzOkDisabled]="calibrationForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="calibrationForm" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cal-date">{{ 'QUALITY.CALIBRATED_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cal-date" type="date" formControlName="calibrated_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'QUALITY.RESULT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="result">
                  @for (result of results; track result) {
                    <nz-option [nzValue]="result" [nzLabel]="('QUALITY.RESULT_' + result.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cal-found">{{ 'QUALITY.AS_FOUND_ERROR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cal-found" type="number" step="any" formControlName="as_found_error" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cal-left">{{ 'QUALITY.AS_LEFT_ERROR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cal-left" type="number" step="any" formControlName="as_left_error" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cal-lab">{{ 'QUALITY.LABORATORY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cal-lab" formControlName="laboratory" maxlength="160" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cal-cert">{{ 'QUALITY.CERTIFICATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="cal-cert" formControlName="certificate_number" maxlength="80" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class QualityInstrumentsComponent implements OnInit {
  private readonly api = inject(QualityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly results = CALIBRATION_RESULTS;
  readonly instruments = signal<QualityInstrument[]>([]);
  readonly loading = signal(false);
  readonly calibrationFilter = signal<'overdue' | 'due_soon' | ''>('');
  readonly instrumentVisible = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly calibrationVisible = signal(false);
  readonly calibrationTarget = signal<QualityInstrument | null>(null);
  readonly history = signal<QualityCalibration[] | null>(null);
  readonly historyInstrument = signal<QualityInstrument | null>(null);
  readonly impact = signal<QualityCalibrationImpact | null>(null);

  readonly instrumentForm = this.fb.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    serial_number: [''],
    location: [''],
    tolerance: this.fb.control<number | null>(null, [Validators.min(0)]),
    calibration_interval_days: [365, [Validators.required, Validators.min(1), Validators.max(3650)]],
  });

  readonly calibrationForm = this.fb.group({
    calibrated_on: [todayIso(), [Validators.required]],
    result: ['pass' as CalibrationResult, [Validators.required]],
    as_found_error: this.fb.control<number | null>(null),
    as_left_error: this.fb.control<number | null>(null),
    laboratory: [''],
    certificate_number: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  color(status: InstrumentCalibrationStatus): string {
    return STATUS_COLORS[status];
  }

  load(): void {
    this.loading.set(true);
    this.api.getInstruments({ calibration: this.calibrationFilter() }).subscribe({
      next: (response) => {
        this.instruments.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('QUALITY.ACTION_ERROR'));
      },
    });
  }

  openEditInstrument(instrument: QualityInstrument): void {
    this.editingId.set(instrument.id);
    this.instrumentForm.reset({
      code: instrument.code,
      name: instrument.name,
      serial_number: instrument.serial_number ?? '',
      location: instrument.location ?? '',
      tolerance: instrument.tolerance === null ? null : Number(instrument.tolerance),
      calibration_interval_days: instrument.calibration_interval_days,
    });
    this.instrumentVisible.set(true);
  }

  openInstrumentModal(): void {
    this.editingId.set(null);
    this.instrumentForm.reset({ code: '', name: '', serial_number: '', location: '', tolerance: null, calibration_interval_days: 365 });
    this.instrumentVisible.set(true);
  }

  saveInstrument(): void {
    const value = this.instrumentForm.getRawValue();
    const payload: QualityInstrumentRequest = {
      code: value.code.trim(),
      name: value.name.trim(),
      serial_number: blankToNull(value.serial_number),
      manufacturer: null,
      location: blankToNull(value.location),
      unit: null,
      range_min: null,
      range_max: null,
      tolerance: decimalOrNull(value.tolerance),
      calibration_interval_days: value.calibration_interval_days,
      notes: null,
    };
    const id = this.editingId();
    const request$ = id ? this.api.updateInstrument(id, payload) : this.api.createInstrument(payload);
    request$.subscribe({
      next: () => {
        this.message.success(this.translate.instant('QUALITY.SAVED'));
        this.instrumentVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  openCalibrationModal(instrument: QualityInstrument): void {
    this.calibrationTarget.set(instrument);
    this.calibrationForm.reset({ calibrated_on: todayIso(), result: 'pass', as_found_error: null, as_left_error: null, laboratory: '', certificate_number: '' });
    this.calibrationVisible.set(true);
  }

  saveCalibration(): void {
    const target = this.calibrationTarget();
    if (!target) {
      return;
    }
    const value = this.calibrationForm.getRawValue();
    const payload: QualityCalibrationRequest = {
      calibrated_on: value.calibrated_on,
      next_due_on: null,
      result: value.result,
      as_found_error: decimalOrNull(value.as_found_error),
      as_left_error: decimalOrNull(value.as_left_error),
      laboratory: blankToNull(value.laboratory),
      certificate_number: blankToNull(value.certificate_number),
      notes: null,
    };
    this.api.recordCalibration(target.id, payload).subscribe({
      next: (response) => {
        if (response.data.result === 'out_of_tolerance') {
          this.message.warning(this.translate.instant('QUALITY.OUT_OF_TOLERANCE_RAISED'));
        } else {
          this.message.success(this.translate.instant('QUALITY.SAVED'));
        }
        this.calibrationVisible.set(false);
        this.load();
        this.showHistory(target);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  showHistory(instrument: QualityInstrument): void {
    this.historyInstrument.set(instrument);
    this.impact.set(null);
    this.api.getCalibrations(instrument.id).subscribe({
      next: (response) => this.history.set(response.data),
      error: () => this.message.error(this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  showImpact(calibration: QualityCalibration): void {
    this.api.getCalibrationImpact(calibration.id).subscribe({
      next: (response) => this.impact.set(response.data),
      error: () => this.message.error(this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }

  retire(instrument: QualityInstrument): void {
    this.api.retireInstrument(instrument.id).subscribe({
      next: () => this.load(),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('QUALITY.ACTION_ERROR')),
    });
  }
}
