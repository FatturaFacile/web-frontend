import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../i18n';
import { errorInterceptor, HANDLED_ERROR_STATUSES } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const message = { error: vi.fn(), warning: vi.fn() };

  beforeEach(() => {
    message.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('toasts API errors by default', () => {
    http.get('/api/x').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/x')
      .flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    expect(message.error).toHaveBeenCalledWith('Conflict');
  });

  it('leaves statuses declared as handled by the caller alone', () => {
    const context = new HttpContext().set(HANDLED_ERROR_STATUSES, [404, 409]);
    http.get('/api/x', { context }).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/x')
      .flush({ code: 'invalid_transition' }, { status: 409, statusText: 'Conflict' });
    expect(message.error).not.toHaveBeenCalled();

    http.get('/api/y', { context }).subscribe({ error: () => undefined });
    controller
      .expectOne('/api/y')
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });
    expect(message.error).toHaveBeenCalledWith('Boom');
  });
});
