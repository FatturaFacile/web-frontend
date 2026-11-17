import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { errorInterceptor, I18nService, PublicCareersPage, tenantAuthInterceptor } from '@core';
import { i18nStub } from '../hr/recruiting/testing/recruiting-fixtures';
import { CareersHomeComponent } from './careers-home.component';

const API = 'https://api.fatturafacile.eu/api/v1';
const BASE = `${API}/public/careers/acme`;

const PAGE: PublicCareersPage = {
  company_name: 'ACME SA',
  intro: 'Join us',
  privacy_notice: 'Privacy',
  privacy_policy_url: null,
  consent_text_version: 'v1',
  available_locales: ['it-CH', 'de-CH', 'en'],
  retention_months: 6,
};

describe('CareersHomeComponent (public portal)', () => {
  let http: HttpTestingController;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let i18n: ReturnType<typeof i18nStub>;
  let message: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  let notification: { error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn> };
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(async () => {
    environment.apiBaseUrl = API;
    localStorage.clear();
    query = new BehaviorSubject(convertToParamMap({ embed: '1', locale: 'de-CH' }));
    i18n = i18nStub();
    i18n.setLanguage = vi.fn(() => Promise.resolve({}));
    message = { error: vi.fn(), warning: vi.fn() };
    notification = { error: vi.fn(), warning: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CareersHomeComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([tenantAuthInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(convertToParamMap({ slug: 'acme' })),
            queryParamMap: query,
          },
        },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
        { provide: NzNotificationService, useValue: notification },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('renders jobs in the selected locale without chrome in embed mode and without tenant headers', () => {
    const fixture = TestBed.createComponent(CareersHomeComponent);
    fixture.detectChanges();

    const pageReq = http.expectOne((r) => r.url === BASE);
    expect(pageReq.request.params.get('locale')).toBe('de-CH');
    expect(pageReq.request.headers.has('X-Tenant-Id')).toBe(false);
    pageReq.flush({ data: PAGE });

    const jobsReq = http.expectOne((r) => r.url === `${BASE}/jobs`);
    expect(jobsReq.request.params.get('locale')).toBe('de-CH');
    jobsReq.flush({
      data: [
        {
          id: 'j1',
          reference: 'JOB-1',
          title: 'Buchhalter/in',
          description: '',
          requirements: '',
          benefits: '',
          department_name: 'Finanzen',
          location_site: 'Zürich',
          employment_type: 'full_time',
          salary_range_public: null,
          locale: 'de-CH',
          available_locales: ['de-CH'],
          published_at: '2026-11-01T08:00:00Z',
          closes_at: null,
          apply_url: '',
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains('embed')).toBe(true);
    expect(el.querySelector('.portal__header')).toBeNull();
    expect(el.textContent).toContain('Buchhalter/in');
    expect(i18n.setLanguage).toHaveBeenCalledWith('de');
  });

  it('shows a not-found state for an unknown slug without redirecting to login or toasting', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    localStorage.setItem('auth_token', 'stale-token');
    query.next(convertToParamMap({}));

    const fixture = TestBed.createComponent(CareersHomeComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === BASE)
      .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    http
      .expectOne((r) => r.url === `${BASE}/jobs`)
      .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('careers.notFoundTitle');
    expect(navigate).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('shows the empty state when there are no jobs', () => {
    query.next(convertToParamMap({}));
    const fixture = TestBed.createComponent(CareersHomeComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === BASE).flush({ data: PAGE });
    http
      .expectOne((r) => r.url === `${BASE}/jobs`)
      .flush({ data: [], meta: { current_page: 1, last_page: 1, per_page: 10, total: 0 } });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('careers.noJobs');
    expect(el.querySelector('.portal__header')).not.toBeNull();
  });
});
