import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LOCALLY_HANDLED_ERROR_STATUSES } from '../http/error-handling.context';
import { PublicCareersApiService } from './public-careers-api.service';

const API = 'https://api.fatturafacile.eu/api/v1';
const BASE = `${API}/public/careers/acme`;

describe('PublicCareersApiService', () => {
  let service: PublicCareersApiService;
  let http: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = API;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicCareersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('loads the careers page meta for a locale and handles 404 itself', () => {
    service.getPage('acme', 'de-CH').subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('locale')).toBe('de-CH');
    expect(req.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toContain(404);
    expect(req.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toContain(401);
    req.flush({ data: {} });
  });

  it('lists published jobs with filters', () => {
    service
      .listJobs('acme', {
        locale: 'fr-CH',
        employment_type: 'part_time',
        search: 'compta',
        page: 1,
        per_page: 10,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/jobs`);
    expect(req.request.params.get('locale')).toBe('fr-CH');
    expect(req.request.params.get('employment_type')).toBe('part_time');
    expect(req.request.params.get('search')).toBe('compta');
    req.flush({ data: [], meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 } });
  });

  it('loads one job', () => {
    service.getJob('acme', 'j1', 'en').subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/jobs/j1`);
    expect(req.request.params.get('locale')).toBe('en');
    req.flush({ data: {} });
  });

  it('applies with multipart form data including consent and an empty honeypot', () => {
    const cv = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    service
      .apply('acme', 'j1', {
        first_name: 'Luca',
        last_name: 'Neri',
        email: 'luca@example.com',
        locale: 'it-CH',
        consent_accepted: true,
        consent_text_version: 'v3',
        cv,
      })
      .subscribe();
    const req = http.expectOne(`${BASE}/jobs/j1/apply`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('consent_accepted')).toBe('1');
    expect(body.get('consent_text_version')).toBe('v3');
    expect(body.get('locale')).toBe('it-CH');
    expect(body.get('website')).toBe('');
    expect((body.get('cv') as File).name).toBe('cv.pdf');
    req.flush(
      { data: { reference: 'APP-1', message: 'ok' } },
      { status: 201, statusText: 'Created' },
    );
  });

  it('builds feed URLs', () => {
    expect(service.feedJsonUrl('acme')).toBe(`${BASE}/feed.json`);
    expect(service.feedRssUrl('acme', 'de-CH')).toBe(`${BASE}/feed.rss?locale=de-CH`);
  });
});
