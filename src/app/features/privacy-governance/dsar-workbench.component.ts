import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  I18nService,
  PgDsar,
  PgDsarRequestType,
  PgDsarStatus,
  PgDsarSubjectType,
  PgErasurePreview,
  PrivacyGovernanceApiService,
} from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { pollDsarPackage } from './dsar-package-poll';
import { ErasurePreviewComponent } from './erasure-preview.component';
import {
  DSAR_TOTAL_DAYS,
  dsarCountdown,
  dsarElapsedPercent,
  dsarIsUrgent,
  dsarProgressStatus,
  dsarStatusColor,
  isDsarClosed,
  pgErrorMessage,
} from './privacy-governance.helpers';

export const PG_DSAR_STATUSES: readonly PgDsarStatus[] = [
  'open',
  'identity_verified',
  'in_progress',
  'completed',
  'partially_refused_fiscal_retention',
  'rejected',
];
export const PG_DSAR_SUBJECT_TYPES: readonly PgDsarSubjectType[] = [
  'customer_contact',
  'employee',
  'candidate',
  'lead',
  'supplier_contact',
];
export const PG_DSAR_REQUEST_TYPES: readonly PgDsarRequestType[] = [
  'access_portability',
  'rectification',
  'erasure',
  'restriction',
  'objection',
];
export const PG_IDENTITY_METHODS: readonly string[] = [
  'id_document',
  'email_confirmation',
  'in_person',
  'strong_authentication',
];

