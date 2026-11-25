import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  ESIG_ENVELOPE_STATUSES,
  ESIG_JURISDICTIONS,
  ESIG_LEVELS,
  EsigDownloadKind,
  EsigEnvelope,
  EsigEnvelopeStatus,
  EsigJurisdiction,
  EsigLevel,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AuditTimelineDrawerComponent } from './audit-timeline-drawer.component';
import {
  daysLeft,
  ESIG_MODULE,
  EsigOutcome,
  envelopeStatusColor,
  isOpen,
  jurisdictionBadgeKey,
  levelColor,
  recipientStatusColor,
  signersProgress,
} from './e-signature.util';
import { SendForSignatureDrawerComponent } from './send-for-signature-drawer.component';
import { SignatureCenterStore } from './signature-center.store';

/**
 * The signature center: KPI cards (pending, completed this month, expiring soon, declined or failed), the filterable list of
 * signature envelopes with level and jurisdiction badges, the quick actions (remind, download the signed PDF and the
 * certificate of completion, void) and the audit trail drawer. A new request can start here from an uploaded file.
 */
@Component({
  selector: 'app-signature-center',
  imports: [
    DatePipe,
    FormsModule,
    AuditTimelineDrawerComponent,
    PageHeaderComponent,
    SendForSignatureDrawerComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  providers: [SignatureCenterStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.SIGNATURES_CENTER' | translate"></app-page-header>

    <div class="kpis" role="list">
      @for (kpi of kpis(); track kpi.key) {
        <nz-card class="kpi" role="listitem" [class.kpi-alert]="kpi.alert">
          <span class="kpi-value">{{ kpi.value }}</span>
          <span class="kpi-label">{{ 'signatures.center.kpi.' + kpi.key | translate }}</span>
        </nz-card>
      }
    </div>

    <div class="toolbar">
      <label class="field" for="esig-status">
        <span>{{ 'signatures.field.status' | translate }}</span>
        <nz-select
          nzId="esig-status"
          nzAllowClear
          [nzPlaceHolder]="'signatures.action.all' | translate"
          [ngModel]="store.filters().status || null"
          (ngModelChange)="store.setFilters({ status: $event ?? '' })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'signatures.status.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="esig-level">
        <span>{{ 'signatures.field.level' | translate }}</span>
        <nz-select
          nzId="esig-level"
          nzAllowClear
          [nzPlaceHolder]="'signatures.action.all' | translate"
          [ngModel]="store.filters().level || null"
          (ngModelChange)="store.setFilters({ level: $event ?? '' })"
        >
          @for (level of levels; track level) {
            <nz-option [nzValue]="level" [nzLabel]="level"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="esig-jurisdiction">
        <span>{{ 'signatures.field.jurisdiction' | translate }}</span>
        <nz-select
          nzId="esig-jurisdiction"
          nzAllowClear
          [nzPlaceHolder]="'signatures.action.all' | translate"
          [ngModel]="store.filters().jurisdiction || null"
          (ngModelChange)="store.setFilters({ jurisdiction: $event ?? '' })"
        >
          @for (jurisdiction of jurisdictions; track jurisdiction) {
            <nz-option
              [nzValue]="jurisdiction"
              [nzLabel]="jurisdictionBadgeKey(jurisdiction) | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field wide" for="esig-search">
        <span>{{ 'signatures.action.search' | translate }}</span>
        <input
          nz-input
          id="esig-search"
          type="search"
          [placeholder]="'signatures.center.searchHint' | translate"
          [ngModel]="store.filters().search ?? ''"
          (keyup.enter)="store.setFilters({ search: $any($event.target).value })"
        />
      </label>
      <button nz-button type="button" (click)="store.load()">
        {{ 'signatures.action.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="newOpen.set(true)">
          {{ 'signatures.action.newRequest' | translate }}
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
    @if (actionError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="error | translate"
        (nzOnClose)="actionError.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.envelopes()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'signatures.field.document' | translate }}</th>
            <th scope="col">{{ 'signatures.field.level' | translate }}</th>
            <th scope="col">{{ 'signatures.field.jurisdiction' | translate }}</th>
            <th scope="col">{{ 'signatures.field.status' | translate }}</th>
            <th scope="col">{{ 'signatures.field.signers' | translate }}</th>
            <th scope="col">{{ 'signatures.field.expires' | translate }}</th>
            <th scope="col">
              <span class="sr-only">{{ 'signatures.field.actions' | translate }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (envelope of table.data; track envelope.id) {
            <tr>
              <th scope="row">
                <div>{{ envelope.title }}</div>
                <div class="muted">
                  {{
                    'signatures.signableType.' + (envelope.signable_type ?? 'upload') | translate
                  }}
                  · {{ envelope.verification_code }}
                  @if (envelope.sandbox) {
                    <nz-tag nzColor="orange">{{ 'signatures.field.sandbox' | translate }}</nz-tag>
                  }
                </div>
              </th>
              <td>
                <nz-tag [nzColor]="levelColor(envelope.required_level)">{{
                  envelope.required_level
                }}</nz-tag>
              </td>
              <td>{{ jurisdictionBadgeKey(envelope.jurisdiction) | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(envelope.status)">{{
                  'signatures.status.' + envelope.status | translate
                }}</nz-tag>
              </td>
              <td>
                <span nz-tooltip [nzTooltipTitle]="recipientsHint(envelope)" class="progress">
                  {{ progress(envelope).signed }}/{{ progress(envelope).total }}
                </span>
                @for (recipient of envelope.recipients ?? []; track recipient.id) {
                  <nz-tag class="mini" [nzColor]="recipientColor(recipient.status)">{{
                    recipient.full_name
                  }}</nz-tag>
                }
              </td>
              <td>
                @if (envelope.expires_at) {
                  {{ envelope.expires_at | date: 'dd.MM.yyyy' }}
                  @if (
                    open(envelope.status) &&
                    left(envelope.expires_at) !== null &&
                    left(envelope.expires_at)! <= 3
                  ) {
                    <nz-tag nzColor="volcano">{{
                      'signatures.center.daysLeft' | translate: { days: left(envelope.expires_at) }
                    }}</nz-tag>
                  }
                }
              </td>
              <td class="actions">
                <button nz-button nzSize="small" type="button" (click)="store.openAudit(envelope)">
                  {{ 'signatures.action.auditTrail' | translate }}
                </button>
                @if (canWrite && open(envelope.status)) {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="busy(envelope.id)"
                    (click)="remind(envelope)"
                  >
                    {{ 'signatures.action.remind' | translate }}
                  </button>
                }
                @if (envelope.status === 'completed') {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="busy(envelope.id)"
                    (click)="download(envelope, 'signed')"
                  >
                    {{ 'signatures.action.downloadSigned' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [disabled]="busy(envelope.id)"
                    (click)="download(envelope, 'certificate')"
                  >
                    {{ 'signatures.action.downloadCertificate' | translate }}
                  </button>
                }
                @if (canWrite && (open(envelope.status) || envelope.status === 'draft')) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'signatures.center.confirmVoid' | translate"
                    [nzOkText]="'signatures.action.void' | translate"
                    [nzCancelText]="'signatures.action.cancel' | translate"
                    [disabled]="busy(envelope.id)"
                    (nzOnConfirm)="voidEnvelope(envelope)"
                  >
                    {{ 'signatures.action.void' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.envelopes().length === 0) {
        <nz-empty [nzNotFoundContent]="'signatures.center.empty' | translate"></nz-empty>
      }
    </nz-spin>

    <app-audit-timeline-drawer></app-audit-timeline-drawer>

    @if (canWrite) {
      <app-send-for-signature-drawer
        signableType="upload"
        [open]="newOpen()"
        (closed)="newOpen.set(false)"
        (created)="onCreated()"
      ></app-send-for-signature-drawer>
    }
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .kpi {
      text-align: center;
    }

    .kpi-value {
      display: block;
      font-size: 28px;
      font-weight: 600;
    }

    .kpi-label {
      color: var(--ant-color-text-secondary, #6b7280);
    }

    .kpi-alert .kpi-value {
      color: var(--ant-color-error, #cf1322);
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 160px;
    }

    .wide {
      min-width: 240px;
    }

    .feedback {
      margin-bottom: 16px;
    }

    .muted {
      color: var(--ant-color-text-secondary, #6b7280);
      font-size: 12px;
      font-weight: 400;
    }

    .progress {
      font-weight: 600;
      margin-right: 6px;
    }

    .mini {
      margin-bottom: 2px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class SignatureCenterComponent implements OnInit {
  protected readonly store = inject(SignatureCenterStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  protected readonly canWrite = inject(PermissionsService).canWrite(ESIG_MODULE);

  protected readonly statuses: readonly EsigEnvelopeStatus[] = ESIG_ENVELOPE_STATUSES;
  protected readonly levels: readonly EsigLevel[] = ESIG_LEVELS;
  protected readonly jurisdictions: readonly EsigJurisdiction[] = ESIG_JURISDICTIONS;
  protected readonly newOpen = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly jurisdictionBadgeKey = jurisdictionBadgeKey;
  protected readonly levelColor = levelColor;
  protected readonly statusColor = envelopeStatusColor;
  protected readonly recipientColor = recipientStatusColor;
  protected readonly progress = signersProgress;
  protected readonly open = isOpen;
  protected readonly left = (iso: string | null) => daysLeft(iso);

  protected readonly kpis = () => {
    const dashboard = this.store.dashboard();
    return [
      { key: 'pending', value: dashboard?.pending ?? 0, alert: false },
      { key: 'completedThisMonth', value: dashboard?.completed_this_month ?? 0, alert: false },
      {
        key: 'expiringSoon',
        value: dashboard?.expiring_soon ?? 0,
        alert: (dashboard?.expiring_soon ?? 0) > 0,
      },
      {
        key: 'declinedOrFailed',
        value: dashboard?.declined_or_failed ?? 0,
        alert: (dashboard?.declined_or_failed ?? 0) > 0,
      },
    ];
  };

  ngOnInit(): void {
    void this.store.init();
  }

  protected busy(id: string): boolean {
    return this.store.busy().includes(id);
  }

  protected recipientsHint(envelope: EsigEnvelope): string {
    return (envelope.recipients ?? [])
      .map(
        (recipient) =>
          `${recipient.full_name}: ${this.i18n.instant('signatures.recipientStatus.' + recipient.status)}`,
      )
      .join('\n');
  }

  protected async remind(envelope: EsigEnvelope): Promise<void> {
    this.report(await this.store.remind(envelope.id), 'signatures.message.reminded');
  }

  protected async voidEnvelope(envelope: EsigEnvelope): Promise<void> {
    this.report(await this.store.voidEnvelope(envelope.id, null), 'signatures.message.voided');
  }

  protected async download(envelope: EsigEnvelope, kind: EsigDownloadKind): Promise<void> {
    this.report(await this.store.download(envelope, kind), null);
  }

  protected onCreated(): void {
    this.newOpen.set(false);
    void this.store.load();
  }

  private report(outcome: EsigOutcome, successKey: string | null): void {
    if (outcome.ok) {
      this.actionError.set(null);
      if (successKey !== null) {
        this.message.success(this.i18n.instant(successKey));
      }
      return;
    }
    this.actionError.set(outcome.errorKey);
  }
}
