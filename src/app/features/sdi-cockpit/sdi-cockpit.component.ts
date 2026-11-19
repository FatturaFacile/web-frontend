import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FPA_STATUSES, FpaDocument, FpaDocumentsApiService, FpaKpi, FpaNotification, FpaStatus, I18nService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { reportHttpError } from '../hr/shared/hr-http.util';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  validated: 'cyan',
  validation_failed: 'error',
  signed: 'geekblue',
  queued: 'processing',
  transmitted: 'blue',
  delivered: 'success',
  undelivered: 'warning',
  rejected: 'error',
  pa_accepted: 'success',
  pa_rejected: 'error',
  deadline_passed: 'success',
  transmitted_attested: 'warning',
  inbound_received: 'purple',
  inbound_processed: 'default',
};

const NOTIFICATION_COLORS: Record<string, string> = { RC: 'green', NE: 'green', DT: 'green', AT: 'orange', MC: 'orange', NS: 'red', MT: 'blue' };

const KPI_KEYS: readonly (keyof FpaKpi)[] = ['ready', 'transmitted', 'delivered', 'undelivered', 'rejected', 'inbound_to_process'];

/** Electronic invoicing cockpit: KPI cards, envelopes, SDI timeline and the 5-day rejection recovery. */
@Component({
  selector: 'app-sdi-cockpit',
  imports: [DatePipe, FormsModule, NzButtonModule, NzCardModule, NzDrawerModule, NzEmptyModule, NzSelectModule, NzTableModule, NzTagModule, NzTimelineModule, PageHeaderComponent, TranslatePipe],
  styles: [
    '.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-3); }',
    '.kpi { text-align: center; cursor: pointer; } .kpi strong { display: block; font-size: 1.75rem; }',
    '.toolbar { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); } .muted { color: var(--text-secondary); }',
  ],
  template: `
    <app-page-header [title]="'sdiCockpit.title' | translate" [subtitle]="'sdiCockpit.subtitle' | translate" />
    <div class="kpis">
      @for (key of kpiKeys; track key) {
        <nz-card class="kpi" nzSize="small" (click)="filterByKpi(key)" [attr.data-testid]="'kpi-' + key">
          <strong>{{ kpi()[key] }}</strong>
          <span class="muted">{{ 'sdiCockpit.kpi.' + key | translate }}</span>
        </nz-card>
      }
    </div>
    <nz-card>
      <div class="toolbar">
        <nz-select style="width: 220px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); reload()" [nzPlaceHolder]="'sdiCockpit.allStatuses' | translate" [attr.aria-label]="'sdiCockpit.status' | translate">
          @for (value of statuses; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'sdiCockpit.statuses.' + value | translate"></nz-option>
          }
        </nz-select>
        <nz-select style="width: 160px" nzAllowClear [ngModel]="direction()" (ngModelChange)="direction.set($event); reload()" [nzPlaceHolder]="'sdiCockpit.allDirections' | translate" [attr.aria-label]="'sdiCockpit.direction' | translate">
          <nz-option nzValue="outbound" [nzLabel]="'sdiCockpit.directions.outbound' | translate"></nz-option>
          <nz-option nzValue="inbound" [nzLabel]="'sdiCockpit.directions.inbound' | translate"></nz-option>
        </nz-select>
        <button nz-button type="button" (click)="reload()">{{ 'sdiCockpit.refresh' | translate }}</button>
      </div>
      <nz-table #table nzSize="small" [nzFrontPagination]="false" [nzData]="rows()" [nzLoading]="loading()" [nzTotal]="total()" [nzPageIndex]="page()" [nzPageSize]="25" (nzPageIndexChange)="goTo($event)">
        <thead>
          <tr>
            <th>{{ 'sdiCockpit.document' | translate }}</th>
            <th>{{ 'sdiCockpit.format' | translate }}</th>
            <th>{{ 'sdiCockpit.status' | translate }}</th>
            <th>{{ 'sdiCockpit.sdiIdentifier' | translate }}</th>
            <th>{{ 'sdiCockpit.progressive' | translate }}</th>
            <th>{{ 'sdiCockpit.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.document_type }} {{ row.document_number }} <span class="muted">{{ row.document_date }}</span></td>
              <td>{{ row.format_transmission }}</td>
              <td>
                <nz-tag [nzColor]="color(row.status)">{{ 'sdiCockpit.statuses.' + row.status | translate }}</nz-tag>
                @if (row.status === 'rejected' && row.resubmission_deadline_at) {
                  <nz-tag nzColor="red" data-testid="countdown-badge">{{ countdown(row) }}</nz-tag>
                }
              </td>
              <td>{{ row.sdi_identifier ?? '-' }}</td>
              <td>{{ row.transmission_progressive ?? '-' }}</td>
              <td><button nz-button nzSize="small" type="button" (click)="open(row)" data-testid="open-timeline">{{ 'sdiCockpit.timeline' | translate }}</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'sdiCockpit.empty' | translate"></nz-empty>
      }
    </nz-card>
    <nz-drawer [nzVisible]="selected() !== null" nzWidth="480" [nzTitle]="'sdiCockpit.timeline' | translate" (nzOnClose)="close()">
      <ng-container *nzDrawerContent>
        @if (selected(); as doc) {
          @if (doc.status === 'rejected') {
            <nz-card nzSize="small" [nzTitle]="'sdiCockpit.recovery.title' | translate" data-testid="recovery">
              <p>{{ 'sdiCockpit.recovery.remaining' | translate }}: <strong>{{ countdown(doc) }}</strong></p>
              @for (error of doc.validation_errors ?? []; track error.code) {
                <p><nz-tag nzColor="red">{{ error.code }}</nz-tag>{{ error.description }}</p>
              }
              @if (canWrite()) {
                <button nz-button nzType="primary" type="button" (click)="resubmit(doc)" data-testid="resubmit">{{ 'sdiCockpit.recovery.fixAndResubmit' | translate }}</button>
              }
            </nz-card>
          }
          <nz-timeline>
            <nz-timeline-item nzColor="blue">{{ 'sdiCockpit.step.generated' | translate }}</nz-timeline-item>
            @if (doc.transmitted_at) {
              <nz-timeline-item nzColor="blue">{{ 'sdiCockpit.step.transmitted' | translate }} — {{ doc.transmitted_at | date: 'short' }}</nz-timeline-item>
            }
            @for (n of notifications(); track n.id) {
              <nz-timeline-item [nzColor]="notificationColor(n.type)">
                <strong>{{ n.type }}</strong> {{ 'sdiCockpit.notification.' + n.type | translate }}
                @if (n.outcome_code) { <nz-tag>{{ n.outcome_code }}</nz-tag> }
                @for (error of n.error_codes ?? []; track error.code) {
                  <div><nz-tag nzColor="red">{{ error.code }}</nz-tag>{{ error.description }}</div>
                }
                <div class="muted">{{ n.received_at ? (n.received_at | date: 'short') : '' }}</div>
              </nz-timeline-item>
            }
          </nz-timeline>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class SdiCockpitComponent implements OnInit {
  private readonly api = inject(FpaDocumentsApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statuses = FPA_STATUSES;
  protected readonly kpiKeys = KPI_KEYS;
  protected readonly rows = signal<FpaDocument[]>([]);
  protected readonly kpi = signal<FpaKpi>({ ready: 0, transmitted: 0, delivered: 0, undelivered: 0, rejected: 0, inbound_to_process: 0 });
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly status = signal<FpaStatus | null>(null);
  protected readonly direction = signal<'outbound' | 'inbound' | null>(null);
  protected readonly selected = signal<FpaDocument | null>(null);
  protected readonly notifications = signal<FpaNotification[]>([]);
  protected readonly canWrite = computed(() => this.permissions.canWrite('invoicing'));

  ngOnInit(): void {
    this.reload();
  }

  protected color(status: string): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  protected notificationColor(type: string): string {
    return NOTIFICATION_COLORS[type] ?? 'gray';
  }

  /** "X days Y hours" left to resubmit a rejected file; empty once the 5-day window is over. */
  protected countdown(doc: FpaDocument): string {
    if (!doc.resubmission_deadline_at) {
      return '';
    }
    const ms = new Date(doc.resubmission_deadline_at).getTime() - Date.now();
    if (ms <= 0) {
      return this.i18n.translate('sdiCockpit.recovery.expired');
    }
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);

    return `${days} ${this.i18n.translate('sdiCockpit.recovery.days')} ${hours} ${this.i18n.translate('sdiCockpit.recovery.hours')}`;
  }

  protected filterByKpi(key: keyof FpaKpi): void {
    const map: Partial<Record<keyof FpaKpi, FpaStatus>> = { ready: 'validated', transmitted: 'transmitted', delivered: 'delivered', undelivered: 'undelivered', rejected: 'rejected', inbound_to_process: 'inbound_received' };
    this.status.set(map[key] ?? null);
    this.reload();
  }

  reload(): void {
    this.page.set(1);
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected open(doc: FpaDocument): void {
    this.selected.set(doc);
    this.notifications.set([]);
    this.api.show(doc.id).subscribe({
      next: (res) => this.notifications.set(res.data.notifications),
      error: (error) => reportHttpError(error, this.message, this.i18n),
    });
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected resubmit(doc: FpaDocument): void {
    this.api.resubmit(doc.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('sdiCockpit.recovery.resubmitted'));
        this.close();
        this.reload();
      },
      error: (error) => reportHttpError(error, this.message, this.i18n),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .list({ status: this.status() ?? undefined, direction: this.direction() ?? undefined, page: this.page(), per_page: 25 })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta.total);
          this.kpi.set(res.meta.kpi);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          reportHttpError(error, this.message, this.i18n);
        },
      });
  }
}
