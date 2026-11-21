import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AUDIT_EVENT_TYPES,
  AuditEventType,
  AuditLogDetail,
  AuditLogEntry,
  AuditTrailApiService,
  AuditVerificationCertificate,
} from '@core';
import { TranslatePipe } from '@shared';
import { formatMicroTimestamp, eventLabelKey } from '../audit-trail/audit-presentation';
import { AuditDiffViewerComponent } from './audit-diff-viewer.component';
import {
  AUDIT_SEVERITIES,
  AuditSeverity,
  auditSeverity,
  buildAuditFilters,
  filterBySeverity,
  severityTagColor,
} from './audit-explorer.helpers';

const PAGE_SIZE = 25;

/**
 * Audit Trail Explorer of the Security Center: the filterable ledger, the side-by-side diff of the selected record,
 * its hash inspector (sequence number, previous hash, record hash) and the "Verify chain now" action.
 */
@Component({
  selector: 'app-security-audit-explorer',
  styleUrl: './security-center.scss',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
    AuditDiffViewerComponent,
  ],
  template: `
    <nz-alert
      class="banner"
      nzShowIcon
      [nzType]="bannerType()"
      [nzMessage]="bannerKey() | translate"
      [nzDescription]="bannerBody"
    ></nz-alert>
    <ng-template #bannerBody>
      @if (certificate(); as cert) {
        <span class="mono" data-testid="verified-at">{{ cert.verifiedAt }}</span>
        <span> · {{ 'SECURITY_CENTER.AUDIT.CHECKED' | translate }}: {{ cert.checkedRecords }}</span>
        @if (!cert.isValid) {
          <span data-testid="broken-at">
            · {{ 'SECURITY_CENTER.AUDIT.BROKEN_AT' | translate }}: {{ cert.brokenAtSequence }}
          </span>
        }
      }
      <div>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="verify-chain"
          [disabled]="verifying()"
          (click)="verifyChain()"
        >
          {{ 'SECURITY_CENTER.AUDIT.VERIFY_NOW' | translate }}
        </button>
      </div>
    </ng-template>

    <nz-card>
      <form class="toolbar" role="search" [formGroup]="filters" (ngSubmit)="apply()">
        <nz-range-picker
          nzShowTime
          formControlName="range"
          [attr.aria-label]="'SECURITY_CENTER.AUDIT.DATE_RANGE' | translate"
        ></nz-range-picker>
        <input
          nz-input
          style="width: 200px"
          formControlName="actorId"
          [placeholder]="'SECURITY_CENTER.AUDIT.ACTOR' | translate"
          [attr.aria-label]="'SECURITY_CENTER.AUDIT.ACTOR' | translate"
        />
        <input
          nz-input
          style="width: 160px"
          formControlName="entityType"
          [placeholder]="'SECURITY_CENTER.AUDIT.ENTITY_TYPE' | translate"
          [attr.aria-label]="'SECURITY_CENTER.AUDIT.ENTITY_TYPE' | translate"
        />
        <input
          nz-input
          style="width: 220px"
          formControlName="entityId"
          [placeholder]="'SECURITY_CENTER.AUDIT.ENTITY_ID' | translate"
          [attr.aria-label]="'SECURITY_CENTER.AUDIT.ENTITY_ID' | translate"
        />
        <nz-select
          style="min-width: 200px"
          nzMode="multiple"
          nzAllowClear
          formControlName="actions"
          [nzPlaceHolder]="'SECURITY_CENTER.AUDIT.ACTION' | translate"
        >
          @for (type of eventTypes; track type) {
            <nz-option [nzValue]="type" [nzLabel]="eventLabel(type) | translate"></nz-option>
          }
        </nz-select>
        <nz-select
          style="min-width: 160px"
          nzMode="multiple"
          nzAllowClear
          formControlName="severities"
          [nzPlaceHolder]="'SECURITY_CENTER.AUDIT.SEVERITY' | translate"
        >
          @for (severity of severities; track severity) {
            <nz-option
              [nzValue]="severity"
              [nzLabel]="'SECURITY_CENTER.AUDIT.SEVERITY_' + severity.toUpperCase() | translate"
            ></nz-option>
          }
        </nz-select>
        <button nz-button nzType="primary" type="submit">
          {{ 'SECURITY_CENTER.AUDIT.APPLY' | translate }}
        </button>
        <button nz-button type="button" (click)="reset()">
          {{ 'SECURITY_CENTER.AUDIT.RESET' | translate }}
        </button>
      </form>

      @if (error()) {
        <nz-alert
          class="banner"
          nzType="error"
          nzShowIcon
          [nzMessage]="error() ?? '' | translate"
        />
      }

      <div class="table-scroll">
        <nz-table
          nzSize="small"
          [nzData]="visibleRows()"
          [nzLoading]="loading()"
          [nzFrontPagination]="false"
          [nzTotal]="total()"
          [nzPageSize]="pageSize"
          [nzPageIndex]="page()"
          (nzPageIndexChange)="goTo($event)"
          [nzNoResult]="'SECURITY_CENTER.AUDIT.EMPTY' | translate"
        >
          <thead>
            <tr>
              <th>#</th>
              <th>{{ 'SECURITY_CENTER.AUDIT.ACTION' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.AUDIT.SEVERITY' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.AUDIT.ENTITY_TYPE' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.AUDIT.ACTOR' | translate }}</th>
              <th>{{ 'SECURITY_CENTER.AUDIT.OCCURRED_AT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visibleRows(); track row.id) {
              <tr
                class="clickable"
                tabindex="0"
                data-testid="ledger-row"
                [attr.aria-selected]="row.id === selected()?.id"
                (click)="select(row)"
                (keydown.enter)="select(row)"
              >
                <td>{{ row.sequence_number }}</td>
                <td>{{ eventLabel(row.event_type) | translate }}</td>
                <td>
                  <nz-tag [nzColor]="severityColor(severityOf(row))">{{
                    'SECURITY_CENTER.AUDIT.SEVERITY_' + severityOf(row).toUpperCase() | translate
                  }}</nz-tag>
                </td>
                <td>{{ row.auditable_type }}</td>
                <td>{{ row.actor.email ?? row.actor.type }}</td>
                <td class="mono">{{ timestamp(row.occurred_at) }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </nz-card>

    @if (selected()) {
      <nz-card
        class="banner"
        [nzTitle]="'SECURITY_CENTER.AUDIT.DETAIL' | translate"
        [nzLoading]="detailLoading()"
      >
        @if (detail(); as d) {
          <app-audit-diff-viewer [oldValues]="d.old_values" [newValues]="d.new_values" />
          <h4>{{ 'SECURITY_CENTER.AUDIT.HASH_INSPECTOR' | translate }}</h4>
          <dl class="hash-inspector" data-testid="hash-inspector">
            <dt>{{ 'SECURITY_CENTER.AUDIT.SEQUENCE' | translate }}</dt>
            <dd class="mono" data-testid="hash-sequence">{{ d.proof.sequence_number }}</dd>
            <dt>{{ 'SECURITY_CENTER.AUDIT.PREVIOUS_HASH' | translate }}</dt>
            <dd class="mono" data-testid="hash-previous">{{ d.proof.previous_hash }}</dd>
            <dt>{{ 'SECURITY_CENTER.AUDIT.RECORD_HASH' | translate }}</dt>
            <dd class="mono" data-testid="hash-current">{{ d.proof.current_hash }}</dd>
          </dl>
        }
      </nz-card>
    }
  `,
})
export class AuditExplorerComponent implements OnInit {
  private readonly api = inject(AuditTrailApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly eventTypes = AUDIT_EVENT_TYPES;
  protected readonly severities = AUDIT_SEVERITIES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly eventLabel = eventLabelKey;
  protected readonly timestamp = formatMicroTimestamp;
  protected readonly severityColor = severityTagColor;
  protected readonly severityOf = (row: AuditLogEntry): AuditSeverity =>
    auditSeverity(row.event_type);

  readonly filters = this.fb.group({
    range: this.fb.control<Date[]>([]),
    actions: this.fb.control<AuditEventType[]>([]),
    severities: this.fb.control<AuditSeverity[]>([]),
    actorId: '',
    entityType: '',
    entityId: '',
  });

  readonly rows = signal<AuditLogEntry[]>([]);
  readonly severityFilter = signal<AuditSeverity[]>([]);
  readonly visibleRows = computed(() => filterBySeverity(this.rows(), this.severityFilter()));
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly certificate = signal<AuditVerificationCertificate | null>(null);
  readonly verifying = signal(false);

  readonly selected = signal<AuditLogEntry | null>(null);
  readonly detail = signal<AuditLogDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly bannerType = computed<'success' | 'error' | 'info'>(() => {
    const cert = this.certificate();
    return cert === null ? 'info' : cert.isValid ? 'success' : 'error';
  });

  readonly bannerKey = computed(() => {
    const cert = this.certificate();
    return cert === null
      ? 'SECURITY_CENTER.AUDIT.CHAIN'
      : cert.isValid
        ? 'SECURITY_CENTER.AUDIT.CHAIN_VERIFIED'
        : 'SECURITY_CENTER.AUDIT.CHAIN_TAMPERED';
  });

  ngOnInit(): void {
    this.load();
  }

  apply(): void {
    this.page.set(1);
    this.severityFilter.set(this.filters.controls.severities.value);
    this.load();
  }

  reset(): void {
    this.filters.reset();
    this.apply();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  verifyChain(): void {
    this.verifying.set(true);
    this.api.verifyIntegrity().subscribe({
      next: (response) => {
        this.certificate.set(response.data);
        this.verifying.set(false);
      },
      error: () => {
        this.verifying.set(false);
        this.error.set('SECURITY_CENTER.AUDIT.VERIFY_ERROR');
      },
    });
  }

  select(row: AuditLogEntry): void {
    this.selected.set(row);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.api.get(row.id).subscribe({
      next: (response) => {
        this.detail.set(response.data);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.error.set('SECURITY_CENTER.AUDIT.LOAD_ERROR');
      },
    });
  }

  private load(): void {
    const value = this.filters.getRawValue();
    this.loading.set(true);
    this.error.set(null);
    this.api
      .list(
        buildAuditFilters({
          range: value.range,
          actions: value.actions,
          actorId: value.actorId,
          entityType: value.entityType,
          entityId: value.entityId,
        }),
        this.page(),
        PAGE_SIZE,
      )
      .subscribe({
        next: (response) => {
          this.rows.set(response.data);
          this.total.set(response.meta.total);
          if (response.meta.last_verification) {
            this.certificate.set(response.meta.last_verification);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('SECURITY_CENTER.AUDIT.LOAD_ERROR');
        },
      });
  }
}
