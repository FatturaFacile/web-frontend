import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('lang', 'it');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(I18nService);
  });

  afterEach(() => {
    httpTesting.match(() => true);
    localStorage.removeItem('lang');
  });

  it('uses the API dictionary when the translations call succeeds', async () => {
    httpTesting.expectOne((req) => req.url.endsWith('/translations/it')).flush({
      locale: 'it',
      translations: { 'NAV.DASHBOARD': 'Dashboard API' },
    });

    await vi.waitFor(() => expect(service.translate('NAV.DASHBOARD')).toBe('Dashboard API'));
    expect(httpTesting.match('/assets/i18n/it.json')).toHaveLength(0);
  });

  it('falls back to the bundled dictionary when the translations call fails', async () => {
    httpTesting
      .expectOne((req) => req.url.endsWith('/translations/it'))
      .error(new ProgressEvent('error'));

    await vi.waitFor(() => httpTesting.expectOne('/assets/i18n/it.json').flush({ 'NAV.DASHBOARD': 'Dashboard locale' }));

    await vi.waitFor(() => expect(service.translate('NAV.DASHBOARD')).toBe('Dashboard locale'));
  });

  it('returns an empty dictionary when the fallback is unavailable too', async () => {
    const result = service.loadDictionary('de');

    httpTesting
      .expectOne((req) => req.url.endsWith('/translations/de'))
      .error(new ProgressEvent('error'));
    await vi.waitFor(() =>
      httpTesting.expectOne('/assets/i18n/de.json').flush(null, { status: 404, statusText: 'Not Found' }),
    );

    await expect(result).resolves.toEqual({});
  });
});
