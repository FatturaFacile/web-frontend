import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { NotificationRealtimeService } from './notification-realtime.service';
import { TEST_API_BASE_URL } from '../../../testing/api';

describe('NotificationRealtimeService', () => {
  const originalApiBaseUrl = environment.apiBaseUrl;
  let service: NotificationRealtimeService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    environment.apiBaseUrl = TEST_API_BASE_URL;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationRealtimeService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('stays disconnected (polling fallback) when the server does not advertise realtime', async () => {
    const started = service.start();
    httpTesting
      .expectOne(`${TEST_API_BASE_URL}/platform/notifications/realtime`)
      .flush({ data: { enabled: false, key: null, host: null, port: null, scheme: null, channel: 'users.1.notifications', auth_endpoint: '/api/v1/broadcasting/auth' } });
    await started;

    expect(service.connected()).toBe(false);
    expect(service.changes()).toBeNull();
  });

  it('stays disconnected when the configuration request fails', async () => {
    const started = service.start();
    httpTesting.expectOne(`${TEST_API_BASE_URL}/platform/notifications/realtime`).flush(null, { status: 500, statusText: 'Server Error' });
    await started;

    expect(service.connected()).toBe(false);
  });
});
