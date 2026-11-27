import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore } from '@core/auth/auth.store';
import { ObsConnector } from '../../core/models/observability.model';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header.component';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { ConnectorAdminStore } from './connector-admin.store';
import { ConnectorStatusStore } from './connector-status.store';
import { formatMs, formatPercent, statusColor, statusKey } from './observability.util';

/**
 * Status page of the institutional connectors (SDI, STS, Swissdec ELM, ZEFIX, UID, VIES, SNB, ECB, eBill): status badge,
 * response time, uptime 24 h / 7 d, 24 hourly bars and the time of the last check. Every member sees it; platform administrators
 * also get the last error, the TLS expiry, "probe now" and the maintenance switch.
 */
@Component({
  selector: 'app-connector-status-page',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ConnectorAdminStore],
  styleUrl: './observability.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.CONNECTOR_STATUS' | translate"
      [subtitle]="'OBSERVABILITY.STATUS_PAGE.SUBTITLE' | translate"
    />

    <div class="admin-bar">
      <span data-test="overall">
        {{ 'OBSERVABILITY.STATUS_PAGE.OVERALL' | translate }}:
        <nz-tag [nzColor]="color(status.overall())">{{ key(status.overall()) | translate }}</nz-tag>
      </span>
      <button nz-button type="button" [nzLoading]="status.loading()" (click)="refresh()">
        {{ 'OBSERVABILITY.STATUS_PAGE.REFRESH' | translate }}
      </button>
      @if (isAdmin()) {
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="probe-all"
          [nzLoading]="admin.probing()"
          (click)="admin.probe()"
        >
          {{ 'OBSERVABILITY.STATUS_PAGE.PROBE_ALL' | translate }}
        </button>
        <div class="field">
          <label for="obs-maintenance-message">{{
            'OBSERVABILITY.STATUS_PAGE.MAINTENANCE_MESSAGE' | translate
          }}</label>
          <input
            nz-input
            id="obs-maintenance-message"
            maxlength="200"
            [(ngModel)]="maintenanceMessage"
          />
        </div>
      }
    </div>

    @if (status.error() || admin.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="!status.loaded() && status.loading()">
      @if (connectors().length === 0 && status.loaded()) {
        <nz-empty [nzNotFoundContent]="'OBSERVABILITY.STATUS_PAGE.EMPTY' | translate"></nz-empty>
      }
      <div class="connector-grid">
        @for (connector of connectors(); track connector.key) {
          <article class="connector-card" [attr.data-test]="'connector-' + connector.key">
            <header>
              <h3>{{ connector.name_code | translate }}</h3>
              <nz-tag [nzColor]="color(connector.status)">{{ key(connector.status) | translate }}</nz-tag>
            </header>
            <div>
              <nz-tag>{{ connector.country }}</nz-tag>
              <nz-tag>{{
                'OBSERVABILITY.GROUP.' + connector.group.toUpperCase() | translate
              }}</nz-tag>
            </div>
            @if (connector.maintenance_message) {
              <p class="muted">{{ connector.maintenance_message }}</p>
            }
            <dl>
              <dt>{{ 'OBSERVABILITY.STATUS_PAGE.LATENCY_LAST' | translate }}</dt>
              <dd>{{ ms(connector.last_latency_ms) }} {{ 'OBSERVABILITY.UNIT.MS' | translate }}</dd>
              <dt>{{ 'OBSERVABILITY.STATUS_PAGE.LATENCY_AVG' | translate }}</dt>
              <dd>{{ ms(connector.avg_latency_ms) }} {{ 'OBSERVABILITY.UNIT.MS' | translate }}</dd>
              <dt>{{ 'OBSERVABILITY.STATUS_PAGE.UPTIME_24H' | translate }}</dt>
              <dd>{{ pct(connector.uptime_24h) }}</dd>
              <dt>{{ 'OBSERVABILITY.STATUS_PAGE.UPTIME_7D' | translate }}</dt>
              <dd>{{ pct(connector.uptime_7d) }}</dd>
              <dt>{{ 'OBSERVABILITY.STATUS_PAGE.LAST_CHECKED' | translate }}</dt>
              <dd>
                @if (connector.last_checked_at) {
                  {{ connector.last_checked_at | date: 'short' }}
                } @else {
                  {{ 'OBSERVABILITY.STATUS_PAGE.NEVER_CHECKED' | translate }}
                }
              </dd>
              @if (isAdmin() && connector.tls_days_remaining !== null) {
                <dt>{{ 'OBSERVABILITY.STATUS_PAGE.TLS_DAYS' | translate }}</dt>
                <dd>{{ connector.tls_days_remaining }}</dd>
              }
            </dl>
            @if (isAdmin() && connector.last_error) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="connector.last_error"
                [nzDescription]="null"
              ></nz-alert>
            }
            <div class="muted">{{ 'OBSERVABILITY.STATUS_PAGE.HISTORY' | translate }}</div>
            <ol class="history" [attr.aria-label]="'OBSERVABILITY.STATUS_PAGE.HISTORY' | translate">
              @for (bucket of connector.history; track bucket.bucket) {
                <li
                  [class]="'s-' + bucket.status"
                  [attr.title]="(bucket.bucket | date: 'short') + ' · ' + (key(bucket.status) | translate)"
                  [attr.aria-label]="(bucket.bucket | date: 'short') + ' · ' + (key(bucket.status) | translate)"
                ></li>
              }
            </ol>
            @if (isAdmin()) {
              <div class="admin-bar">
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [attr.data-test]="'probe-' + connector.key"
                  [nzLoading]="admin.probing()"
                  (click)="admin.probe(connector.key)"
                >
                  {{ 'OBSERVABILITY.STATUS_PAGE.PROBE' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [attr.data-test]="'maintenance-' + connector.key"
                  (click)="toggleMaintenance(connector)"
                >
                  {{
                    (connector.status === 'maintenance'
                      ? 'OBSERVABILITY.STATUS_PAGE.MAINTENANCE_OFF'
                      : 'OBSERVABILITY.STATUS_PAGE.MAINTENANCE_ON'
                    ) | translate
                  }}
                </button>
              </div>
            }
          </article>
        }
      </div>
    </nz-spin>
  `,
})
export class ConnectorStatusPageComponent implements OnInit {
  protected readonly status = inject(ConnectorStatusStore);
  protected readonly admin = inject(ConnectorAdminStore);
  private readonly authStore = inject(AuthStore);

  protected maintenanceMessage = '';
  protected readonly isAdmin = computed(() => this.authStore.user()?.is_platform_admin === true);
  /** Administrators see the detailed list; everybody else the summary of the tenant endpoint. */
  protected readonly connectors = computed<ObsConnector[]>(() =>
    this.isAdmin() && this.admin.connectors().length > 0 ? this.admin.connectors() : this.status.connectors(),
  );

  protected readonly color = statusColor;
  protected readonly key = statusKey;
  protected readonly ms = formatMs;
  protected readonly pct = (value: number): string => formatPercent(value, 2);

  ngOnInit(): void {
    // The shell banner polls already; starting is idempotent and makes the page work on its own too.
    this.status.startPolling();
    if (this.isAdmin()) {
      void this.admin.load();
    }
  }

  protected refresh(): void {
    void this.status.refresh();
    if (this.isAdmin()) {
      void this.admin.load();
    }
  }

  protected toggleMaintenance(connector: ObsConnector): void {
    const on = connector.status !== 'maintenance';
    void this.admin.setMaintenance(connector.key, on, on ? this.maintenanceMessage.trim() || undefined : undefined);
  }
}
