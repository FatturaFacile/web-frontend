import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LOCALLY_HANDLED_ERROR_STATUSES } from '../http/error-handling.context';
import { CurrencyApiService } from './currency-api.service';

describe('CurrencyApiService', () => {
  let api: CurrencyApiService;
  let http: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CurrencyApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('lists the rates with the filters as query parameters, dropping the empty ones', () => {
    api
      .listRates({ base: 'EUR', quote: 'CHF', rate_type: '', from: '2026-11-01', page: 2 })
      .subscribe();

    const request = http.expectOne((req) => req.url === `${base}/currencies/rates`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('base')).toBe('EUR');
    expect(request.request.params.get('from')).toBe('2026-11-01');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.has('rate_type')).toBe(false);
    request.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('resolves a rate for a pair and a date', () => {
    api
      .resolveRate({ base: 'EUR', quote: 'CHF', date: '2026-11-20', rate_type: 'mid' })
      .subscribe();

    const request = http.expectOne((req) => req.url === `${base}/currencies/rates/resolve`);
    expect(request.request.params.get('date')).toBe('2026-11-20');
    expect(request.request.params.has('contract_reference')).toBe(false);
    request.flush({ success: true, message: '', data: {} });
  });

  it('sends a manual rate as a decimal string', () => {
    api
      .createRate({
        base: 'EUR',
        quote: 'CHF',
        rate: '0.941200',
        valid_on: '2026-11-20',
        rate_type: 'mid',
      })
      .subscribe();

    const request = http.expectOne(`${base}/currencies/rates`);
    expect(request.request.method).toBe('POST');
    expect(typeof request.request.body.rate).toBe('string');
    expect(request.request.body.rate).toBe('0.941200');
    request.flush({ success: true, message: '', data: {} });
  });

  it('downloads the audit export as a blob', () => {
    api.exportRates({ from: '2026-01-01', to: '2026-12-31' }, 'xlsx').subscribe();

    const request = http.expectOne((req) => req.url === `${base}/currencies/rates/export`);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.get('format')).toBe('xlsx');
    expect(request.request.params.get('to')).toBe('2026-12-31');
    request.flush(new Blob(['x']));
  });

  it('queues a synchronisation and handles the 409 itself', () => {
    api.syncRates().subscribe();

    const request = http.expectOne(`${base}/currencies/rates/sync`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toContain(409);
    request.flush(
      { success: true, message: '', data: { runs: [] } },
      { status: 202, statusText: 'Accepted' },
    );

    api.syncRates(['ecb']).subscribe();
    expect(http.expectOne(`${base}/currencies/rates/sync`).request.body).toEqual({
      providers: ['ecb'],
    });
  });

  it('reads the exposure of a date and the settings, and updates the settings', () => {
    api.getExposure('2026-11-26').subscribe();
    const exposure = http.expectOne((req) => req.url === `${base}/currencies/exposure`);
    expect(exposure.request.params.get('as_of')).toBe('2026-11-26');
    exposure.flush({ success: true, message: '', data: {} });

    api.getSettings().subscribe();
    http.expectOne(`${base}/settings/currencies`).flush({ success: true, message: '', data: {} });

    api
      .updateSettings({
        active_currencies: ['CHF', 'EUR'],
        alert_threshold_percent: '2.50',
        unrealized_gain_treatment: 'provision',
        vat_rate_method: 'daily',
      })
      .subscribe();
    const update = http.expectOne(`${base}/settings/currencies`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body.alert_threshold_percent).toBe('2.50');
    expect(update.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toContain(409);
    update.flush({ success: true, message: '', data: {} });
  });

  it('posts a revaluation with the Idempotency-Key header and reverses it', () => {
    api.simulateRevaluation({ period_end: '2026-10-31', period_type: 'monthly' }).subscribe();
    http
      .expectOne(`${base}/accounting/fx-revaluations`)
      .flush({ success: true, message: '', data: {} });

    api.postRevaluation('r-1', 'key-123').subscribe();
    const post = http.expectOne(`${base}/accounting/fx-revaluations/r-1/post`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe('key-123');
    expect(post.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toContain(409);
    post.flush({ success: true, message: '', data: {} });

    api.reverseRevaluation('r-1').subscribe();
    const reverse = http.expectOne(`${base}/accounting/fx-revaluations/r-1/reverse`);
    expect(reverse.request.method).toBe('POST');
    reverse.flush({ success: true, message: '', data: {} });
  });
});
