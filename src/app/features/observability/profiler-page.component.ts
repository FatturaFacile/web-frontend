import { DatePipe } from '@angular/common';
import { Component, inject, linkedSignal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core/i18n/i18n.service';
import { ObsProfilerSettings } from '../../core/models/observability.model';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header.component';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { formatMs, formatPercent, latencyColor } from './observability.util';
import { ProfilerStore } from './profiler.store';
import { SlowQueryDrawerComponent } from './slow-query-drawer.component';

type SettingsField = keyof ObsProfilerSettings;

/**
 * Performance Profiler & Slow Query Inspector (platform administrators): the 20 slowest SQL queries and API endpoints of the last
 * 24 h, the PostgreSQL statement statistics, the noisy neighbours and the thresholds. The detail of a query (plan, N+1, suggested
 * indexes, trace id) opens in a drawer.
 */
@Component({
  selector: 'app-observability-profiler-page',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzSpinModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    SlowQueryDrawerComponent,
    TranslatePipe,
  ],
  providers: [ProfilerStore],
  styleUrl: './observability.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.OBSERVABILITY_PROFILER' | translate"
      [subtitle]="'OBSERVABILITY.PROFILER.SUBTITLE' | translate"
    />

    <div class="admin-bar">
      <button nz-button type="button" data-test="reload" [nzLoading]="store.loading()" (click)="reload()">
        {{ 'OBSERVABILITY.ACTION.RELOAD' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="kpi-grid">
      <div class="kpi">
        <nz-statistic
          [nzTitle]="'OBSERVABILITY.KPI.SLOWEST_QUERY' | translate"
          [nzValue]="ms(store.slowestQueryMs())"
          [nzSuffix]="'OBSERVABILITY.UNIT.MS' | translate"
        ></nz-statistic>
      </div>
      <div class="kpi">
        <nz-statistic
          [nzTitle]="'OBSERVABILITY.KPI.SLOWEST_P95' | translate"
          [nzValue]="ms(store.slowestEndpointP95())"
          [nzSuffix]="'OBSERVABILITY.UNIT.MS' | translate"
        ></nz-statistic>
      </div>
      <div class="kpi">
        <nz-statistic
          [nzTitle]="'OBSERVABILITY.KPI.N_PLUS_ONE' | translate"
          [nzValue]="store.nPlusOneCount()"
        ></nz-statistic>
      </div>
      <div class="kpi">
        <nz-statistic
          [nzTitle]="'OBSERVABILITY.KPI.SUGGESTED_INDEXES' | translate"
          [nzValue]="store.suggestedIndexCount()"
        ></nz-statistic>
      </div>
      <div class="kpi">
        <nz-statistic
          [nzTitle]="'OBSERVABILITY.KPI.NOISY_TENANTS' | translate"
          [nzValue]="store.flaggedTenants()"
        ></nz-statistic>
      </div>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-tabs>
        <nz-tab [nzTitle]="'OBSERVABILITY.TAB.SLOW_QUERIES' | translate">
          <nz-table #queries nzSize="small" [nzData]="store.slowQueries()" [nzShowPagination]="false" [nzScroll]="{ x: '960px' }">
            <thead>
              <tr>
                <th scope="col">{{ 'OBSERVABILITY.COL.QUERY' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.AVG_MS' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.MAX_MS' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.EXECUTIONS' | translate }}</th>
                <th scope="col">{{ 'OBSERVABILITY.COL.ORIGIN' | translate }}</th>
                <th scope="col">{{ 'OBSERVABILITY.COL.FLAGS' | translate }}</th>
                <th scope="col">{{ 'OBSERVABILITY.COL.LAST_SEEN' | translate }}</th>
                <th scope="col">{{ 'OBSERVABILITY.COL.ACTIONS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (query of queries.data; track query.fingerprint) {
                <tr [attr.data-test]="'query-' + query.fingerprint">
                  <td><code class="sql" [attr.title]="query.sql">{{ query.sql }}</code></td>
                  <td class="num">{{ ms(query.avg_ms) }}</td>
                  <td class="num">{{ ms(query.max_ms) }}</td>
                  <td class="num">{{ query.executions }}</td>
                  <td>{{ query.origin ?? '—' }}</td>
                  <td>
                    @if (query.n_plus_one) {
                      <nz-tag nzColor="volcano">{{ 'OBSERVABILITY.TAG.N_PLUS_ONE_SHORT' | translate }}</nz-tag>
                    }
                    @if (query.suggested_indexes.length > 0) {
                      <nz-tag nzColor="gold">{{ 'OBSERVABILITY.TAG.INDEX' | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ query.last_captured_at | date: 'short' }}</td>
                  <td class="row-actions">
                    <button nz-button nzSize="small" type="button" (click)="store.select(query.fingerprint)">
                      {{ 'OBSERVABILITY.ACTION.DETAILS' | translate }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <nz-empty [nzNotFoundContent]="'OBSERVABILITY.EMPTY.QUERIES' | translate"></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'OBSERVABILITY.TAB.SLOW_ENDPOINTS' | translate">
          <nz-table #endpoints nzSize="small" [nzData]="store.slowEndpoints()" [nzShowPagination]="false" [nzScroll]="{ x: '960px' }">
            <thead>
              <tr>
                <th scope="col">{{ 'OBSERVABILITY.COL.ENDPOINT' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.REQUESTS' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.P50' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.P95' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.P99' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.AVG_DB_QUERIES' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.AVG_DB_MS' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.ERROR_RATE' | translate }}</th>
                <th scope="col">{{ 'OBSERVABILITY.COL.TRACE_ID' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (endpoint of endpoints.data; track endpoint.method + endpoint.route) {
                <tr>
                  <td>
                    <nz-tag>{{ endpoint.method }}</nz-tag> <code>{{ endpoint.route }}</code>
                  </td>
                  <td class="num">{{ endpoint.requests }}</td>
                  <td class="num">{{ ms(endpoint.p50_ms) }}</td>
                  <td class="num">
                    <nz-tag [nzColor]="latency(endpoint.p95_ms)">{{ ms(endpoint.p95_ms) }}</nz-tag>
                  </td>
                  <td class="num">{{ ms(endpoint.p99_ms) }}</td>
                  <td class="num">{{ endpoint.avg_db_queries.toFixed(1) }}</td>
                  <td class="num">{{ ms(endpoint.avg_db_ms) }}</td>
                  <td class="num">{{ pct(endpoint.error_rate * 100) }}</td>
                  <td><code>{{ endpoint.last_trace_id ?? '—' }}</code></td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9">
                    <nz-empty [nzNotFoundContent]="'OBSERVABILITY.EMPTY.ENDPOINTS' | translate"></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'OBSERVABILITY.TAB.STATEMENTS' | translate">
          @if (store.statements(); as statements) {
            @if (!statements.available) {
              <nz-alert
                class="feedback"
                nzType="warning"
                nzShowIcon
                data-test="statements-unavailable"
                [nzMessage]="'OBSERVABILITY.STATEMENTS.UNAVAILABLE' | translate"
                [nzDescription]="statementsHint(statements.reason, statements.hint)"
              ></nz-alert>
            }
            <nz-table #stmts nzSize="small" [nzData]="statements.statements" [nzShowPagination]="false" [nzScroll]="{ x: '800px' }">
              <thead>
                <tr>
                  <th scope="col">{{ 'OBSERVABILITY.COL.QUERY' | translate }}</th>
                  <th scope="col" class="num">{{ 'OBSERVABILITY.COL.CALLS' | translate }}</th>
                  <th scope="col" class="num">{{ 'OBSERVABILITY.COL.MEAN_MS' | translate }}</th>
                  <th scope="col" class="num">{{ 'OBSERVABILITY.COL.TOTAL_MS' | translate }}</th>
                  <th scope="col" class="num">{{ 'OBSERVABILITY.COL.ROWS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (statement of stmts.data; track statement.query) {
                  <tr>
                    <td><code class="sql" [attr.title]="statement.query">{{ statement.query }}</code></td>
                    <td class="num">{{ statement.calls }}</td>
                    <td class="num">{{ ms(statement.mean_ms) }}</td>
                    <td class="num">{{ ms(statement.total_ms) }}</td>
                    <td class="num">{{ statement.rows }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5">
                      <nz-empty [nzNotFoundContent]="'OBSERVABILITY.EMPTY.STATEMENTS' | translate"></nz-empty>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'OBSERVABILITY.TAB.NOISY' | translate">
          <nz-table #tenants nzSize="small" [nzData]="store.noisyNeighbors()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'OBSERVABILITY.COL.TENANT' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.REQUESTS' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.DB_MS' | translate }}</th>
                <th scope="col" class="num">{{ 'OBSERVABILITY.COL.SHARE' | translate }}</th>
                <th scope="col">{{ 'OBSERVABILITY.COL.FLAGS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (tenant of tenants.data; track tenant.tenant_id) {
                <tr>
                  <td>
                    {{ tenant.tenant_name ?? tenant.tenant_id }}
                    <small class="muted">{{ tenant.tenant_id }}</small>
                  </td>
                  <td class="num">{{ tenant.requests }}</td>
                  <td class="num">{{ ms(tenant.db_ms) }}</td>
                  <td class="num">{{ pct(tenant.share_pct) }}</td>
                  <td>
                    @if (tenant.flagged) {
                      <nz-tag nzColor="red">{{ 'OBSERVABILITY.TAG.NOISY' | translate }}</nz-tag>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">
                    <nz-empty [nzNotFoundContent]="'OBSERVABILITY.EMPTY.NOISY' | translate"></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'OBSERVABILITY.TAB.SETTINGS' | translate">
          @if (draft(); as settings) {
            <div class="form-grid">
              @for (field of numberFields; track field.key) {
                <div class="field">
                  <label [for]="'obs-set-' + field.key">{{ field.label | translate }}</label>
                  <nz-input-number
                    [nzId]="'obs-set-' + field.key"
                    [nzMin]="field.min"
                    [nzMax]="field.max"
                    [ngModel]="numberOf(settings, field.key)"
                    (ngModelChange)="patch(field.key, $event)"
                  ></nz-input-number>
                </div>
              }
              <div class="field">
                <label for="obs-set-explain_enabled">{{ 'OBSERVABILITY.SETTINGS.EXPLAIN_ENABLED' | translate }}</label>
                <nz-switch
                  nzId="obs-set-explain_enabled"
                  [ngModel]="settings.explain_enabled"
                  (ngModelChange)="patch('explain_enabled', $event)"
                ></nz-switch>
              </div>
            </div>
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="save-settings"
              [nzLoading]="store.saving()"
              (click)="save()"
            >
              {{ 'OBSERVABILITY.ACTION.SAVE' | translate }}
            </button>
            @if (store.saved()) {
              <nz-alert
                class="feedback"
                nzType="success"
                nzShowIcon
                [nzMessage]="'OBSERVABILITY.SETTINGS.SAVED' | translate"
              ></nz-alert>
            }
          }
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <app-slow-query-drawer [query]="store.selectedQuery()" (closed)="store.select(null)" />
  `,
})
export class ProfilerPageComponent implements OnInit {
  protected readonly store = inject(ProfilerStore);
  private readonly i18n = inject(I18nService);

  /** Editable copy of the saved settings; resets whenever the saved ones change. */
  protected readonly draft = linkedSignal<ObsProfilerSettings | null>(() => this.store.settings());

  protected readonly ms = formatMs;
  protected readonly pct = (value: number): string => formatPercent(value);
  protected readonly numberFields: readonly {
    key: Exclude<SettingsField, 'explain_enabled'>;
    label: string;
    min: number;
    max: number;
  }[] = [
    { key: 'slow_query_threshold_ms', label: 'OBSERVABILITY.SETTINGS.SLOW_QUERY_THRESHOLD_MS', min: 10, max: 60000 },
    { key: 'n_plus_one_threshold', label: 'OBSERVABILITY.SETTINGS.N_PLUS_ONE_THRESHOLD', min: 2, max: 1000 },
    { key: 'alert_endpoint_p95_ms', label: 'OBSERVABILITY.SETTINGS.ALERT_ENDPOINT_P95_MS', min: 50, max: 60000 },
    { key: 'alert_tenant_share_pct', label: 'OBSERVABILITY.SETTINGS.ALERT_TENANT_SHARE_PCT', min: 1, max: 100 },
    { key: 'alert_connector_latency_ms', label: 'OBSERVABILITY.SETTINGS.ALERT_CONNECTOR_LATENCY_MS', min: 100, max: 60000 },
    { key: 'retention_days', label: 'OBSERVABILITY.SETTINGS.RETENTION_DAYS', min: 1, max: 90 },
  ];

  ngOnInit(): void {
    void this.store.loadAll();
  }

  protected reload(): void {
    void this.store.loadAll();
  }

  protected latency(p95: number): string {
    return latencyColor(p95, this.store.settings()?.alert_endpoint_p95_ms ?? 1000);
  }

  protected numberOf(settings: ObsProfilerSettings, key: Exclude<SettingsField, 'explain_enabled'>): number {
    return settings[key];
  }

  protected patch(key: SettingsField, value: number | boolean | null): void {
    const current = this.draft();
    if (current && value !== null) {
      this.draft.set({ ...current, [key]: value });
    }
  }

  protected async save(): Promise<void> {
    const settings = this.draft();
    if (settings) {
      await this.store.saveSettings(settings);
    }
  }

  /** The hint of the API when it sent one, otherwise the text of the reason (extension missing, no permission, not PostgreSQL). */
  protected statementsHint(reason: string | null, hint: string | null): string {
    return hint ?? this.i18n.translate(`OBSERVABILITY.STATEMENTS.REASON_${(reason ?? 'unknown').toUpperCase()}`);
  }
}
