import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { errorInterceptor } from './error.interceptor';
import { AuthStore } from '../auth/auth.store';
import { I18nService } from '../i18n';

describe('errorInterceptor (RFC 7807 Problem Details)', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let authStore: InstanceType<typeof AuthStore>;
  let router: Router;
  let messageService: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let mockI18n: { translate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    TestBed.resetTestingModule();
    messageService = {
      error: vi.fn(),
      warning: vi.fn(),
    };
    mockI18n = {
      translate: vi.fn((k: string) => k),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        { provide: I18nService, useValue: mockI18n },
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: messageService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTesting.match(() => true);
  });

  it('triggers twoFactorSetupRequired when 403 problem is two-factor-setup-required', () => {
    http.get('/api/v1/crm/contacts').subscribe({
      error: () => {},
    });

    const req = httpTesting.expectOne('/api/v1/crm/contacts');
    req.flush(
      {
        type: 'urn:fatturafacile:problem:two-factor-setup-required',
        title: 'Two Factor Setup Required',
        detail: 'Devi configurare il 2FA per accedere.',
        status: 403,
      },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(authStore.twoFactorSetupRequired()).toBe(true);
    expect(messageService.warning).toHaveBeenCalledWith(
      'Devi configurare il 2FA per accedere.'
    );
  });

  it('displays warning on 409 conflict with detail', () => {
    http.put('/api/v1/crm/leads/1', {}).subscribe({
      error: () => {},
    });

    const req = httpTesting.expectOne('/api/v1/crm/leads/1');
    req.flush(
      {
        title: 'Conflict',
        detail: 'Il lead è già stato assegnato a un altro utente.',
        status: 409,
      },
      { status: 409, statusText: 'Conflict' }
    );

    expect(messageService.warning).toHaveBeenCalledWith(
      'Il lead è già stato assegnato a un altro utente.'
    );
  });

  it('displays warning on 429 too many requests', () => {
    http.get('/api/v1/search').subscribe({
      error: () => {},
    });

    const req = httpTesting.expectOne('/api/v1/search');
    req.flush(
      {
        title: 'Too Many Requests',
        detail: 'Troppe richieste: attendi 60 secondi.',
        status: 429,
      },
      { status: 429, statusText: 'Too Many Requests' }
    );

    expect(messageService.warning).toHaveBeenCalledWith(
      'Troppe richieste: attendi 60 secondi.'
    );
  });

  it('logs out and redirects to /login on 401 on protected endpoint', () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    authStore.login();
    expect(authStore.isAuthenticated()).toBe(true);

    http.get('/api/v1/documents').subscribe({
      error: () => {},
    });

    const req = httpTesting.expectOne('/api/v1/documents');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authStore.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });
});
