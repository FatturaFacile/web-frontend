import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { I18nService } from '@core/i18n/i18n.service';

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

  it('has no bundled fallback: the keys are shown while the translations call fails', async () => {
    httpTesting
      .expectOne((req) => req.url.endsWith('/translations/it'))
      .error(new ProgressEvent('error'));

    await vi.waitFor(() => expect(service.translate('NAV.DASHBOARD')).toBe('NAV.DASHBOARD'));
    expect(httpTesting.match('/assets/i18n/it.json')).toHaveLength(0);
  });

  it('does not request any static file when the API returns no translations', async () => {
    httpTesting
      .expectOne((req) => req.url.endsWith('/translations/it'))
      .flush({ locale: 'it', translations: {} });

    await vi.waitFor(() => expect(service.translate('NAV.DASHBOARD')).toBe('NAV.DASHBOARD'));
    expect(httpTesting.match((req) => req.url.includes('/assets/i18n/'))).toHaveLength(0);
  });

  it('resolves hierarchical dot-notation keys and supports instant() with params', async () => {
    httpTesting.expectOne((req) => req.url.endsWith('/translations/it')).flush({
      locale: 'it',
      translations: {
        cases: {
          errors: {
            loadFailed: 'Errore nel caricamento pratiche',
          },
          deleteModal: {
            content: 'Sei sicuro di voler eliminare la pratica {id}?',
          },
        },
      },
    });

    await vi.waitFor(() => {
      expect(service.instant('cases.errors.loadFailed')).toBe('Errore nel caricamento pratiche');
      expect(service.instant('cases.deleteModal.content', { id: 'PR-102' })).toBe(
        'Sei sicuro di voler eliminare la pratica PR-102?',
      );
    });
  });

  it('returns an empty dictionary and asks the API again on the next call after a failure', async () => {
    const result = service.loadDictionary('de');

    httpTesting
      .expectOne((req) => req.url.endsWith('/translations/de'))
      .error(new ProgressEvent('error'));
    await expect(result).resolves.toEqual({});

    const retry = service.loadDictionary('de');
    httpTesting
      .expectOne((req) => req.url.endsWith('/translations/de'))
      .flush({ locale: 'de', translations: { 'NAV.DASHBOARD': 'Übersicht' } });
    await expect(retry).resolves.toEqual({ 'NAV.DASHBOARD': 'Übersicht' });
  });
});
