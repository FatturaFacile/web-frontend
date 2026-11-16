import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { PlatformApiService } from '@core/api/platform-api.service';
import { TEST_API_BASE_URL } from '../../../testing/api';

describe('PlatformApiService', () => {
  const base = `${TEST_API_BASE_URL}/platform`;
  const originalApiBaseUrl = environment.apiBaseUrl;
  let service: PlatformApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlatformApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('calls the recycle bin endpoints', () => {
    service.getRecycleBinTypes().subscribe();
    httpTesting.expectOne(`${base}/recycle-bin/types`).flush({ data: [] });

    service.getRecycleBin('contacts', 2, 50).subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/recycle-bin`);
    expect(list.request.params.get('type')).toBe('contacts');
    expect(list.request.params.get('page')).toBe('2');
    expect(list.request.params.get('per_page')).toBe('50');
    list.flush({ data: [] });

    service.restoreRecord('contacts', 'id-1').subscribe();
    expect(httpTesting.expectOne({ method: 'POST', url: `${base}/recycle-bin/contacts/id-1/restore` })).toBeTruthy();

    service.destroyRecord('contacts', 'id-1').subscribe();
    expect(httpTesting.expectOne({ method: 'DELETE', url: `${base}/recycle-bin/contacts/id-1` })).toBeTruthy();
  });

  it('calls the notification endpoints', () => {
    service.getNotifications(true, 5).subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/notifications`);
    expect(list.request.params.get('unread')).toBe('1');
    expect(list.request.params.get('per_page')).toBe('5');

    service.markNotificationRead('n1').subscribe();
    expect(httpTesting.expectOne({ method: 'POST', url: `${base}/notifications/n1/read` })).toBeTruthy();

    service.markAllNotificationsRead().subscribe();
    expect(httpTesting.expectOne({ method: 'POST', url: `${base}/notifications/read-all` })).toBeTruthy();

    service.deleteNotification('n1').subscribe();
    expect(httpTesting.expectOne({ method: 'DELETE', url: `${base}/notifications/n1` })).toBeTruthy();

    service.getNotificationPreferences().subscribe();
    expect(httpTesting.expectOne({ method: 'GET', url: `${base}/notifications/preferences` })).toBeTruthy();

    const body = { preferences: [{ channel: 'mail' as const, category: 'billing' as const, enabled: false }] };
    service.updateNotificationPreferences(body).subscribe();
    const put = httpTesting.expectOne({ method: 'PUT', url: `${base}/notifications/preferences` });
    expect(put.request.body).toEqual(body);
  });

  it('calls the notification settings and realtime endpoints', () => {
    service.getNotificationSettings().subscribe();
    httpTesting.expectOne({ method: 'GET', url: `${base}/notifications/settings` }).flush({ data: {} });

    service.updateNotificationSettings({ quiet_hours_enabled: true, quiet_start: '22:00' }).subscribe();
    const put = httpTesting.expectOne({ method: 'PUT', url: `${base}/notifications/settings` });
    expect(put.request.body).toEqual({ quiet_hours_enabled: true, quiet_start: '22:00' });
    put.flush({ data: {} });

    service.getNotificationRealtime().subscribe();
    httpTesting.expectOne({ method: 'GET', url: `${base}/notifications/realtime` }).flush({ data: { enabled: false } });
  });

  it('calls the delivery, device, Telegram and alert rule endpoints', () => {
    service.getNotificationDeliveries('failed', 2).subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/notifications/deliveries`);
    expect(list.request.params.get('status')).toBe('failed');
    expect(list.request.params.get('page')).toBe('2');
    list.flush({ data: [] });

    service.getNotificationDevices().subscribe();
    httpTesting.expectOne({ method: 'GET', url: `${base}/notifications/devices` }).flush({ data: [] });
    service.deleteNotificationDevice('d1').subscribe();
    httpTesting.expectOne({ method: 'DELETE', url: `${base}/notifications/devices/d1` }).flush(null);

    service.linkTelegram().subscribe();
    httpTesting.expectOne({ method: 'POST', url: `${base}/notifications/channels/telegram/link` }).flush({ data: { url: 'https://t.me/x' } });
    service.unlinkTelegram().subscribe();
    httpTesting.expectOne({ method: 'DELETE', url: `${base}/notifications/channels/telegram` }).flush(null);

    const rule = { name: 'Unpaid', metric: 'customer_overdue_total', threshold: 10000, currency: 'CHF', category: 'billing' as const, is_active: true };
    service.getAlertRules().subscribe();
    httpTesting.expectOne({ method: 'GET', url: `${base}/notification-alert-rules` }).flush({ data: [], metrics: [] });
    service.createAlertRule(rule).subscribe();
    expect(httpTesting.expectOne({ method: 'POST', url: `${base}/notification-alert-rules` }).request.body).toEqual(rule);
    service.updateAlertRule('r1', rule).subscribe();
    httpTesting.expectOne({ method: 'PUT', url: `${base}/notification-alert-rules/r1` }).flush({ data: {} });
    service.deleteAlertRule('r1').subscribe();
    httpTesting.expectOne({ method: 'DELETE', url: `${base}/notification-alert-rules/r1` }).flush(null);
  });
});
