import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { I18nService, PublicCareersPage, PublicJob } from '@core';
import { i18nStub } from '../hr/recruiting/testing/recruiting-fixtures';
import { ApplyFormComponent } from './apply-form.component';
import { validateCv } from './careers-locale';

const API = 'https://api.fatturafacile.eu/api/v1';
const APPLY_URL = `${API}/public/careers/acme/jobs/j1/apply`;

const PAGE: PublicCareersPage = {
  company_name: 'ACME SA',
  intro: 'Join us',
  privacy_notice: 'We process your data for recruiting.',
  privacy_policy_url: 'https://acme.example/privacy',
  consent_text_version: 'v3',
  available_locales: ['it-CH', 'en'],
  retention_months: 6,
};

const JOB: PublicJob = {
  id: 'j1',
  reference: 'JOB-1',
  title: 'Contabile',
  description: 'D',
  requirements: '',
  benefits: '',
  department_name: 'Finance',
  location_site: 'Lugano',
  employment_type: 'full_time',
  salary_range_public: null,
  locale: 'it-CH',
  available_locales: ['it-CH'],
  published_at: '2026-11-01T08:00:00Z',
  closes_at: null,
  apply_url: 'https://app.example/careers/acme/jobs/j1',
};

const pdf = (size = 1000) =>
  new File([new Uint8Array(size)], 'cv.pdf', { type: 'application/pdf' });

describe('ApplyFormComponent', () => {
  let fixture: ComponentFixture<ApplyFormComponent>;
  let component: ApplyFormComponent;
  let http: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  function fillValid(): void {
    component.model.set({
      first_name: 'Luca',
      last_name: 'Neri',
      email: 'luca@example.com',
      phone: '',
      cover_letter: '',
      consent: true,
      website: '',
    });
    component.cvFile.set(pdf());
  }

  beforeEach(async () => {
    environment.apiBaseUrl = API;
    await TestBed.configureTestingModule({
      imports: [ApplyFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ApplyFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('slug', 'acme');
    fixture.componentRef.setInput('job', JOB);
    fixture.componentRef.setInput('page', PAGE);
    fixture.componentRef.setInput('locale', 'it-CH');
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('shows the privacy notice and a visually hidden, empty honeypot', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain(PAGE.privacy_notice);
    const honeypot = el.querySelector<HTMLInputElement>('#apply-website');
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honeypot?.tabIndex).toBe(-1);
    expect(honeypot?.value).toBe('');
  });

  it('refuses to submit without consent', () => {
    fillValid();
    component.model.update((m) => ({ ...m, consent: false }));
    component.submit();
    http.expectNone(APPLY_URL);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'careers.apply.consentRequired',
    );
  });

  it('refuses to submit without a valid CV', () => {
    fillValid();
    component.cvFile.set(null);
    component.submit();
    expect(component.cvError()).toBe('required');

    component.cvFile.set(new File(['x'], 'cv.exe', { type: 'application/octet-stream' }));
    component.submit();
    expect(component.cvError()).toBe('type');

    component.cvFile.set(pdf(5 * 1024 * 1024 + 1));
    component.submit();
    expect(component.cvError()).toBe('size');
    http.expectNone(APPLY_URL);
  });

  it('sends multipart data with consent, consent version and an empty website field', () => {
    fillValid();
    component.submit();
    const req = http.expectOne(APPLY_URL);
    const body = req.request.body as FormData;
    expect(body.get('consent_accepted')).toBe('1');
    expect(body.get('consent_text_version')).toBe('v3');
    expect(body.get('website')).toBe('');
    expect(body.get('locale')).toBe('it-CH');
    expect(body.get('cv')).toBeInstanceOf(File);
    req.flush(
      { data: { reference: 'APP-2026-0007', message: 'We will be in touch.' } },
      { status: 201, statusText: 'Created' },
    );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.result()?.reference).toBe('APP-2026-0007');
    expect(el.textContent).toContain(
      'careers.apply.successReference {"reference":"APP-2026-0007"}',
    );
    expect(el.querySelector('form')).toBeNull();
  });

  it('shows 422 field errors inline', () => {
    fillValid();
    component.submit();
    http
      .expectOne(APPLY_URL)
      .flush(
        {
          message: 'Invalid',
          errors: { email: ['The email domain is not accepted.'], cv: ['The CV is unreadable.'] },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(component.serverErrors()['email']).toBe('The email domain is not accepted.');
    expect(el.textContent).toContain('The CV is unreadable.');
    expect(component.submitError()).toBe('validation');
  });

  it('asks to try later on 429', () => {
    fillValid();
    component.submit();
    http
      .expectOne(APPLY_URL)
      .flush({ message: 'Too Many Attempts.' }, { status: 429, statusText: 'Too Many Requests' });
    fixture.detectChanges();
    expect(component.submitError()).toBe('throttled');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'careers.apply.errors.throttled',
    );
  });
});

describe('validateCv', () => {
  it('accepts pdf/doc/docx up to 5 MB', () => {
    expect(validateCv(new File(['x'], 'a.docx'))).toBeNull();
    expect(validateCv(new File(['x'], 'a.DOC'))).toBeNull();
    expect(validateCv(new File(['x'], 'a.png'))).toBe('type');
    expect(validateCv(null)).toBe('required');
  });
});
