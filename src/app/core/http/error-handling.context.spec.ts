import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { I18nService } from '../i18n';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { tenantAuthInterceptor } from '../interceptors/tenant-auth.interceptor';
import { handleErrorsLocally, isLocallyHandled } from './error-handling.context';

const URL_ = 'https://api.fatturafacile.eu/api/v1/hr/recruiting/applications/a1/move';

describe('locally handled error statuses', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let message: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let notification: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';
    message = { error: vi.fn(), warning: vi.fn() };
    notification = { error: vi.fn(), warning: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([tenantAuthInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: message },
        { provide: NzNotificationService, useValue: notification },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('reports which statuses a request handles', () => {
    const context = handleErrorsLocally(409, 422);
    expect(isLocallyHandled(context, 409)).toBe(true);
    expect(isLocallyHandled(context, 500)).toBe(false);
  });

  it('skips global toasts for statuses handled by the caller', () => {
    http
      .post(URL_, {}, { context: handleErrorsLocally(409, 422) })
      .subscribe({ error: () => undefined });
    httpTesting
      .expectOne(URL_)
      .flush(
        { message: 'x', error_code: 'stage_disabled' },
        { status: 409, statusText: 'Conflict' },
      );
    http
      .post(URL_, {}, { context: handleErrorsLocally(409, 422) })
      .subscribe({ error: () => undefined });
    httpTesting
      .expectOne(URL_)
      .flush({ message: 'x', errors: { a: ['b'] } }, { status: 422, statusText: 'Unprocessable' });
    expect(message.error).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('keeps global handling for other statuses', () => {
    http
      .post(URL_, {}, { context: handleErrorsLocally(409) })
      .subscribe({ error: () => undefined });
    httpTesting
      .expectOne(URL_)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(message.error).toHaveBeenCalledWith('boom');
  });
});
