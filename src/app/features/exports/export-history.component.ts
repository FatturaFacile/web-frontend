import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import {
  ExportJob,
  ExportJobDataset,
  ExportJobStatus,
  ExportSchedule,
  ExportSchedulePayload,
  ExportsApiService,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { tap } from 'rxjs';
import {
  ActionFormComponent,
  ActionFormConfig,
} from '../hr/shared/action-form/action-form.component';
import { reportHttpError } from '../hr/shared/hr-http.util';

const JOB_DATASETS: ExportJobDataset[] = [
  'invoices',
  'purchases',
  'payments',
  'contacts',
  'accountant_archive',
];
const POLL_MS = 3000;

const STATUS_COLORS: Record<ExportJobStatus, string> = {
  queued: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
};

/** The asynchronous exports: request one, follow its status in the history, download it by signed link, retry a failure, and the recurring schedules. */
@Component({
  selector: 'app-export-history',
  styles: ['.export-error { margin-left: var(--space-2); color: var(--text-secondary); }', 'p { margin-bottom: var(--space-3); color: var(--text-secondary); }'],
  imports: [
    ActionFormComponent,
    DatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'exportsPage.queueTitle' | translate" class="mb-3">
      <p>{{ 'exportsPage.queueHint' | translate }}</p>
      <app-action-form [config]="queueConfig" [canWrite]="canWrite()" />
    </nz-card>

    <nz-card [nzTitle]="'exportsPage.historyTitle' | translate" class="mb-3">
      <button nz-button type="button" class="mb-3" (click)="loadJobs()">
        {{ 'exportsPage.refresh' | translate }}
      </button>
      <nz-table #jobsTable nzSize="small" [nzData]="jobs()" [nzLoading]="loading()" [nzPageSize]="10">
        <thead>
          <tr>
            <th>{{ 'exportsPage.dataset' | translate }}</th>
            <th>{{ 'exportsPage.period' | translate }}</th>
            <th>{{ 'exportsPage.status' | translate }}</th>
            <th>{{ 'exportsPage.rows' | translate }}</th>
            <th>{{ 'exportsPage.requestedAt' | translate }}</th>
            <th>{{ 'exportsPage.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (job of jobsTable.data; track job.id) {
            <tr>
              <td>{{ 'exportsPage.datasets.' + job.dataset | translate }}</td>
              <td>{{ job.period_from ?? '-' }} / {{ job.period_to ?? '-' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(job.status)">{{ 'exportsPage.statuses.' + job.status | translate }}</nz-tag>
                @if (job.error) {
                  <span class="export-error">{{ job.error }}</span>
                }
              </td>
              <td>{{ job.row_count ?? '-' }}</td>
              <td>{{ job.created_at | date: 'short' }}</td>
              <td>
                @if (job.is_downloadable) {
                  <button nz-button nzSize="small" type="button" (click)="download(job)">
                    {{ 'exportsPage.download' | translate }}
                  </button>
                }
                @if (job.status === 'failed' && canWrite()) {
                  <button nz-button nzSize="small" type="button" (click)="retry(job)">
                    {{ 'exportsPage.retry' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && jobs().length === 0) {
        <nz-empty [nzNotFoundContent]="'exportsPage.historyEmpty' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card [nzTitle]="'exportsPage.schedulesTitle' | translate" class="mb-3">
      <p>{{ 'exportsPage.schedulesHint' | translate }}</p>
      <app-action-form [config]="scheduleConfig" [canWrite]="canWrite()" />
      <nz-table #schedulesTable nzSize="small" [nzData]="schedules()" [nzShowPagination]="false" class="mt-3">
        <thead>
          <tr>
            <th>{{ 'exportsPage.dataset' | translate }}</th>
            <th>{{ 'exportsPage.frequency' | translate }}</th>
            <th>{{ 'exportsPage.period' | translate }}</th>
            <th>{{ 'exportsPage.nextRun' | translate }}</th>
            <th>{{ 'exportsPage.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (schedule of schedulesTable.data; track schedule.id) {
            <tr>
              <td>{{ 'exportsPage.datasets.' + schedule.dataset | translate }}</td>
              <td>{{ 'exportsPage.frequencies.' + schedule.frequency | translate }}</td>
              <td>{{ 'exportsPage.periods.' + schedule.period | translate }}</td>
              <td>{{ schedule.is_active ? (schedule.next_run_on ?? '-') : ('exportsPage.paused' | translate) }}</td>
              <td>
                @if (canWrite()) {
                  <button nz-button nzSize="small" type="button" (click)="toggle(schedule)">
                    {{ (schedule.is_active ? 'exportsPage.pause' : 'exportsPage.resume') | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'exportsPage.deleteConfirm' | translate"
                    (nzOnConfirm)="remove(schedule)"
                  >
                    {{ 'exportsPage.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ExportHistoryComponent implements OnInit {
  private readonly api = inject(ExportsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canWrite = input(false);

  protected readonly jobs = signal<ExportJob[]>([]);
  protected readonly schedules = signal<ExportSchedule[]>([]);
  protected readonly loading = signal(false);

  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly queueConfig: ActionFormConfig = {
    submitLabelKey: 'exportsPage.queue',
    successKey: 'exportsPage.queued',
    resetOnSuccess: true,
    fields: [
      {
        key: 'dataset',
        labelKey: 'exportsPage.dataset',
        type: 'select',
        required: true,
        defaultValue: 'invoices',
        options: () => JOB_DATASETS.map((value) => ({ value, labelKey: `exportsPage.datasets.${value}` })),
      },
      { key: 'from', labelKey: 'hrmCommon.from', type: 'date', requiredWhen: (v) => v['dataset'] === 'accountant_archive' },
      { key: 'to', labelKey: 'hrmCommon.to', type: 'date', notBefore: 'from', requiredWhen: (v) => v['dataset'] === 'accountant_archive' },
    ],
    submit: (payload) =>
      this.api
        .createJob({
          dataset: payload['dataset'] as ExportJobDataset,
          from: (payload['from'] as string | undefined) || null,
          to: (payload['to'] as string | undefined) || null,
        })
        .pipe(tap(() => this.loadJobs())),
  };

  protected readonly scheduleConfig: ActionFormConfig = {
    submitLabelKey: 'exportsPage.scheduleSubmit',
    successKey: 'exportsPage.scheduleCreated',
    fields: [
      {
        key: 'dataset',
        labelKey: 'exportsPage.dataset',
        type: 'select',
        required: true,
        defaultValue: 'invoices',
        options: () => JOB_DATASETS.map((value) => ({ value, labelKey: `exportsPage.datasets.${value}` })),
      },
      {
        key: 'frequency',
        labelKey: 'exportsPage.frequency',
        type: 'select',
        required: true,
        defaultValue: 'monthly',
        options: () => ['daily', 'weekly', 'monthly'].map((value) => ({ value, labelKey: `exportsPage.frequencies.${value}` })),
      },
      {
        key: 'period',
        labelKey: 'exportsPage.period',
        type: 'select',
        required: true,
        defaultValue: 'previous_month',
        options: () => ['all', 'previous_month', 'year_to_date'].map((value) => ({ value, labelKey: `exportsPage.periods.${value}` })),
      },
    ],
    submit: (payload) =>
      this.api.createSchedule(payload as unknown as ExportSchedulePayload).pipe(tap(() => this.loadSchedules())),
  };

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopPolling());
    this.loadJobs();
    this.loadSchedules();
  }

  protected statusColor(status: ExportJobStatus): string {
    return STATUS_COLORS[status];
  }

  loadJobs(): void {
    this.stopPolling();
    this.loading.set(true);
    this.api.listJobs().subscribe({
      next: (response) => {
        this.jobs.set(response.data);
        this.loading.set(false);
        if (response.data.some((job) => job.status === 'queued' || job.status === 'running')) {
          this.pollTimer = setTimeout(() => this.loadJobs(), POLL_MS);
        }
      },
      error: (error: unknown) => {
        this.loading.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  loadSchedules(): void {
    this.api.listSchedules().subscribe({
      next: (response) => this.schedules.set(response.data),
      error: (error: unknown) => reportHttpError(error, this.message, this.i18n),
    });
  }

  protected download(job: ExportJob): void {
    this.api.getJobLink(job.id).subscribe({
      next: (response) => window.open(response.data.url, '_blank', 'noopener'),
      error: (error: unknown) => {
        reportHttpError(error, this.message, this.i18n);
        this.loadJobs();
      },
    });
  }

  protected retry(job: ExportJob): void {
    this.api.retryJob(job.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('exportsPage.queued'));
        this.loadJobs();
      },
      error: (error: unknown) => reportHttpError(error, this.message, this.i18n),
    });
  }

  protected toggle(schedule: ExportSchedule): void {
    this.api
      .updateSchedule(schedule.id, {
        dataset: schedule.dataset,
        frequency: schedule.frequency,
        period: schedule.period,
        is_active: !schedule.is_active,
      })
      .subscribe({
        next: () => this.loadSchedules(),
        error: (error: unknown) => reportHttpError(error, this.message, this.i18n),
      });
  }

  protected remove(schedule: ExportSchedule): void {
    this.api.deleteSchedule(schedule.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('exportsPage.scheduleDeleted'));
        this.loadSchedules();
      },
      error: (error: unknown) => reportHttpError(error, this.message, this.i18n),
    });
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
