import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { CandidateApplication, I18nService } from '@core';
import { application, i18nStub } from '../testing/recruiting-fixtures';
import { CandidateDetailComponent } from './candidate-detail.component';
import { CvViewerComponent } from './cv-viewer.component';

const API = 'https://api.fatturafacile.eu/api/v1';
const BASE = `${API}/hr/recruiting/applications/a1`;

describe('CandidateDetailComponent', () => {
  let fixture: ComponentFixture<CandidateDetailComponent>;
  let http: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  async function render(app: CandidateApplication): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CandidateDetailComponent);
    fixture.detectChanges();
    http.expectOne(BASE).flush({ data: app });
    http.expectOne(`${BASE}/scorecards`).flush({ data: [] });
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    environment.apiBaseUrl = API;
    URL.createObjectURL = vi.fn(() => 'blob:test-cv');
    URL.revokeObjectURL = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CandidateDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'a1' })) } },
        { provide: I18nService, useValue: i18nStub() },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('shows the CV on the left and the detail tabs on the right', async () => {
    const el = await render(
      application({
        cv: {
          file_name: 'cv.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1000,
          download_url: '/hr/recruiting/applications/a1/cv',
        },
      }),
    );
    http.expectOne(`${BASE}/cv`).flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    fixture.detectChanges();

    expect(el.querySelector('.split__left app-cv-viewer iframe')?.getAttribute('src')).toBe(
      'blob:test-cv',
    );
    const tabs = Array.from(el.querySelectorAll('.split__right [role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(tabs).toEqual([
      'hr.recruiting.candidate.tabs.profile',
      'hr.recruiting.candidate.tabs.scorecards',
      'hr.recruiting.candidate.tabs.offer',
      'hr.recruiting.candidate.tabs.history',
      'hr.recruiting.candidate.tabs.emails',
    ]);
  });

  it('disables every mutating action for an anonymized candidate', async () => {
    const el = await render(
      application({ is_anonymized: true, full_name: 'Anonymized Candidate', email: null }),
    );
    const toolbarButtons = Array.from(el.querySelectorAll<HTMLButtonElement>('.toolbar button'));
    expect(toolbarButtons.length).toBeGreaterThanOrEqual(3);
    expect(toolbarButtons.every((b) => b.disabled)).toBe(true);
    expect(el.textContent).toContain('hr.recruiting.board.anonymized');
    const component = fixture.componentInstance;
    expect(component.readOnly()).toBe(true);
    component.reparseCv();
    component.extendConsent(6);
    http.expectNone(`${BASE}/reparse-cv`);
    http.expectNone(`${BASE}/extend-consent`);
  });

  it('extends consent for an active candidate', async () => {
    await render(application());
    fixture.componentInstance.extendConsent(12);
    const req = http.expectOne(`${BASE}/extend-consent`);
    expect(req.request.body).toEqual({ months: 12 });
    req.flush({
      data: application({
        consent: {
          given_at: '2026-11-02',
          text_version: 'v1',
          expires_at: '2027-11-02',
          extended_at: '2026-11-15',
        },
      }),
    });
    expect(fixture.componentInstance.application()?.consent.expires_at).toBe('2027-11-02');
  });
});

describe('CvViewerComponent', () => {
  let http: HttpTestingController;
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(async () => {
    environment.apiBaseUrl = API;
    await TestBed.configureTestingModule({
      imports: [CvViewerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('shows an inline retry when the CV blob cannot be fetched', () => {
    const fixture = TestBed.createComponent(CvViewerComponent);
    fixture.componentRef.setInput('applicationId', 'a1');
    fixture.componentRef.setInput('cv', {
      file_name: 'cv.pdf',
      mime_type: 'application/pdf',
      size_bytes: 10,
      download_url: '/hr/recruiting/applications/a1/cv',
    });
    fixture.detectChanges();
    http.expectOne(`${BASE}/cv`).flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'hr.recruiting.candidate.cvLoadFailed',
    );
    el.querySelector<HTMLButtonElement>('[role="alert"] button')?.click();
    http.expectOne(`${BASE}/cv`).flush(new Blob(['x']));
  });
});
