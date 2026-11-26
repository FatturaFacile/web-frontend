import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  EmailBlacklistEntry,
  PermissionsService,
  ScheduledNotificationPreference,
  ScheduledReportApiService,
  ScheduledReportAuditLogEntry,
  ScheduledReportDeliveryLog,
  ScheduledReportFrequency,
  ScheduledReportLanguage,
  ScheduledReportModuleKey,
  TenantReportSettings,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

interface ModuleDescriptor {
  key: ScheduledReportModuleKey;
  field: keyof Pick<
    ScheduledNotificationPreference,
    | 'include_dashboard'
    | 'include_billing'
    | 'include_deadlines'
    | 'include_crm'
    | 'include_calendar'
    | 'include_inventory'
    | 'include_support'
    | 'include_news'
    | 'include_insights'
  >;
  labelKey: string;
  icon: string;
}

const MODULE_DESCRIPTORS: readonly ModuleDescriptor[] = [
  { key: 'dashboard', field: 'include_dashboard', labelKey: 'SCHEDULED_REPORT.MODULE.DASHBOARD', icon: 'fa-solid fa-gauge-high' },
  { key: 'billing', field: 'include_billing', labelKey: 'SCHEDULED_REPORT.MODULE.BILLING', icon: 'fa-solid fa-file-invoice-dollar' },
  { key: 'deadlines', field: 'include_deadlines', labelKey: 'SCHEDULED_REPORT.MODULE.DEADLINES', icon: 'fa-solid fa-calendar-check' },
  { key: 'crm', field: 'include_crm', labelKey: 'SCHEDULED_REPORT.MODULE.CRM', icon: 'fa-solid fa-users' },
  { key: 'calendar', field: 'include_calendar', labelKey: 'SCHEDULED_REPORT.MODULE.CALENDAR', icon: 'fa-solid fa-calendar-days' },
  { key: 'inventory', field: 'include_inventory', labelKey: 'SCHEDULED_REPORT.MODULE.INVENTORY', icon: 'fa-solid fa-boxes-stacked' },
  { key: 'support', field: 'include_support', labelKey: 'SCHEDULED_REPORT.MODULE.SUPPORT', icon: 'fa-solid fa-headset' },
  { key: 'news', field: 'include_news', labelKey: 'SCHEDULED_REPORT.MODULE.NEWS', icon: 'fa-solid fa-newspaper' },
  { key: 'insights', field: 'include_insights', labelKey: 'SCHEDULED_REPORT.MODULE.INSIGHTS', icon: 'fa-solid fa-wand-magic-sparkles' },
];

