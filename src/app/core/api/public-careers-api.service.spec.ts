import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { PublicCareersApiService } from './public-careers-api.service';

describe('PublicCareersApiService', () => {
  let service: PublicCareersApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/public/careers/acme`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PublicCareersApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PublicCareersApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the careers page, the openings and one opening', () => {
    service.getCareersPage('acme', 'it').subscribe();
    const page = httpMock.expectOne((r) => r.url === base);
    expect(page.request.params.get('locale')).toBe('it');
    page.flush({ data: {} });

    service.getJobs('acme', { search: 'dev', per_page: 10 }).subscribe();
    const jobs = httpMock.expectOne((r) => r.url === `${base}/jobs`);
    expect(jobs.request.method).toBe('GET');
    expect(jobs.request.params.get('search')).toBe('dev');
    jobs.flush({ data: [] });

    service.getJob('acme', 'j1').subscribe();
    httpMock.expectOne(`${base}/jobs/j1`).flush({ data: {} });
  });

  it('sends the application as multipart form data', () => {
    const cv = new File(['x'], 'cv.pdf', { type: 'application/pdf' });
    service
      .apply('acme', 'j1', {
        first_name: 'Mario',
        last_name: 'Rossi',
        email: 'm@r.it',
        locale: 'it',
        consent_accepted: true,
        consent_text_version: 'v1',
        cv,
      })
      .subscribe();
    const req = httpMock.expectOne(`${base}/jobs/j1/apply`);
    const form = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(form.get('first_name')).toBe('Mario');
    expect(form.get('consent_accepted')).toBe('1');
    expect(form.has('phone')).toBe(false);
    expect(form.get('cv')).toBeInstanceOf(File);
    req.flush({ data: {} });
  });
});
