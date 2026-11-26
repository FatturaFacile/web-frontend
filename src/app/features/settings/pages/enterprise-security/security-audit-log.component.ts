import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EnterpriseAuthApiService,
  I18nService,
  SecurityAuditAuthMethod,
  SecurityAuditEvent,
  SecurityAuditEventType,
  SecurityAuditFilters,
  SecurityAuditStatus,
  SettingsApiService,
  UserResource,
} from '@core';
import { TranslatePipe } from '@shared';
import { userAgentLabel } from '../security/user-agent.util';
import { enterpriseErrorText } from './enterprise-security.util';

const AUTH_METHODS: readonly SecurityAuditAuthMethod[] = ['password', 'sso', 'sso_saml', 'sso_oidc', 'passkey'];
const STATUSES: readonly SecurityAuditStatus[] = ['success', 'failure'];

interface EventTypeGroup {
  category: string;
  items: SecurityAuditEventType[];
}

/** `YYYY-MM-DD` of a local date, the format the audit filters of the API read. */
export function formatAuditDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Security audit log of the company: sign-ins, passwords, second factors, sessions, lockouts, single sign-on, SCIM and
 * policy changes. Filters (period, user, event types, outcome, sign-in method) and server side pagination.
 */
@Component({
  selector: 'app-security-audit-log',
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'security.audit.title' | translate">
      <p>{{ 'security.audit.subtitle' | translate }}</p>

      <div class="filters" role="search">
        <div class="field">
          <label for="audit-range">{{ 'security.audit.filters.from' | translate }} / {{ 'security.audit.filters.to' | translate }}</label>
          <nz-range-picker id="audit-range" data-testid="audit-filter-range" [ngModel]="range()" (ngModelChange)="range.set($event ?? [])" />
        </div>
        <div class="field">
          <label for="audit-user">{{ 'security.audit.filters.user' | translate }}</label>
          <nz-select
            id="audit-user"
            nzShowSearch
            nzAllowClear
            class="select"
            data-testid="audit-filter-user"
            [nzPlaceHolder]="'security.audit.filters.all' | translate"
            [ngModel]="userId()"
            (ngModelChange)="userId.set($event ?? null)"
          >
            @for (member of members(); track member.id) {
              <nz-option [nzValue]="member.id" [nzLabel]="member.name + ' (' + member.email + ')'"></nz-option>
            }
          </nz-select>
        </div>
        <div class="field">
          <label for="audit-event-type">{{ 'security.audit.filters.event_type' | translate }}</label>
          <nz-select
            id="audit-event-type"
            nzMode="multiple"
            nzShowSearch
            nzAllowClear
            class="select wide"
            data-testid="audit-filter-event-type"
            [nzPlaceHolder]="'security.audit.filters.all' | translate"
            [ngModel]="eventTypes()"
            (ngModelChange)="eventTypes.set($event ?? [])"
          >
            @for (group of eventTypeGroups(); track group.category) {
              <nz-option-group [nzLabel]="categoryLabel(group.category)">
                @for (item of group.items; track item.event_type) {
                  <nz-option [nzValue]="item.event_type" [nzLabel]="eventLabel(item.translation_key, item.event_type)"></nz-option>
                }
              </nz-option-group>
            }
          </nz-select>
        </div>
        <div class="field">
          <label for="audit-status">{{ 'security.audit.filters.status' | translate }}</label>
          <nz-select
            id="audit-status"
            nzAllowClear
            class="select"
            data-testid="audit-filter-status"
            [nzPlaceHolder]="'security.audit.filters.all' | translate"
            [ngModel]="status()"
            (ngModelChange)="status.set($event ?? null)"
          >
            @for (item of statuses; track item) {
              <nz-option [nzValue]="item" [nzLabel]="'security.audit.status.' + item | translate"></nz-option>
            }
          </nz-select>
        </div>
        <div class="field">
          <label for="audit-auth-method">{{ 'security.audit.filters.auth_method' | translate }}</label>
          <nz-select
            id="audit-auth-method"
            nzAllowClear
            class="select"
            data-testid="audit-filter-auth-method"
            [nzPlaceHolder]="'security.audit.filters.all' | translate"
            [ngModel]="authMethod()"
            (ngModelChange)="authMethod.set($event ?? null)"
          >
            @for (item of authMethods; track item) {
              <nz-option [nzValue]="item" [nzLabel]="'security.audit.auth_method.' + item | translate"></nz-option>
            }
          </nz-select>
        </div>
        <div class="actions">
          <button nz-button nzType="primary" type="button" data-testid="audit-apply" (click)="apply()">
            {{ 'security.audit.filters.apply' | translate }}
          </button>
          <button nz-button type="button" data-testid="audit-reset" (click)="reset()">
            {{ 'security.audit.filters.reset' | translate }}
          </button>
        </div>
      </div>

      @if (errorText(); as text) {
        <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="text" data-testid="audit-error" />
      }

      <nz-table
        [nzData]="events()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="perPage()"
        (nzPageIndexChange)="onPage($event)"
        (nzPageSizeChange)="onPageSize($event)"
        nzShowSizeChanger
        nzSize="small"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th>{{ 'security.audit.columns.time' | translate }}</th>
            <th>{{ 'security.audit.columns.user' | translate }}</th>
            <th>{{ 'security.audit.columns.event' | translate }}</th>
            <th>{{ 'security.audit.columns.status' | translate }}</th>
            <th>{{ 'security.audit.columns.auth_method' | translate }}</th>
            <th>{{ 'security.audit.columns.mfa_method' | translate }}</th>
            <th>{{ 'security.audit.columns.ip_address' | translate }}</th>
            <th>{{ 'security.audit.columns.user_agent' | translate }}</th>
            <th>{{ 'security.audit.columns.reason' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (event of events(); track event.id) {
            <tr data-testid="audit-row">
              <td>{{ event.occurred_at | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
              <td>
                @if (event.user) {
                  <div>{{ event.user.name }}</div>
                  <small class="muted">{{ event.user.email }}</small>
                } @else {
                  <span class="muted">{{ 'security.audit.unknown_user' | translate }}</span>
                }
              </td>
              <td>{{ eventLabel(event.translation_key, event.event_type) }}</td>
              <td>
                <nz-tag [nzColor]="event.status === 'success' ? 'green' : 'red'">{{ 'security.audit.status.' + event.status | translate }}</nz-tag>
              </td>
              <td>{{ event.auth_method ? optionalLabel('security.audit.auth_method.' + event.auth_method, event.auth_method) : '-' }}</td>
              <td>{{ event.mfa_method ? optionalLabel('security.audit.mfa_method.' + event.mfa_method, event.mfa_method) : '-' }}</td>
              <td>
                <code>{{ event.ip_address || '-' }}</code>
              </td>
              <td [attr.title]="event.user_agent || null">{{ agentLabel(event) }}</td>
              <td>{{ event.reason || '-' }}</td>
            </tr>
          } @empty {
            @if (!loading()) {
              <tr>
                <td colspan="9" class="muted center" data-testid="audit-empty">{{ 'security.audit.empty' | translate }}</td>
              </tr>
            }
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label { color: var(--text-secondary); font-size: var(--font-size-sm, 13px); }
    .select { width: 200px; }
    .select.wide { width: 320px; }
    .actions { display: flex; gap: 8px; }
    .gap { display: block; margin-bottom: 16px; }
    .muted { color: var(--text-secondary); }
    .center { text-align: center; }
  `,
})
export class SecurityAuditLogComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly i18n = inject(I18nService);

  protected readonly authMethods = AUTH_METHODS;
  protected readonly statuses = STATUSES;

  protected readonly events = signal<SecurityAuditEvent[]>([]);
  protected readonly types = signal<SecurityAuditEventType[]>([]);
  protected readonly members = signal<UserResource[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorText = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly perPage = signal(20);

  // Filter state (applied with the button, or when the page changes).
  protected readonly range = signal<Date[]>([]);
  protected readonly userId = signal<string | null>(null);
  protected readonly eventTypes = signal<string[]>([]);
  protected readonly status = signal<SecurityAuditStatus | null>(null);
  protected readonly authMethod = signal<SecurityAuditAuthMethod | null>(null);

  protected readonly eventTypeGroups = computed<EventTypeGroup[]>(() => {
    const groups = new Map<string, SecurityAuditEventType[]>();
    for (const type of this.types()) {
      groups.set(type.category, [...(groups.get(type.category) ?? []), type]);
    }
    return [...groups.entries()].map(([category, items]) => ({ category, items }));
  });

  ngOnInit(): void {
    this.api.getSecurityAuditEventTypes().subscribe({
      next: (res) => this.types.set(res.data ?? []),
      // The log stays usable without the event type filter.
      error: () => this.types.set([]),
    });
    this.settingsApi.getTenantUsers().subscribe({
      next: (res) => this.members.set(res.data ?? []),
      error: () => this.members.set([]),
    });
    this.load();
  }

  /** Query of the API for the filters currently set. */
  filters(): SecurityAuditFilters {
    const [from, to] = this.range();
    return {
      from: from ? formatAuditDate(from) : undefined,
      to: to ? formatAuditDate(to) : undefined,
      user_id: this.userId() ?? undefined,
      event_type: this.eventTypes().length > 0 ? this.eventTypes() : undefined,
      status: this.status() ?? undefined,
      auth_method: this.authMethod() ?? undefined,
      page: this.page(),
      per_page: this.perPage(),
    };
  }

  protected apply(): void {
    this.page.set(1);
    this.load();
  }

  protected reset(): void {
    this.range.set([]);
    this.userId.set(null);
    this.eventTypes.set([]);
    this.status.set(null);
    this.authMethod.set(null);
    this.apply();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSize(size: number): void {
    this.perPage.set(size);
    this.page.set(1);
    this.load();
  }

  protected categoryLabel(category: string): string {
    return this.optionalLabel(`security.audit.category.${category}`, category);
  }

  /** Translated event label; the raw event type when the dictionary has no text for it. */
  protected eventLabel(translationKey: string, eventType: string): string {
    return this.optionalLabel(translationKey, eventType);
  }

  protected optionalLabel(key: string, fallback: string): string {
    const text = this.i18n.translate(key);
    return text === key ? fallback : text;
  }

  protected agentLabel(event: SecurityAuditEvent): string {
    return event.user_agent ? userAgentLabel(event.user_agent) : '-';
  }

  load(): void {
    this.loading.set(true);
    this.errorText.set(null);
    this.api.getSecurityAudit(this.filters()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.events.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.errorText.set(enterpriseErrorText(err) ?? this.i18n.translate('security.audit.load_error'));
      },
    });
  }
}
