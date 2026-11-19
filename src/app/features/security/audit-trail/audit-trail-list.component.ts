import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  AUDIT_EVENT_TYPES,
  AuditEventType,
  AuditLogEntry,
  AuditLogFilters,
  AuditTrailApiService,
  AuditVerificationCertificate,
  PermissionsService,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { AuditCertificateModalComponent } from './audit-certificate-modal.component';
import { AuditDetailDrawerComponent } from './audit-detail-drawer.component';
import {
  eventColor,
  eventLabelKey,
  formatMicroTimestamp,
  isSecurityEvent,
  shortHash,
} from './audit-presentation';

const PAGE_SIZE = 50;

/**
 * Audit Trail Explorer: the live chain integrity banner, the filter bar and the high density event table. A row opens
 * the forensic diff and proof drawer; the banner button runs the cryptographic verification and shows the certificate.
 */
@Component({
  selector: 'app-audit-trail-list',
  styleUrl: './audit-trail.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzAvatarModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    TranslatePipe,
    AuditCertificateModalComponent,
    AuditDetailDrawerComponent,
  ],
  template: `
    <nz-alert
      class="banner"
      nzShowIcon
      [nzType]="bannerType()"
      [nzMessage]="bannerTitleKey() | translate"
      [nzDescription]="bannerBody"
    ></nz-alert>
    <ng-template #bannerBody>
      <div class="banner-body">
        <div class="banner-facts">
          @if (certificate(); as cert) {
            <span
              >{{ 'AUDIT.INTEGRITY.LAST_VERIFIED' | translate }}:
              <span class="mono">{{ cert.verifiedAt }}</span></span
            >
            <span>{{ 'AUDIT.CERT.CHECKED' | translate }}: {{ cert.checkedRecords }}</span>
            @if (cert.merkleRoot) {
              <span nz-tooltip [nzTooltipTitle]="cert.merkleRoot">
                {{ 'AUDIT.INTEGRITY.MERKLE_ROOT' | translate }}:
                <span class="mono">{{ short(cert.merkleRoot) }}</span>
              </span>
            }
            @if (!cert.isValid) {
              <span>{{ 'AUDIT.CERT.BROKEN_AT' | translate }}: {{ cert.brokenAtSequence }}</span>
            }
          } @else {
            <span>{{ 'AUDIT.INTEGRITY.NEVER' | translate }}</span>
          }
        </div>
        @if (canVerify()) {
          <button nz-button nzType="primary" [disabled]="verifying()" (click)="verify()">
            {{
              (verifying() ? 'AUDIT.INTEGRITY.VERIFYING' : 'AUDIT.INTEGRITY.VERIFY_NOW') | translate
            }}
          </button>
        }
      </div>
    </ng-template>

    <nz-card class="main-card">
      <form
        class="toolbar"
        role="search"
        (ngSubmit)="apply()"
        [attr.aria-label]="'AUDIT.TITLE' | translate"
      >
        <nz-range-picker
          nzShowTime
          [ngModel]="range()"
          (ngModelChange)="range.set($event ?? [])"
          name="range"
          [nzPlaceHolder]="[
            'AUDIT.FILTER.DATE_RANGE' | translate,
            'AUDIT.FILTER.DATE_RANGE' | translate,
          ]"
          [attr.aria-label]="'AUDIT.FILTER.DATE_RANGE' | translate"
        ></nz-range-picker>
        <nz-select
          style="min-width: 220px"
          nzMode="multiple"
          nzAllowClear
          name="events"
          [ngModel]="eventTypes()"
          (ngModelChange)="eventTypes.set($event)"
          [nzPlaceHolder]="'AUDIT.FILTER.EVENT_TYPE' | translate"
          [attr.aria-label]="'AUDIT.FILTER.EVENT_TYPE' | translate"
        >
          @for (type of types; track type) {
            <nz-option [nzValue]="type" [nzLabel]="label(type) | translate"></nz-option>
          }
        </nz-select>
        <input
          nz-input
          style="width: 160px"
          name="entityType"
          [(ngModel)]="entityType"
          [placeholder]="'AUDIT.FILTER.ENTITY_TYPE' | translate"
          [attr.aria-label]="'AUDIT.FILTER.ENTITY_TYPE' | translate"
        />
        <input
          nz-input
          style="width: 220px"
          name="entityId"
          [(ngModel)]="entityId"
          [placeholder]="'AUDIT.FILTER.ENTITY_ID' | translate"
          [attr.aria-label]="'AUDIT.FILTER.ENTITY_ID' | translate"
        />
        <input
          nz-input
          style="width: 220px"
          name="actorId"
          [(ngModel)]="actorId"
          [placeholder]="'AUDIT.FILTER.ACTOR' | translate"
          [attr.aria-label]="'AUDIT.FILTER.ACTOR' | translate"
        />
        <input
          nz-input
          style="width: 150px"
          name="ip"
          [(ngModel)]="ipAddress"
          [placeholder]="'AUDIT.FILTER.IP' | translate"
          [attr.aria-label]="'AUDIT.FILTER.IP' | translate"
        />
        <input
          nz-input
          style="width: 170px"
          name="changedField"
          [(ngModel)]="changedField"
          [placeholder]="'AUDIT.FILTER.CHANGED_FIELD' | translate"
          [attr.aria-label]="'AUDIT.FILTER.CHANGED_FIELD' | translate"
        />
        <button nz-button nzType="primary" type="submit">
          {{ 'AUDIT.FILTER.APPLY' | translate }}
        </button>
        <button nz-button type="button" (click)="reset()">
          {{ 'AUDIT.FILTER.RESET' | translate }}
        </button>
        <button nz-button type="button" [disabled]="exporting()" (click)="exportBundle()">
          {{ 'AUDIT.EXPORT.BUTTON' | translate }}
        </button>
      </form>

      @if (error()) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="error()" class="banner"></nz-alert>
      }

      <div class="table-scroll">
        <nz-table
          nzSize="small"
          [nzData]="rows()"
          [nzLoading]="loading()"
          [nzFrontPagination]="false"
          [nzTotal]="total()"
          [nzPageSize]="pageSize"
          [nzPageIndex]="page()"
          (nzPageIndexChange)="goTo($event)"
          [nzNoResult]="'AUDIT.EMPTY' | translate"
        >
          <thead>
            <tr>
              <th nzWidth="70px" class="num">{{ 'AUDIT.COL.SEQUENCE' | translate }}</th>
              <th nzWidth="190px">{{ 'AUDIT.COL.EVENT' | translate }}</th>
              <th nzWidth="190px">{{ 'AUDIT.COL.ENTITY' | translate }}</th>
              <th nzWidth="230px">{{ 'AUDIT.COL.ACTOR' | translate }}</th>
              <th nzWidth="130px">{{ 'AUDIT.COL.IP' | translate }}</th>
              <th>{{ 'AUDIT.COL.CHANGED_FIELDS' | translate }}</th>
              <th nzWidth="90px">{{ 'AUDIT.COL.WORM' | translate }}</th>
              <th nzWidth="230px">{{ 'AUDIT.COL.OCCURRED_AT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="clickable" tabindex="0" (click)="open(row)" (keydown.enter)="open(row)">
                <td class="num">{{ row.sequence_number }}</td>
                <td>
                  <nz-tag [nzColor]="color(row.event_type)">{{
                    label(row.event_type) | translate
                  }}</nz-tag>
                  @if (security(row.event_type)) {
                    <nz-tag nzColor="magenta">{{ 'AUDIT.EVENT.SECURITY' | translate }}</nz-tag>
                  }
                </td>
                <td>
                  <button type="button" class="link-button" (click)="filterByEntity(row, $event)">
                    {{ row.auditable_type }}
                  </button>
                  @if (row.auditable_id) {
                    <div class="mono" nz-tooltip [nzTooltipTitle]="row.auditable_id">
                      {{ short(row.auditable_id, 6) }}
                    </div>
                  }
                </td>
                <td>
                  <div class="actor">
                    <nz-avatar nzSize="small" [nzText]="initials(row)"></nz-avatar>
                    <div class="actor-text">
                      <span>{{ row.actor.email ?? row.actor.type }}</span>
                      @if (row.actor.role) {
                        <span class="actor-role">{{ row.actor.role }}</span>
                      }
                    </div>
                  </div>
                </td>
                <td>{{ row.ip_address ?? '-' }}</td>
                <td>
                  <div class="tags">
                    @for (field of row.changed_fields.slice(0, 6); track field) {
                      <nz-tag>{{ field }}</nz-tag>
                    }
                    @if (row.changed_fields.length > 6) {
                      <nz-tag>+{{ row.changed_fields.length - 6 }}</nz-tag>
                    }
                  </div>
                </td>
                <td>
                  @if (row.worm_sealed) {
                    <nz-tag nzColor="green">WORM</nz-tag>
                  }
                </td>
                <td class="ts mono">{{ timestamp(row.occurred_at) }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </nz-card>

    <app-audit-certificate-modal
      [(open)]="certOpen"
      [verifying]="verifying()"
      [certificate]="certificate()"
    ></app-audit-certificate-modal>
    <app-audit-detail-drawer [logId]="selectedId()" [(open)]="drawerOpen"></app-audit-detail-drawer>
  `,
})
export class AuditTrailListComponent implements OnInit {
  private readonly api = inject(AuditTrailApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly types = AUDIT_EVENT_TYPES;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly color = eventColor;
  protected readonly label = eventLabelKey;
  protected readonly timestamp = formatMicroTimestamp;
  protected readonly short = shortHash;
  protected readonly security = isSecurityEvent;

  readonly rows = signal<AuditLogEntry[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);

  readonly range = signal<Date[]>([]);
  readonly eventTypes = signal<AuditEventType[]>([]);
  entityType = '';
  entityId = '';
  actorId = '';
  ipAddress = '';
  changedField = '';

  readonly certificate = signal<AuditVerificationCertificate | null>(null);
  readonly verifying = signal(false);
  readonly certOpen = signal(false);

  readonly selectedId = signal<string | null>(null);
  readonly drawerOpen = signal(false);

  readonly canVerify = computed(() => this.permissions.canWrite('audit_trail'));

  readonly bannerType = computed<'success' | 'error' | 'info'>(() => {
    const cert = this.certificate();
    return cert === null ? 'info' : cert.isValid ? 'success' : 'error';
  });

  readonly bannerTitleKey = computed(() => {
    const cert = this.certificate();
    return cert === null
      ? 'AUDIT.INTEGRITY.TITLE'
      : cert.isValid
        ? 'AUDIT.INTEGRITY.VALID'
        : 'AUDIT.INTEGRITY.BROKEN';
  });

  ngOnInit(): void {
    this.load();
  }

  apply(): void {
    this.page.set(1);
    this.load();
  }

  reset(): void {
    this.range.set([]);
    this.eventTypes.set([]);
    this.entityType = this.entityId = this.actorId = this.ipAddress = this.changedField = '';
    this.apply();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  filterByEntity(row: AuditLogEntry, event: Event): void {
    event.stopPropagation();
    this.entityType = row.auditable_type;
    this.entityId = row.auditable_id ?? '';
    this.apply();
  }

  open(row: AuditLogEntry): void {
    this.selectedId.set(row.id);
    this.drawerOpen.set(true);
  }

  initials(row: AuditLogEntry): string {
    return (row.actor.email ?? row.actor.type).slice(0, 2).toUpperCase();
  }

  verify(): void {
    this.verifying.set(true);
    this.certOpen.set(true);
    this.api.verifyIntegrity().subscribe({
      next: (response) => {
        this.certificate.set(response.data);
        this.verifying.set(false);
      },
      error: () => {
        this.verifying.set(false);
        this.certOpen.set(false);
        this.message.error(this.i18n.instant('AUDIT.ERROR.ACTION'));
      },
    });
  }

  exportBundle(): void {
    this.exporting.set(true);
    this.api.exportBundle(this.filters()).subscribe({
      next: (bundle) => {
        const url = URL.createObjectURL(bundle.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = bundle.filename;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.message.error(this.i18n.instant('AUDIT.ERROR.ACTION'));
      },
    });
  }

  private filters(): AuditLogFilters {
    const [from, to] = this.range();
    return {
      event_type: this.eventTypes(),
      auditable_type: this.entityType.trim(),
      auditable_id: this.entityId.trim(),
      actor_id: this.actorId.trim(),
      ip_address: this.ipAddress.trim(),
      changed_field: this.changedField.trim(),
      date_from: from ? from.toISOString() : '',
      date_to: to ? to.toISOString() : '',
    };
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.filters(), this.page(), PAGE_SIZE).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.total.set(response.meta.total);
        // The last verification of the tenant fills the banner until this session verifies again.
        if (this.certificate() === null && response.meta.last_verification) {
          this.certificate.set(response.meta.last_verification);
        }
        this.loading.set(false);
      },
      error: (failure: { status?: number }) => {
        this.error.set(
          this.i18n.instant(failure.status === 403 ? 'AUDIT.ERROR.FORBIDDEN' : 'AUDIT.ERROR.LOAD'),
        );
        this.loading.set(false);
      },
    });
  }
}