@Component({
  selector: 'app-scheduled-erp-report',
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTooltipModule,
  ],
  template: `
    <nz-card [nzTitle]="'SCHEDULED_REPORT.TITLE' | translate" class="scheduled-report-card">
      <p class="subtitle">{{ 'SCHEDULED_REPORT.SUBTITLE' | translate }}</p>

      <nz-tabs>
        <!-- Tab 1: Preferences & Live Preview -->
        <nz-tab [nzTitle]="'SCHEDULED_REPORT.TAB_PREFERENCES' | translate">
          @if (loading()) {
            <div class="loading-box"><nz-spin nzSimple></nz-spin></div>
          } @else if (preference(); as pref) {
            <div nz-row [nzGutter]="24">
              <div nz-col [nzXs]="24" [nzLg]="11">
                <div class="form-section">
                  <div class="switch-row">
                    <span><strong>{{ 'SCHEDULED_REPORT.ENABLED_LABEL' | translate }}</strong></span>
                    <nz-switch
                      [ngModel]="pref.enabled"
                      (ngModelChange)="patchPreference({ enabled: $event })"
                      [attr.aria-label]="'SCHEDULED_REPORT.ENABLED_LABEL' | translate"
                    ></nz-switch>
                  </div>

                  <div class="field-group">
                    <span class="field-label">{{ 'SCHEDULED_REPORT.FREQUENCY_LABEL' | translate }}</span>
                    <nz-select
                      class="full-width"
                      [ngModel]="pref.frequency"
                      (ngModelChange)="onFrequencyChange($event)"
                      [attr.aria-label]="'SCHEDULED_REPORT.FREQUENCY_LABEL' | translate"
                    >
                      @for (freq of frequencies; track freq.value) {
                        <nz-option [nzValue]="freq.value" [nzLabel]="freq.labelKey | translate"></nz-option>
                      }
                    </nz-select>
                  </div>

                  @if (pref.frequency === 'weekly') {
                    <div class="field-group">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.DAY_OF_WEEK_LABEL' | translate }}</span>
                      <nz-input-number
                        class="full-width"
                        [ngModel]="pref.day_of_week ?? 1"
                        (ngModelChange)="patchPreference({ day_of_week: $event })"
                        [nzMin]="0"
                        [nzMax]="6"
                      ></nz-input-number>
                    </div>
                  }

                  @if (pref.frequency === 'monthly') {
                    <div class="field-group">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.DAY_OF_MONTH_LABEL' | translate }}</span>
                      <nz-input-number
                        class="full-width"
                        [ngModel]="pref.day_of_month ?? 1"
                        (ngModelChange)="patchPreference({ day_of_month: $event })"
                        [nzMin]="1"
                        [nzMax]="31"
                      ></nz-input-number>
                    </div>
                  }

                  @if (pref.frequency === 'custom_cron') {
                    <div class="field-group">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.CUSTOM_CRON_LABEL' | translate }}</span>
                      <input
                        nz-input
                        [ngModel]="pref.custom_cron ?? ''"
                        (ngModelChange)="patchPreference({ custom_cron: $event })"
                        placeholder="0 7 * * 1-5"
                      />
                      <small class="hint">{{ 'SCHEDULED_REPORT.CUSTOM_CRON_HINT' | translate }}</small>
                    </div>
                  }

                  <div class="field-row">
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.SEND_TIME_LABEL' | translate }}</span>
                      <input
                        nz-input
                        type="time"
                        [ngModel]="pref.send_time"
                        (ngModelChange)="patchPreference({ send_time: $event })"
                      />
                    </div>
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.LANGUAGE_LABEL' | translate }}</span>
                      <nz-select
                        class="full-width"
                        [ngModel]="pref.language"
                        (ngModelChange)="onLanguageChange($event)"
                      >
                        @for (lang of languages; track lang.value) {
                          <nz-option [nzValue]="lang.value" [nzLabel]="lang.labelKey | translate"></nz-option>
                        }
                      </nz-select>
                    </div>
                  </div>

                  <div class="field-group">
                    <span class="field-label">{{ 'SCHEDULED_REPORT.MODULES_TITLE' | translate }}</span>
                    <div class="modules-grid">
                      @for (mod of modules; track mod.key) {
                        @let locked = isModuleLockedByTenant(mod.key);
                        <div
                          class="module-tile"
                          [class.module-locked]="locked"
                          nz-tooltip
                          [nzTooltipTitle]="locked ? ('SCHEDULED_REPORT.MODULE_LOCKED_TOOLTIP' | translate) : ''"
                        >
                          <span
                            nz-checkbox
                            [ngModel]="!locked && isModuleEnabled(pref, mod.field)"
                            [nzDisabled]="locked"
                            (ngModelChange)="toggleModule(mod.field, $event)"
                          >
                            <i [class]="mod.icon + ' module-icon'" aria-hidden="true"></i>
                            {{ mod.labelKey | translate }}
                          </span>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="actions-bar">
                    <button
                      nz-button
                      nzType="primary"
                      type="button"
                      [nzLoading]="saving()"
                      (click)="savePreferences()"
                    >
                      {{ 'SCHEDULED_REPORT.BTN_SAVE' | translate }}
                    </button>
                    <button
                      nz-button
                      type="button"
                      [nzLoading]="sendingTest()"
                      (click)="sendTestEmail()"
                    >
                      {{ 'SCHEDULED_REPORT.BTN_SEND_TEST' | translate }}
                    </button>
                    <button
                      nz-button
                      type="button"
                      [nzLoading]="sendingNow()"
                      (click)="sendNow()"
                    >
                      {{ 'SCHEDULED_REPORT.BTN_SEND_NOW' | translate }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Live Preview Panel -->
              <div nz-col [nzXs]="24" [nzLg]="13">
                <div class="preview-header">
                  <strong>{{ 'SCHEDULED_REPORT.PREVIEW_TITLE' | translate }}</strong>
                  <div class="preview-controls">
                    <nz-radio-group [ngModel]="viewport()" (ngModelChange)="viewport.set($event)" nzSize="small">
                      <span nz-radio-button nzValue="desktop">{{ 'SCHEDULED_REPORT.VIEWPORT_DESKTOP' | translate }}</span>
                      <span nz-radio-button nzValue="mobile">{{ 'SCHEDULED_REPORT.VIEWPORT_MOBILE' | translate }}</span>
                    </nz-radio-group>
                    <button nz-button nzSize="small" type="button" [nzLoading]="previewLoading()" (click)="loadPreview()">
                      {{ 'SCHEDULED_REPORT.BTN_REFRESH_PREVIEW' | translate }}
                    </button>
                  </div>
                </div>
                <div class="preview-frame-wrap">
                  <iframe
                    class="preview-iframe"
                    [style.maxWidth]="viewport() === 'mobile' ? '375px' : '640px'"
                    [srcdoc]="previewHtml()"
                    title="ERP Daily Summary Email Preview"
                  ></iframe>
                </div>
              </div>
            </div>
          }
        </nz-tab>

        <!-- Tab 2: Delivery History & Audit Log -->
        <nz-tab [nzTitle]="'SCHEDULED_REPORT.TAB_HISTORY' | translate" (nzSelect)="loadHistory()">
          <nz-table [nzData]="deliveries()" [nzShowPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.DATE' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.RECIPIENT' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.PERIOD' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.STATUS' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.OPENS_CLICKS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of deliveries(); track item.id) {
                <tr>
                  <td>{{ item.created_at | date: 'short' }}</td>
                  <td>{{ item.recipient_email }}</td>
                  <td>{{ item.period_key }} @if (item.is_test) { <nz-tag>TEST</nz-tag> }</td>
                  <td>
                    <nz-tag [nzColor]="statusColor(item.status)">
                      {{ 'SCHEDULED_REPORT.STATUS.' + item.status.toUpperCase() | translate }}
                    </nz-tag>
                  </td>
                  <td>{{ item.open_count }} / {{ item.click_count }}</td>
                </tr>
              }
            </tbody>
          </nz-table>

          <h4 class="audit-heading">{{ 'SCHEDULED_REPORT.HISTORY.AUDIT_TITLE' | translate }}</h4>
          <nz-table [nzData]="auditLogs()" [nzShowPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.DATE' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.EVENT' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.RECIPIENT' | translate }}</th>
                <th>{{ 'SCHEDULED_REPORT.HISTORY.PERIOD' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (log of auditLogs(); track log.id) {
                <tr>
                  <td>{{ log.occurred_at | date: 'short' }}</td>
                  <td><nz-tag>{{ log.event_type }}</nz-tag></td>
                  <td>{{ log.recipient_email ?? '-' }}</td>
                  <td>{{ log.period_key ?? '-' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <!-- Tab 3: Tenant Admin Settings & Blacklist -->
        @if (canAdminister()) {
          <nz-tab [nzTitle]="'SCHEDULED_REPORT.TAB_ADMIN' | translate" (nzSelect)="loadAdminData()">
            @if (tenantSettings(); as ts) {
              <div nz-row [nzGutter]="24">
                <div nz-col [nzXs]="24" [nzLg]="12">
                  <div class="field-row">
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.TIMEZONE' | translate }}</span>
                      <input nz-input [ngModel]="ts.timezone" (ngModelChange)="patchTenantSettings({ timezone: $event })" />
                    </div>
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.RATE_LIMIT' | translate }}</span>
                      <nz-input-number
                        class="full-width"
                        [ngModel]="ts.rate_limit_per_hour"
                        (ngModelChange)="patchTenantSettings({ rate_limit_per_hour: $event })"
                        [nzMin]="1"
                      ></nz-input-number>
                    </div>
                  </div>
                  <div class="field-row">
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.SENDER_NAME' | translate }}</span>
                      <input nz-input [ngModel]="ts.sender_name ?? ''" (ngModelChange)="patchTenantSettings({ sender_name: $event || null })" />
                    </div>
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.SENDER_EMAIL' | translate }}</span>
                      <input nz-input type="email" [ngModel]="ts.sender_email ?? ''" (ngModelChange)="patchTenantSettings({ sender_email: $event || null })" />
                    </div>
                  </div>
                  <div class="field-group">
                    <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.LOGO_URL' | translate }}</span>
                    <input nz-input [ngModel]="ts.logo_url ?? ''" (ngModelChange)="patchTenantSettings({ logo_url: $event || null })" />
                  </div>
                  <div class="field-row">
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.PRIMARY_COLOR' | translate }}</span>
                      <input nz-input type="color" [ngModel]="ts.primary_color" (ngModelChange)="patchTenantSettings({ primary_color: $event })" />
                    </div>
                    <div class="field-col">
                      <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.SECONDARY_COLOR' | translate }}</span>
                      <input nz-input type="color" [ngModel]="ts.secondary_color" (ngModelChange)="patchTenantSettings({ secondary_color: $event })" />
                    </div>
                  </div>
                  <div class="field-group">
                    <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.CUSTOM_HEADER' | translate }}</span>
                    <textarea nz-input rows="2" [ngModel]="ts.custom_header_html ?? ''" (ngModelChange)="patchTenantSettings({ custom_header_html: $event || null })"></textarea>
                  </div>
                  <div class="field-group">
                    <span class="field-label">{{ 'SCHEDULED_REPORT.ADMIN.CUSTOM_FOOTER' | translate }}</span>
                    <textarea nz-input rows="2" [ngModel]="ts.custom_footer_html ?? ''" (ngModelChange)="patchTenantSettings({ custom_footer_html: $event || null })"></textarea>
                  </div>
                  <div class="actions-bar">
                    <button nz-button nzType="primary" type="button" [nzLoading]="savingAdmin()" (click)="saveTenantSettings()">
                      {{ 'SCHEDULED_REPORT.BTN_SAVE' | translate }}
                    </button>
                  </div>
                </div>

                <div nz-col [nzXs]="24" [nzLg]="12">
                  <h4>{{ 'SCHEDULED_REPORT.ADMIN.BLACKLIST_TITLE' | translate }}</h4>
                  <div class="blacklist-form">
                    <input nz-input [(ngModel)]="newBlacklistEmail" placeholder="user@example.com" />
                    <nz-select [(ngModel)]="newBlacklistReason" class="reason-select">
                      <nz-option nzValue="manual" nzLabel="manual"></nz-option>
                      <nz-option nzValue="hard_bounce" nzLabel="hard_bounce"></nz-option>
                      <nz-option nzValue="spam_complaint" nzLabel="spam_complaint"></nz-option>
                      <nz-option nzValue="unsubscribed" nzLabel="unsubscribed"></nz-option>
                    </nz-select>
                    <button nz-button nzType="primary" type="button" (click)="addBlacklist()">
                      {{ 'SCHEDULED_REPORT.ADMIN.BLACKLIST_ADD' | translate }}
                    </button>
                  </div>
                  <nz-table [nzData]="blacklist()" [nzShowPagination]="false" nzSize="small">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>{{ 'SCHEDULED_REPORT.ADMIN.BLACKLIST_REASON' | translate }}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (entry of blacklist(); track entry.id) {
                        <tr>
                          <td>{{ entry.email }}</td>
                          <td><nz-tag>{{ entry.reason }}</nz-tag></td>
                          <td>
                            @if (!entry.is_global) {
                              <button nz-button nzDanger nzSize="small" type="button" (click)="removeBlacklist(entry.id)">
                                ×
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                </div>
              </div>
            }
          </nz-tab>
        }
      </nz-tabs>
    </nz-card>
  `,
  styles: `
    .scheduled-report-card {
      margin-bottom: 16px;
    }
    .subtitle {
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    .loading-box {
      padding: 32px;
      text-align: center;
    }
    .switch-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .field-group {
      margin-bottom: 14px;
    }
    .field-row {
      display: flex;
      gap: 12px;
      margin-bottom: 14px;
    }
    .field-col {
      flex: 1;
    }
    .field-label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .full-width {
      width: 100%;
    }
    .hint {
      display: block;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 8px;
    }
    .module-tile {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 10px;
    }
    .module-locked {
      opacity: 0.6;
    }
    .module-icon {
      margin-right: 6px;
    }
    .actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 10px;
    }
    .preview-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .preview-frame-wrap {
      background: #f3f4f6;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      justify-content: center;
    }
    .preview-iframe {
      width: 100%;
      height: 540px;
      border: 0;
      background: #ffffff;
      border-radius: 6px;
    }
    .audit-heading {
      margin-top: 20px;
      margin-bottom: 8px;
    }
    .blacklist-form {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .reason-select {
      min-width: 150px;
    }
  `,
})
export class ScheduledErpReportComponent implements OnInit {
  private readonly api = inject(ScheduledReportApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly notification = inject(NzNotificationService);
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  private readonly previewRefresh$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly sendingTest = signal(false);
  readonly sendingNow = signal(false);
  readonly previewLoading = signal(false);
  readonly savingAdmin = signal(false);
  readonly viewport = signal<'desktop' | 'mobile'>('desktop');

  readonly preference = signal<ScheduledNotificationPreference | null>(null);
  readonly tenantSettings = signal<TenantReportSettings | null>(null);
  readonly rawPreviewHtml = signal('');
  readonly deliveries = signal<ScheduledReportDeliveryLog[]>([]);
  readonly auditLogs = signal<ScheduledReportAuditLogEntry[]>([]);
  readonly blacklist = signal<EmailBlacklistEntry[]>([]);

  readonly previewHtml = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.rawPreviewHtml()),
  );

  readonly canAdminister = computed(() => this.permissions.canWrite('system'));

  newBlacklistEmail = '';
  newBlacklistReason: EmailBlacklistEntry['reason'] = 'manual';

  readonly modules = MODULE_DESCRIPTORS;
  readonly frequencies: readonly { value: ScheduledReportFrequency; labelKey: string }[] = [
    { value: 'daily', labelKey: 'SCHEDULED_REPORT.FREQ.DAILY' },
    { value: 'weekly', labelKey: 'SCHEDULED_REPORT.FREQ.WEEKLY' },
    { value: 'monthly', labelKey: 'SCHEDULED_REPORT.FREQ.MONTHLY' },
    { value: 'custom_cron', labelKey: 'SCHEDULED_REPORT.FREQ.CUSTOM_CRON' },
  ];
  readonly languages: readonly { value: ScheduledReportLanguage; labelKey: string }[] = [
    { value: 'it-CH', labelKey: 'SCHEDULED_REPORT.LANG.IT_CH' },
    { value: 'de-CH', labelKey: 'SCHEDULED_REPORT.LANG.DE_CH' },
    { value: 'fr-CH', labelKey: 'SCHEDULED_REPORT.LANG.FR_CH' },
    { value: 'en', labelKey: 'SCHEDULED_REPORT.LANG.EN' },
    { value: 'it-IT', labelKey: 'SCHEDULED_REPORT.LANG.IT_IT' },
  ];

  ngOnInit(): void {
    this.previewRefresh$
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPreview());

    this.api.getPreferences().subscribe({
      next: (res) => {
        this.preference.set(res.data.preference);
        this.tenantSettings.set(res.data.tenant_settings);
        this.loading.set(false);
        this.loadPreview();
      },
      error: () => this.loading.set(false),
    });
  }

  isModuleLockedByTenant(module: ScheduledReportModuleKey): boolean {
    const allowed = this.tenantSettings()?.enabled_modules;
    return Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(module);
  }

  isModuleEnabled(
    pref: ScheduledNotificationPreference,
    field: ModuleDescriptor['field'],
  ): boolean {
    return pref[field];
  }

  toggleModule(field: ModuleDescriptor['field'], value: boolean): void {
    this.patchPreference({ [field]: value } as Partial<ScheduledNotificationPreference>);
    this.previewRefresh$.next();
  }

  onFrequencyChange(frequency: ScheduledReportFrequency): void {
    this.patchPreference({ frequency });
  }

  onLanguageChange(language: ScheduledReportLanguage): void {
    this.patchPreference({ language });
    this.previewRefresh$.next();
  }

  patchPreference(changes: Partial<ScheduledNotificationPreference>): void {
    const current = this.preference();
    if (current !== null) {
      this.preference.set({ ...current, ...changes });
    }
  }

  patchTenantSettings(changes: Partial<TenantReportSettings>): void {
    const current = this.tenantSettings();
    if (current !== null) {
      this.tenantSettings.set({ ...current, ...changes });
    }
  }

  savePreferences(): void {
    const pref = this.preference();
    if (pref === null) {
      return;
    }

    this.saving.set(true);
    this.api
      .updatePreferences({
        enabled: pref.enabled,
        frequency: pref.frequency,
        custom_cron: pref.custom_cron,
        send_time: pref.send_time,
        day_of_week: pref.day_of_week,
        day_of_month: pref.day_of_month,
        language: pref.language,
        include_dashboard: pref.include_dashboard,
        include_billing: pref.include_billing,
        include_deadlines: pref.include_deadlines,
        include_crm: pref.include_crm,
        include_calendar: pref.include_calendar,
        include_inventory: pref.include_inventory,
        include_support: pref.include_support,
        include_news: pref.include_news,
        include_insights: pref.include_insights,
      })
      .subscribe({
        next: (res) => {
          this.preference.set(res.data);
          this.saving.set(false);
          this.notification.success(
            this.translate.instant('SCHEDULED_REPORT.TITLE'),
            this.translate.instant('SCHEDULED_REPORT.MSG_SAVED'),
          );
        },
        error: () => this.saving.set(false),
      });
  }

  loadPreview(): void {
    const pref = this.preference();
    if (pref === null) {
      return;
    }

    this.previewLoading.set(true);
    this.api
      .getPreview({
        language: pref.language,
        include_dashboard: pref.include_dashboard,
        include_billing: pref.include_billing,
        include_deadlines: pref.include_deadlines,
        include_crm: pref.include_crm,
        include_calendar: pref.include_calendar,
        include_inventory: pref.include_inventory,
        include_support: pref.include_support,
        include_news: pref.include_news,
        include_insights: pref.include_insights,
      })
      .subscribe({
        next: (res) => {
          this.rawPreviewHtml.set(res.data.html);
          this.previewLoading.set(false);
        },
        error: () => this.previewLoading.set(false),
      });
  }

  sendTestEmail(): void {
    this.sendingTest.set(true);
    this.api.sendTest().subscribe({
      next: () => {
        this.sendingTest.set(false);
        this.notification.success(
          this.translate.instant('SCHEDULED_REPORT.BTN_SEND_TEST'),
          this.translate.instant('SCHEDULED_REPORT.MSG_TEST_QUEUED'),
        );
      },
      error: () => this.sendingTest.set(false),
    });
  }

  sendNow(): void {
    this.sendingNow.set(true);
    this.api.sendNow().subscribe({
      next: () => {
        this.sendingNow.set(false);
        this.notification.success(
          this.translate.instant('SCHEDULED_REPORT.BTN_SEND_NOW'),
          this.translate.instant('SCHEDULED_REPORT.MSG_SEND_NOW_QUEUED'),
        );
      },
      error: () => this.sendingNow.set(false),
    });
  }

  loadHistory(): void {
    this.api.getAuditLogs().subscribe((res) => {
      this.deliveries.set(res.data.deliveries);
      this.auditLogs.set(res.data.audit_logs);
    });
  }

  loadAdminData(): void {
    this.api.getTenantSettings().subscribe((res) => this.tenantSettings.set(res.data));
    this.api.getBlacklist().subscribe((res) => this.blacklist.set(res.data));
  }

  saveTenantSettings(): void {
    const ts = this.tenantSettings();
    if (ts === null) {
      return;
    }

    this.savingAdmin.set(true);
    this.api
      .updateTenantSettings({
        timezone: ts.timezone,
        default_frequency: ts.default_frequency,
        default_send_time: ts.default_send_time,
        sender_name: ts.sender_name,
        sender_email: ts.sender_email,
        logo_url: ts.logo_url,
        primary_color: ts.primary_color,
        secondary_color: ts.secondary_color,
        custom_header_html: ts.custom_header_html,
        custom_footer_html: ts.custom_footer_html,
        enabled_modules: ts.enabled_modules,
        rate_limit_per_hour: ts.rate_limit_per_hour,
      })
      .subscribe({
        next: (res) => {
          this.tenantSettings.set(res.data);
          this.savingAdmin.set(false);
          this.notification.success(
            this.translate.instant('SCHEDULED_REPORT.TAB_ADMIN'),
            this.translate.instant('SCHEDULED_REPORT.MSG_SETTINGS_SAVED'),
          );
          this.loadPreview();
        },
        error: () => this.savingAdmin.set(false),
      });
  }

  addBlacklist(): void {
    const email = this.newBlacklistEmail.trim();
    if (!email) {
      return;
    }

    this.api.addBlacklistEntry({ email, reason: this.newBlacklistReason }).subscribe(() => {
      this.newBlacklistEmail = '';
      this.notification.success(
        this.translate.instant('SCHEDULED_REPORT.ADMIN.BLACKLIST_TITLE'),
        this.translate.instant('SCHEDULED_REPORT.MSG_BLACKLIST_ADDED'),
      );
      this.loadAdminData();
    });
  }

  removeBlacklist(id: string): void {
    this.api.deleteBlacklistEntry(id).subscribe(() => {
      this.notification.success(
        this.translate.instant('SCHEDULED_REPORT.ADMIN.BLACKLIST_TITLE'),
        this.translate.instant('SCHEDULED_REPORT.MSG_BLACKLIST_REMOVED'),
      );
      this.loadAdminData();
    });
  }

  statusColor(status: ScheduledReportDeliveryLog['status']): string {
    switch (status) {
      case 'sent':
        return 'green';
      case 'opened':
        return 'blue';
      case 'clicked':
        return 'purple';
      case 'failed':
      case 'generation_failed':
        return 'red';
      default:
        return 'default';
    }
  }
}
