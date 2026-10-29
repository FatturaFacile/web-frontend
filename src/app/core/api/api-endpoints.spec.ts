import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { environment } from '@env';
import { InvoiceApiService } from './invoice-api.service';
import { I18nService } from '../i18n/i18n.service';
import { LookupService } from '../lookups/lookup.service';

/**
 * Every call must go through `environment.apiBaseUrl`: in production the API lives on another origin
 * (api.fatturafacile.eu), so a relative `/api/...` URL would hit the frontend host instead.
 */
describe('API endpoints', () => {
  const base = 'https://api.fatturafacile.eu/api/v1';
  const originalApiBaseUrl = environment.apiBaseUrl;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    environment.apiBaseUrl = base;

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  /** I18nService loads the initial dictionaries as soon as it is created. */
  const flushInitialTranslations = () =>
    httpTesting
      .match((r) => r.url.startsWith(`${base}/translations/`))
      .forEach((r) => r.flush({ translations: {} }));

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('downloads the QR-bill of an invoice from the invoices endpoint', () => {
    TestBed.inject(InvoiceApiService).downloadQrBill('inv-1').subscribe();

    const req = httpTesting.expectOne(`${base}/sales/invoices/inv-1/download-qr-bill`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('loads translations from the versioned API', async () => {
    const i18n = TestBed.inject(I18nService);
    flushInitialTranslations();
    const loaded = i18n.loadDictionary('de');

    const req = httpTesting.expectOne((r) => r.url === `${base}/translations/de`);
    expect(req.request.method).toBe('GET');
    req.flush({ translations: { hello: 'Hallo' } });

    expect(await loaded).toEqual({ hello: 'Hallo' });
  });

  it('loads lookups from the versioned API', async () => {
    const lookups = TestBed.inject(LookupService);
    flushInitialTranslations();
    const loaded = lookups.getLookup('payment_methods');

    const req = httpTesting.expectOne((r) => r.url === `${base}/lookups/payment_methods`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });

    await loaded;
  });
});
