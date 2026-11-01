import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { tenantAuthInterceptor } from './tenant-auth.interceptor';
import { environment } from '@env';

describe('tenantAuthInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let notificationService: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    localStorage.clear();
    environment.apiBaseUrl = 'https://api.fatturafacile.eu/api/v1';

    notificationService = {
      error: vi.fn(),
      warning: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: NzNotificationService, useValue: notificationService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    environment.apiBaseUrl = originalApiBaseUrl;
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  it('should attach Authorization header when token is stored', () => {
    localStorage.setItem('auth_token', 'jwt-test-token-123');

    http.get('https://api.fatturafacile.eu/api/v1/sales/invoices').subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/sales/invoices');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-test-token-123');
    req.flush([]);
  });

  it('should attach X-Tenant-Id header dynamically from storage', () => {
    localStorage.setItem('ff_active_tenant_id', 'tenant-uuid-456');

    http.get('https://api.fatturafacile.eu/api/v1/crm/contacts').subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/crm/contacts');
    expect(req.request.headers.get('X-Tenant-Id')).toBe('tenant-uuid-456');
    req.flush([]);
  });

  it('should attach X-Language-Code header dynamically from storage', () => {
    localStorage.setItem('lang', 'fr');

    http.get('https://api.fatturafacile.eu/api/v1/dashboard/kpi-summary').subscribe();

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/dashboard/kpi-summary');
    expect(req.request.headers.get('X-Language-Code')).toBe('fr');
    req.flush({});
  });

  it('should handle 422 Unprocessable Entity by surfacing validation errors', () => {
    let errorCaught = false;

    http.post('https://api.fatturafacile.eu/api/v1/sales/invoices', {}).subscribe({
      error: () => {
        errorCaught = true;
      },
    });

    const req = httpTesting.expectOne('https://api.fatturafacile.eu/api/v1/sales/invoices');
    req.flush(
      {
        message: 'The given data was invalid.',
        errors: {
          client_id: ['Il cliente è obbligatorio.'],
          items: ['Inserire almeno una riga.'],
        },
      },
      { status: 422, statusText: 'Unprocessable Entity' }
    );

    expect(errorCaught).toBe(true);
    expect(notificationService.error).toHaveBeenCalled();
  });
});
