import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionsService, TranslateService } from '@core';
import { environment } from '@env';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledErpReportComponent } from './scheduled-erp-report.component';

describe('ScheduledErpReportComponent', () => {
  const base = environment.apiBaseUrl;
  let fixture: ComponentFixture<ScheduledErpReportComponent>;
  let component: ScheduledErpReportComponent;
  let http: HttpTestingController;
  const notification = { success: vi.fn(), error: vi.fn() };
  const permissions = { canWrite: vi.fn(() => true), canRead: vi.fn(() => true) };

  const mockPayload = {
    preference: {
      enabled: true,
      frequency: 'daily',
      custom_cron: null,
      send_time: '07:00',
      day_of_week: null,
      day_of_month: null,
      language: 'it-CH',
      include_dashboard: true,
      include_billing: true,
      include_deadlines: true,
      include_crm: true,
      include_calendar: true,
      include_inventory: false,
      include_support: true,
      include_news: true,
      include_insights: true,
    },
    tenant_settings: {
      timezone: 'Europe/Zurich',
      default_frequency: 'daily',
      default_send_time: '07:00',
      sender_name: 'FatturaFacile',
      sender_email: 'reports@example.com',
      logo_url: null,
      primary_color: '#1890ff',
      secondary_color: '#001529',
      custom_header_html: null,
      custom_footer_html: null,
      enabled_modules: ['dashboard', 'billing', 'deadlines', 'crm', 'calendar', 'support', 'news', 'insights'],
      rate_limit_per_hour: 1000,
    },
    available_modules: ['dashboard', 'billing', 'deadlines', 'crm', 'calendar', 'inventory', 'support', 'news', 'insights'],
    supported_languages: ['it-CH', 'de-CH', 'fr-CH', 'en', 'it-IT'],
    frequencies: ['daily', 'weekly', 'monthly', 'custom_cron'],
  };

  beforeEach(() => {
    notification.success.mockReset();
    notification.error.mockReset();
    TestBed.configureTestingModule({
      imports: [ScheduledErpReportComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NzNotificationService, useValue: notification },
        { provide: PermissionsService, useValue: permissions },
        { provide: TranslateService, useValue: { translate: (k: string) => k, instant: (k: string) => k } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ScheduledErpReportComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  function initAndFlushPreview(): void {
    fixture.detectChanges();
    http.expectOne(`${base}/notification-preferences`).flush({
      success: true,
      message: '',
      data: mockPayload,
    });
    http
      .expectOne((req) => req.url === `${base}/reports/daily-summary/preview`)
      .flush({
        success: true,
        message: '',
        data: { html: '<html><body>Preview</body></html>', text: 'Preview', summary: {} },
      });
    fixture.detectChanges();
  }

  it('loads preferences, detects tenant-locked modules, and renders live preview', () => {
    initAndFlushPreview();

    expect(component.loading()).toBe(false);
    expect(component.preference()?.language).toBe('it-CH');
    expect(component.isModuleLockedByTenant('inventory')).toBe(true);
    expect(component.isModuleLockedByTenant('billing')).toBe(false);
    expect(component.rawPreviewHtml()).toContain('Preview');
  });

  it('saves updated preferences and triggers send-test and send-now actions', () => {
    initAndFlushPreview();

    component.patchPreference({ language: 'de-CH', send_time: '06:30' });
    component.savePreferences();

    const saveReq = http.expectOne(`${base}/notification-preferences`);
    expect(saveReq.request.method).toBe('PUT');
    expect(saveReq.request.body.language).toBe('de-CH');
    saveReq.flush({ success: true, message: '', data: { ...mockPayload.preference, language: 'de-CH', send_time: '06:30' } });
    expect(notification.success).toHaveBeenCalledTimes(1);

    component.sendTestEmail();
    http.expectOne(`${base}/reports/daily-summary/send-test`).flush({
      success: true,
      message: '',
      data: { queued: true, recipient_email: 'user@example.com', is_test: true },
    });
    expect(notification.success).toHaveBeenCalledTimes(2);

    component.sendNow();
    http.expectOne(`${base}/reports/daily-summary/send-now`).flush({
      success: true,
      message: '',
      data: { queued: true, recipient_email: 'user@example.com', is_test: false },
    });
    expect(notification.success).toHaveBeenCalledTimes(3);
  });

  it('loads delivery history and admin blacklist management', () => {
    initAndFlushPreview();

    component.loadHistory();
    http.expectOne(`${base}/reports/daily-summary/audit-logs`).flush({
      success: true,
      message: '',
      data: { deliveries: [], audit_logs: [] },
    });

    component.loadAdminData();
    http.expectOne(`${base}/tenant-report-settings`).flush({
      success: true,
      message: '',
      data: mockPayload.tenant_settings,
    });
    http.expectOne(`${base}/email-blacklist`).flush({
      success: true,
      message: '',
      data: [],
    });

    expect(component.statusColor('opened')).toBe('blue');
    expect(component.statusColor('failed')).toBe('red');
  });
});