/** Data subject requests: 30-day countdown, identity check, portability package and right to be forgotten. */
@Component({
  selector: 'app-dsar-workbench',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    ErasurePreviewComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .toolbar nz-select {
      min-width: 220px;
    }
    .panel {
      margin-top: 16px;
    }
    .panel-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0;
    }
    .urgent {
      color: var(--ff-color-danger, #cf1322);
      font-weight: 600;
    }
  `,
  template: `
    <app-page-header
      [title]="'PRIVACY.DSAR.TITLE' | translate"
      [subtitle]="'PRIVACY.DSAR.SUBTITLE' | translate"
    >
      <button nz-button nzType="primary" (click)="openCreate()">
        {{ 'PRIVACY.DSAR.NEW' | translate }}
      </button>
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <nz-select
          [ngModel]="statusFilter()"
          (ngModelChange)="statusFilter.set($event); load()"
          nzAllowClear
          [nzPlaceHolder]="'PRIVACY.DSAR.STATUS' | translate"
          [attr.aria-label]="'PRIVACY.DSAR.STATUS' | translate"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'PRIVACY.DSAR_STATUS.' + status | translate" />
          }
        </nz-select>
      </div>

      <nz-table
        #table
        [nzData]="items()"
        [nzLoading]="loading()"
        nzSize="middle"
        [nzShowPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'PRIVACY.DSAR.NUMBER' | translate }}</th>
            <th>{{ 'PRIVACY.DSAR.SUBJECT' | translate }}</th>
            <th>{{ 'PRIVACY.DSAR.REQUEST_TYPE' | translate }}</th>
            <th>{{ 'PRIVACY.DSAR.COUNTDOWN' | translate }}</th>
            <th>{{ 'PRIVACY.DSAR.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.request_number }}</td>
              <td>
                {{ row.subject_full_name }}
                <div>
                  <small>{{ row.subject_email }}</small>
                </div>
              </td>
              <td>{{ 'PRIVACY.DSAR_TYPE.' + row.request_type | translate }}</td>
              <td style="min-width: 200px">
                <nz-progress
                  [nzPercent]="percentOf(row)"
                  nzSize="small"
                  [nzStatus]="progressStatusOf(row)"
                  [nzFormat]="noFormat"
                />
                @let days = daysOf(row);
                @if (days !== null) {
                  <small [class.urgent]="isUrgent(days)">
                    {{
                      (days < 0 ? 'PRIVACY.DSAR.OVERDUE' : 'PRIVACY.DSAR.DAYS_LEFT')
                        | translate: { days: days < 0 ? -days : days }
                    }}
                  </small>
                } @else if (isClosed(row)) {
                  <small>{{ 'PRIVACY.DSAR.CLOSED' | translate }}</small>
                }
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{
                  'PRIVACY.DSAR_STATUS.' + row.status | translate
                }}</nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" (click)="openDetail(row)">
                  {{ 'PRIVACY.DSAR.OPEN' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="6">{{ 'PRIVACY.DSAR.EMPTY' | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="detailOpen()"
      nzWidth="720"
      [nzTitle]="selected()?.request_number ?? ''"
      (nzOnClose)="closeDetail()"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as dsar) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'PRIVACY.DSAR.SUBJECT' | translate">
              {{ dsar.subject_full_name }} ({{ dsar.subject_email }})
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PRIVACY.DSAR.REQUEST_TYPE' | translate">
              {{ 'PRIVACY.DSAR_TYPE.' + dsar.request_type | translate }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PRIVACY.DSAR.RECEIVED' | translate">
              {{ dsar.received_at | date: 'medium' }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PRIVACY.DSAR.DEADLINE' | translate">
              {{ dsar.statutory_deadline_at | date: 'mediumDate' }}
              @if (dsar.deadline_extended) {
                <nz-tag nzColor="blue">{{ 'PRIVACY.DSAR.EXTENDED' | translate }}</nz-tag>
              }
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'PRIVACY.DSAR.STATUS' | translate">
              <nz-tag [nzColor]="statusColor(dsar.status)">{{
                'PRIVACY.DSAR_STATUS.' + dsar.status | translate
              }}</nz-tag>
            </nz-descriptions-item>
          </nz-descriptions>

          @if (dsar.refusal_legal_justification) {
            <nz-alert
              class="panel"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'PRIVACY.ERASURE.REFUSAL' | translate"
              [nzDescription]="dsar.refusal_legal_justification"
            />
          }

          <nz-card class="panel" [nzTitle]="'PRIVACY.DSAR.IDENTITY' | translate" nzSize="small">
            @if (dsar.identity_verified_at) {
              <nz-tag nzColor="green">{{ 'PRIVACY.DSAR.IDENTITY_VERIFIED' | translate }}</nz-tag>
              {{ dsar.identity_verified_at | date: 'medium' }}
            } @else {
              <div class="panel-actions">
                <nz-select
                  style="min-width: 240px"
                  [ngModel]="identityMethod()"
                  (ngModelChange)="identityMethod.set($event)"
                  [attr.aria-label]="'PRIVACY.DSAR.IDENTITY_METHOD' | translate"
                >
                  @for (method of identityMethods; track method) {
                    <nz-option
                      [nzValue]="method"
                      [nzLabel]="'PRIVACY.IDENTITY_METHOD.' + method | translate"
                    />
                  }
                </nz-select>
                <button
                  nz-button
                  nzType="primary"
                  [nzLoading]="busy() === 'verify'"
                  (click)="verifyIdentity(dsar)"
                >
                  {{ 'PRIVACY.DSAR.VERIFY' | translate }}
                </button>
              </div>
            }
          </nz-card>

          @if (dsar.request_type === 'access_portability') {
            <nz-card
              class="panel"
              [nzTitle]="'PRIVACY.DSAR.PORTABILITY' | translate"
              nzSize="small"
            >
              <p>{{ 'PRIVACY.DSAR.PORTABILITY_HINT' | translate }}</p>
              <div class="panel-actions">
                <button
                  nz-button
                  nzType="primary"
                  [nzLoading]="polling()"
                  [disabled]="!dsar.identity_verified_at"
                  (click)="generatePackage(dsar)"
                >
                  {{ 'PRIVACY.DSAR.GENERATE_PACKAGE' | translate }}
                </button>
                @if (dsar.package_status === 'ready') {
                  <button nz-button (click)="downloadPackage(dsar)">
                    {{ 'PRIVACY.DSAR.DOWNLOAD_PACKAGE' | translate }}
                  </button>
                }
              </div>
              @if (dsar.package_status) {
                <nz-tag
                  [nzColor]="
                    dsar.package_status === 'ready'
                      ? 'green'
                      : dsar.package_status === 'failed'
                        ? 'red'
                        : 'blue'
                  "
                >
                  {{ 'PRIVACY.PACKAGE_STATUS.' + dsar.package_status | translate }}
                </nz-tag>
              }
            </nz-card>
          }

          @if (dsar.request_type === 'erasure') {
            <nz-card class="panel" [nzTitle]="'PRIVACY.ERASURE.TITLE' | translate" nzSize="small">
              <p>{{ 'PRIVACY.ERASURE.HINT' | translate }}</p>
              <div class="panel-actions">
                <button nz-button [nzLoading]="busy() === 'dry'" (click)="dryRun(dsar)">
                  {{ 'PRIVACY.ERASURE.DRY_RUN' | translate }}
                </button>
                <button
                  nz-button
                  nzDanger
                  nzType="primary"
                  [disabled]="!erasurePreview()"
                  [nzLoading]="busy() === 'erase'"
                  (click)="confirmErasure(dsar)"
                >
                  {{ 'PRIVACY.ERASURE.EXECUTE' | translate }}
                </button>
              </div>
              @if (erasurePreview(); as preview) {
                <app-erasure-preview [preview]="preview" />
              }
            </nz-card>
          }
        }
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="createOpen()"
      [nzTitle]="'PRIVACY.DSAR.NEW' | translate"
      [nzOkText]="'PRIVACY.COMMON.SAVE' | translate"
      [nzCancelText]="'PRIVACY.COMMON.CANCEL' | translate"
      [nzOkLoading]="busy() === 'create'"
      [nzOkDisabled]="createForm.invalid"
      (nzOnOk)="create()"
      (nzOnCancel)="createOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="createForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRIVACY.DSAR.SUBJECT_NAME' | translate }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="createForm.controls.subject_full_name.errors?.['serverError']"
            >
              <input nz-input formControlName="subject_full_name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRIVACY.DSAR.SUBJECT_EMAIL' | translate }}</nz-form-label>
            <nz-form-control
              [nzErrorTip]="createForm.controls.subject_email.errors?.['serverError']"
            >
              <input nz-input type="email" formControlName="subject_email" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRIVACY.DSAR.SUBJECT_TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="subject_type">
                @for (type of subjectTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'PRIVACY.SUBJECT_TYPE.' + type | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRIVACY.DSAR.REQUEST_TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="request_type">
                @for (type of requestTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="'PRIVACY.DSAR_TYPE.' + type | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PRIVACY.DSAR.NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input rows="3" formControlName="audit_notes"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class DsarWorkbenchComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = PG_DSAR_STATUSES;
  readonly subjectTypes = PG_DSAR_SUBJECT_TYPES;
  readonly requestTypes = PG_DSAR_REQUEST_TYPES;
  readonly identityMethods = PG_IDENTITY_METHODS;
  readonly totalDays = DSAR_TOTAL_DAYS;

  readonly items = signal<PgDsar[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<PgDsarStatus | null>(null);
  readonly selected = signal<PgDsar | null>(null);
  readonly detailOpen = signal(false);
  readonly createOpen = signal(false);
  readonly busy = signal<'verify' | 'dry' | 'erase' | 'create' | null>(null);
  readonly polling = signal(false);
  readonly identityMethod = signal<string>('id_document');
  readonly erasurePreview = signal<PgErasurePreview | null>(null);

  private pollSubscription: Subscription | null = null;

  readonly noFormat = (): string => '';
  readonly isClosed = (row: PgDsar): boolean => isDsarClosed(row.status);
  readonly isUrgent = dsarIsUrgent;
  readonly statusColor = dsarStatusColor;
  readonly daysOf = (row: PgDsar): number | null => dsarCountdown(row);
  readonly percentOf = (row: PgDsar): number =>
    isDsarClosed(row.status) ? 100 : dsarElapsedPercent(row.received_at, row.statutory_deadline_at);
  readonly progressStatusOf = (row: PgDsar) => dsarProgressStatus(this.daysOf(row));

  readonly createForm = this.fb.group({
    subject_full_name: ['', Validators.required],
    subject_email: ['', [Validators.required, Validators.email]],
    subject_type: ['customer_contact' as PgDsarSubjectType, Validators.required],
    request_type: ['access_portability' as PgDsarRequestType, Validators.required],
    audit_notes: [''],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.pollSubscription?.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getDsars({ status: this.statusFilter() ?? '', per_page: 100 }).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED')));
      },
    });
  }

  openDetail(row: PgDsar): void {
    this.selected.set(row);
    this.erasurePreview.set(null);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.pollSubscription?.unsubscribe();
    this.polling.set(false);
    this.detailOpen.set(false);
  }

  openCreate(): void {
    this.createForm.reset();
    this.createOpen.set(true);
  }

  create(): void {
    if (this.createForm.invalid) {
      return;
    }
    const raw = this.createForm.getRawValue();
    this.busy.set('create');
    this.api.createDsar({ ...raw, audit_notes: raw.audit_notes.trim() || null }).subscribe({
      next: () => {
        this.busy.set(null);
        this.createOpen.set(false);
        this.message.success(this.i18n.translate('PRIVACY.COMMON.SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(null);
        applyServerErrors(this.createForm, err);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  verifyIdentity(dsar: PgDsar): void {
    this.busy.set('verify');
    this.api.verifyIdentity(dsar.id, this.identityMethod()).subscribe({
      next: ({ data }) => {
        this.busy.set(null);
        this.replace(data);
        this.message.success(this.i18n.translate('PRIVACY.DSAR.IDENTITY_DONE'));
      },
      error: (err: unknown) => {
        this.busy.set(null);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  generatePackage(dsar: PgDsar): void {
    this.polling.set(true);
    this.api.generatePackage(dsar.id).subscribe({
      next: ({ data }) => {
        this.replace(data);
        this.startPolling(dsar.id);
      },
      error: (err: unknown) => {
        this.polling.set(false);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  downloadPackage(dsar: PgDsar): void {
    this.api.downloadPackage(dsar.id).subscribe({
      next: (blob) => downloadBlob(blob, `${dsar.request_number}.zip`),
      error: (err: unknown) =>
        this.message.error(
          pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.EXPORT_FAILED')),
        ),
    });
  }

  dryRun(dsar: PgDsar): void {
    this.busy.set('dry');
    this.api.executeErasure(dsar.id, true).subscribe({
      next: ({ data }) => {
        this.busy.set(null);
        this.erasurePreview.set(data);
      },
      error: (err: unknown) => {
        this.busy.set(null);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  /** The real erasure is irreversible: it always goes through an explicit confirmation. */
  confirmErasure(dsar: PgDsar): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('PRIVACY.ERASURE.CONFIRM_TITLE'),
      nzContent: this.i18n.translate('PRIVACY.ERASURE.CONFIRM_BODY', {
        request: dsar.request_number,
      }),
      nzOkText: this.i18n.translate('PRIVACY.ERASURE.CONFIRM_OK'),
      nzOkDanger: true,
      nzCancelText: this.i18n.translate('PRIVACY.COMMON.CANCEL'),
      nzOnOk: () => this.executeErasure(dsar),
    });
  }

  private executeErasure(dsar: PgDsar): void {
    this.busy.set('erase');
    this.api.executeErasure(dsar.id, false).subscribe({
      next: ({ data }) => {
        this.busy.set(null);
        this.erasurePreview.set(data);
        this.message.success(this.i18n.translate('PRIVACY.ERASURE.DONE'));
        this.api.getDsar(dsar.id).subscribe({ next: (response) => this.replace(response.data) });
      },
      error: (err: unknown) => {
        this.busy.set(null);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.SAVE_FAILED')));
      },
    });
  }

  private startPolling(id: string): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = pollDsarPackage(() => this.api.getDsar(id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dsar) => {
          this.replace(dsar);
          if (dsar.package_status === 'ready') {
            this.polling.set(false);
            this.message.success(this.i18n.translate('PRIVACY.DSAR.PACKAGE_READY'));
            this.downloadPackage(dsar);
          } else if (dsar.package_status === 'failed') {
            this.polling.set(false);
            this.message.error(this.i18n.translate('PRIVACY.DSAR.PACKAGE_FAILED'));
          }
        },
        error: (err: unknown) => {
          this.polling.set(false);
          this.message.error(
            pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED')),
          );
        },
      });
  }

  private replace(updated: PgDsar): void {
    this.items.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    if (this.selected()?.id === updated.id) {
      this.selected.set(updated);
    }
  }
}
