import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AnalyticsApiService,
  AnalyticsDesignedReport,
  AnalyticsExportDelivery,
  AnalyticsExportFormat,
  AnalyticsExportFrequency,
  AnalyticsExportSchedule,
  AnalyticsSaveExportScheduleRequest,
  applyServerErrors,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { analyticsErrorText } from './analytics-designer.util';

/**
 * Scheduled exports of designed reports: daily, weekly or monthly, delivered by email (signed link), stored in the
 * Documents module or both. The schedule runs as the user who created it.
 */
@Component({
  selector: 'app-export-schedules',
  styleUrl: './analytics-pages.scss',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'ANALYTICS_BI.SCHEDULES_TITLE' | translate" [subtitle]="'ANALYTICS_BI.SCHEDULES_SUBTITLE' | translate">
      <button nz-button nzType="primary" type="button" (click)="openForm(null)" [disabled]="reports().length === 0">{{ 'ANALYTICS_BI.NEW_SCHEDULE' | translate }}</button>
    </app-page-header>

    @if (errorText(); as text) {
      <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
    }
    @if (!loadingReports() && reports().length === 0) {
      <nz-alert nzType="info" nzShowIcon class="block" [nzMessage]="'ANALYTICS_BI.SCHEDULES_NEED_REPORT' | translate"></nz-alert>
    }

    <nz-card class="block">
      <nz-table #table nzSize="small" [nzData]="schedules()" [nzLoading]="loading()" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'ANALYTICS_BI.REPORT' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.FREQUENCY' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.DELIVERY' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.NEXT_RUN' | translate }}</th>
            <th>{{ 'ANALYTICS_BI.LAST_RUN' | translate }}</th>
            <th>{{ 'COMMON.ACTIVE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (schedule of table.data; track schedule.id) {
            <tr>
              <td>{{ reportName(schedule.designed_report_id) }}</td>
              <td>{{ frequencyText(schedule) }}</td>
              <td>{{ ('ANALYTICS_BI.DELIVERY_' + schedule.delivery.toUpperCase()) | translate }} ({{ schedule.format }})</td>
              <td>{{ schedule.next_run_on ?? '-' }}</td>
              <td>
                @if (schedule.last_run_at) {
                  <nz-tag [nzColor]="schedule.last_status === 'ok' ? 'green' : 'red'">{{ schedule.last_run_at | date: 'short' }}</nz-tag>
                  @if (schedule.last_error) {
                    <span class="muted">{{ schedule.last_error }}</span>
                  }
                } @else {
                  -
                }
              </td>
              <td><nz-switch [ngModel]="schedule.is_active" (ngModelChange)="toggle(schedule, $event)" [attr.aria-label]="'COMMON.ACTIVE' | translate"></nz-switch></td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="link" type="button" (click)="openForm(schedule)">{{ 'ANALYTICS_BI.EDIT' | translate }}</button>
                  <button nz-button nzType="text" nzDanger type="button" nz-popconfirm [nzPopconfirmTitle]="'ANALYTICS_BI.DELETE_SCHEDULE_CONFIRM' | translate" (nzOnConfirm)="remove(schedule)" [attr.aria-label]="'COMMON.DELETE' | translate"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && schedules().length === 0) {
        <nz-empty [nzNotFoundContent]="'ANALYTICS_BI.NO_SCHEDULES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="formVisible" [nzTitle]="(editingId() ? 'ANALYTICS_BI.EDIT_SCHEDULE' : 'ANALYTICS_BI.NEW_SCHEDULE') | translate" [nzOkText]="'COMMON.SAVE' | translate" [nzCancelText]="'COMMON.CANCEL' | translate" [nzOkLoading]="saving()" [nzOkDisabled]="form.invalid" (nzOnOk)="save()" (nzOnCancel)="formVisible.set(false)">
      <ng-container *nzModalContent>
        @if (formError(); as text) {
          <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block"></nz-alert>
        }
        <form [formGroup]="form" nz-form nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="schedule-report">{{ 'ANALYTICS_BI.REPORT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="serverError('designed_report_id')">
              <nz-select id="schedule-report" formControlName="designed_report_id" nzShowSearch>
                @for (report of ownReports(); track report.id) {
                  <nz-option [nzValue]="report.id" [nzLabel]="report.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="schedule-frequency">{{ 'ANALYTICS_BI.FREQUENCY' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="serverError('frequency')">
              <nz-select id="schedule-frequency" formControlName="frequency">
                @for (frequency of frequencies; track frequency) {
                  <nz-option [nzValue]="frequency" [nzLabel]="('ANALYTICS_BI.FREQUENCY_' + frequency.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (form.controls.frequency.value === 'weekly') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="schedule-dow">{{ 'ANALYTICS_BI.DAY_OF_WEEK' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="serverError('day_of_week')">
                <nz-select id="schedule-dow" formControlName="day_of_week">
                  @for (day of weekDays; track day) {
                    <nz-option [nzValue]="day" [nzLabel]="('ANALYTICS_BI.WEEKDAY_' + day) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          @if (form.controls.frequency.value === 'monthly') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="schedule-dom">{{ 'ANALYTICS_BI.DAY_OF_MONTH' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="serverError('day_of_month')">
                <nz-input-number id="schedule-dom" formControlName="day_of_month" [nzMin]="1" [nzMax]="28"></nz-input-number>
              </nz-form-control>
            </nz-form-item>
          }
          <nz-form-item>
            <nz-form-label nzFor="schedule-format">{{ 'ANALYTICS_BI.FORMAT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select id="schedule-format" formControlName="format">
                @for (format of formats; track format) {
                  <nz-option [nzValue]="format" [nzLabel]="('ANALYTICS_BI.FORMAT_' + format.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="schedule-delivery">{{ 'ANALYTICS_BI.DELIVERY' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="serverError('delivery')">
              <nz-select id="schedule-delivery" formControlName="delivery">
                @for (delivery of deliveries; track delivery) {
                  <nz-option [nzValue]="delivery" [nzLabel]="('ANALYTICS_BI.DELIVERY_' + delivery.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (form.controls.delivery.value !== 'documents') {
            <nz-form-item>
              <nz-form-label nzRequired nzFor="schedule-recipients">{{ 'ANALYTICS_BI.RECIPIENTS' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="serverError('recipients')" [nzExtra]="'ANALYTICS_BI.RECIPIENTS_HINT' | translate">
                <nz-select id="schedule-recipients" formControlName="recipients" nzMode="tags" [nzTokenSeparators]="[',', ' ']" style="width: 100%"></nz-select>
              </nz-form-control>
            </nz-form-item>
          }
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label class="inline"><nz-switch formControlName="is_active"></nz-switch> {{ 'COMMON.ACTIVE' | translate }}</label>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ExportSchedulesComponent implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);

  readonly frequencies: AnalyticsExportFrequency[] = ['daily', 'weekly', 'monthly'];
  readonly deliveries: AnalyticsExportDelivery[] = ['email', 'documents', 'both'];
  readonly formats: AnalyticsExportFormat[] = ['csv', 'excel_csv', 'xlsx'];
  readonly weekDays = [1, 2, 3, 4, 5, 6, 7];

  readonly schedules = signal<AnalyticsExportSchedule[]>([]);
  readonly reports = signal<AnalyticsDesignedReport[]>([]);
  readonly loading = signal(false);
  readonly loadingReports = signal(false);
  readonly saving = signal(false);
  readonly errorText = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly formVisible = signal(false);
  readonly editingId = signal<string | null>(null);

  /** A schedule runs as its owner: only the reports the user owns can be scheduled. */
  readonly ownReports = computed(() => this.reports().filter((report) => report.is_owner));

  readonly form = this.fb.nonNullable.group({
    designed_report_id: ['', [Validators.required]],
    frequency: this.fb.nonNullable.control<AnalyticsExportFrequency>('daily', [Validators.required]),
    day_of_week: this.fb.control<number | null>(1),
    day_of_month: this.fb.control<number | null>(1),
    format: this.fb.nonNullable.control<AnalyticsExportFormat>('csv'),
    delivery: this.fb.nonNullable.control<AnalyticsExportDelivery>('documents', [Validators.required]),
    recipients: this.fb.nonNullable.control<string[]>([]),
    is_active: true,
  });

  ngOnInit(): void {
    this.load();
    this.loadingReports.set(true);
    this.api.getDesignedReports().subscribe({
      next: (response) => {
        this.reports.set(response.data);
        this.loadingReports.set(false);
      },
      error: () => this.loadingReports.set(false),
    });
  }

  serverError(path: string): string | undefined {
    const error = this.form.get(path)?.errors?.['serverError'];
    return typeof error === 'string' ? error : undefined;
  }

  reportName(id: string): string {
    return this.reports().find((report) => report.id === id)?.name ?? id;
  }

  frequencyText(schedule: AnalyticsExportSchedule): string {
    const base = this.translate.instant(`ANALYTICS_BI.FREQUENCY_${schedule.frequency.toUpperCase()}`);
    if (schedule.frequency === 'weekly' && schedule.day_of_week) {
      return `${base} (${this.translate.instant(`ANALYTICS_BI.WEEKDAY_${schedule.day_of_week}`)})`;
    }

    return schedule.frequency === 'monthly' && schedule.day_of_month ? `${base} (${schedule.day_of_month})` : base;
  }

  load(): void {
    this.loading.set(true);
    this.api.getExportSchedules().subscribe({
      next: (response) => {
        this.schedules.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
      },
    });
  }

  openForm(schedule: AnalyticsExportSchedule | null): void {
    this.formError.set(null);
    this.editingId.set(schedule?.id ?? null);
    this.form.reset({
      designed_report_id: schedule?.designed_report_id ?? '',
      frequency: schedule?.frequency ?? 'daily',
      day_of_week: schedule?.day_of_week ?? 1,
      day_of_month: schedule?.day_of_month ?? 1,
      format: schedule?.format ?? 'csv',
      delivery: schedule?.delivery ?? 'documents',
      recipients: schedule?.recipients ?? [],
      is_active: schedule?.is_active ?? true,
    });
    this.formVisible.set(true);
  }

  /** The FormRequest body: the day only for its frequency, the recipients only for a delivery that sends email. */
  payload(): AnalyticsSaveExportScheduleRequest {
    const value = this.form.getRawValue();

    return {
      designed_report_id: value.designed_report_id,
      frequency: value.frequency,
      day_of_week: value.frequency === 'weekly' ? value.day_of_week : null,
      day_of_month: value.frequency === 'monthly' ? value.day_of_month : null,
      format: value.format,
      delivery: value.delivery,
      recipients: value.delivery === 'documents' ? [] : value.recipients,
      is_active: value.is_active,
    };
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }

    const id = this.editingId();
    const request = id ? this.api.updateExportSchedule(id, this.payload()) : this.api.createExportSchedule(this.payload());

    this.saving.set(true);
    this.formError.set(null);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formVisible.set(false);
        this.message.success(this.translate.instant('ANALYTICS_BI.SCHEDULE_SAVED'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, error);
        this.formError.set(unmapped[0] ?? analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
      },
    });
  }

  toggle(schedule: AnalyticsExportSchedule, active: boolean): void {
    const payload: AnalyticsSaveExportScheduleRequest = {
      designed_report_id: schedule.designed_report_id,
      frequency: schedule.frequency,
      day_of_week: schedule.day_of_week,
      day_of_month: schedule.day_of_month,
      format: schedule.format,
      delivery: schedule.delivery,
      recipients: schedule.recipients,
      is_active: active,
    };

    this.api.updateExportSchedule(schedule.id, payload).subscribe({
      next: () => this.load(),
      error: (error: unknown) => {
        this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR'));
        this.load();
      },
    });
  }

  remove(schedule: AnalyticsExportSchedule): void {
    this.api.deleteExportSchedule(schedule.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('ANALYTICS_BI.SCHEDULE_DELETED'));
        this.load();
      },
      error: (error: unknown) => this.errorText.set(analyticsErrorText(error) ?? this.translate.instant('ANALYTICS_BI.ACTION_ERROR')),
    });
  }
}
