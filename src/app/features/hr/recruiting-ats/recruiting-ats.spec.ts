import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrEmployeeApiService, HrExtraApiService, I18nService, PermissionsService } from '@core';
import { buildMovePayload, buildScorecardPayload } from './ats-application-drawer.component';
import { AtsApplicationsComponent, buildApplicationForm } from './ats-applications.component';
import { AtsOpeningsComponent, buildOpeningPayload } from './ats-openings.component';
import { buildSettingsPayload } from './ats-settings.component';
import { RecruitingAtsComponent } from './recruiting-ats.component';

describe('recruiting ATS payload builders', () => {
  it('builds an opening payload with one translation per published language', () => {
    const payload = buildOpeningPayload({
      position_id: 'p1',
      location_site: ' Lugano ',
      employment_type: 'full_time',
      openings_count: 2,
      closes_at: '',
      salary_min: 80000,
      salary_max: null,
      currency: 'CHF',
      languages: ['it-CH', 'en'],
      translations: { 'it-CH': { title: 'Sviluppatore' } },
    });
    expect(payload.location_site).toBe('Lugano');
    expect(payload.closes_at).toBeNull();
    expect(payload.salary_range_public).toEqual({ min: 80000, max: null, currency: 'CHF' });
    expect(Object.keys(payload.translations ?? {})).toEqual(['it-CH', 'en']);
  });

  it('drops the salary range when neither bound is set', () => {
    const payload = buildOpeningPayload({
      position_id: 'p1',
      location_site: 'Lugano',
      employment_type: 'full_time',
      openings_count: 1,
      closes_at: '2027-01-01',
      salary_min: null,
      salary_max: null,
      currency: 'EUR',
      languages: ['it-CH'],
      translations: {},
    });
    expect(payload.salary_range_public).toBeNull();
  });

  it('sends the rejection reason only for a rejection', () => {
    expect(buildMovePayload('rejected', 'withdrawn', ' ok ', false)).toMatchObject({
      stage: 'rejected',
      rejection_reason_code: 'withdrawn',
      rejection_note: 'ok',
      note: null,
      send_email: false,
    });
    expect(buildMovePayload('hr_screening', 'withdrawn', 'x', true)).toMatchObject({
      rejection_reason_code: null,
      rejection_note: null,
      note: 'x',
    });
  });

  it('skips empty criteria in a scorecard', () => {
    const payload = buildScorecardPayload(
      'technical_interview',
      [
        { criterion: ' Angular ', score: 4, comment: '' },
        { criterion: '  ', score: 3 },
      ],
      'hire',
      '',
    );
    expect(payload.criteria_scores).toEqual([{ criterion: 'Angular', score: 4, comment: null }]);
    expect(payload.notes).toBeNull();
  });

  it('uses multipart only when a CV is attached', () => {
    const base = { job_opening_id: 'o1', first_name: 'A', last_name: 'B', email: 'a@b.ch', phone: null };
    expect(buildApplicationForm(base, null)).toBe(base);
    const form = buildApplicationForm(base, new File(['x'], 'cv.pdf')) as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('email')).toBe('a@b.ch');
    expect(form.has('phone')).toBe(false);
    expect((form.get('cv') as File).name).toBe('cv.pdf');
  });

  it('keeps only the editable flags of the pipeline stages', () => {
    const payload = buildSettingsPayload(
      { enabled: true, slug: ' acme ', company_name: '', privacy_policy_url: '' },
      6,
      [{ stage: 'applied', enabled: true, auto_email: false, labels: { en: 'New' } }],
    );
    expect(payload.careers).toMatchObject({ slug: 'acme', company_name: null });
    expect(payload.pipeline?.stages).toEqual([{ stage: 'applied', enabled: true, auto_email: false }]);
    expect(payload.retention).toEqual({ default_months: 6 });
  });
});

describe('recruiting ATS screens', () => {
  const api = {
    listRecruitingJobOpenings: vi.fn(),
    listRecruitingApplications: vi.fn(),
    getRecruitingJobOpeningBoard: vi.fn(),
    getRecruitingSettings: vi.fn(),
    listRecruitingEmailTemplates: vi.fn(),
    publishRecruitingJobOpening: vi.fn(),
    closeRecruitingJobOpening: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    const opening = { id: 'o1', reference: 'JO-1', position_title: 'Dev', status: 'draft', hires_count: 0, openings_count: 1, applications_count: 0, location_site: 'Lugano', closes_at: null };
    api.listRecruitingJobOpenings.mockReturnValue(of({ success: true, message: '', data: [opening] }));
    api.listRecruitingApplications.mockReturnValue(of({ success: true, message: '', data: [], meta: { total: 0 } }));
    api.getRecruitingJobOpeningBoard.mockReturnValue(of({ success: true, message: '', data: { job_opening: opening, stages: [] } }));
    api.getRecruitingSettings.mockReturnValue(
      of({ success: true, message: '', data: { careers: { enabled: false, slug: null, company_name: null, intro: {}, privacy_notice: {}, privacy_policy_url: null, consent_text_version: 'v1' }, retention: { default_months: 12 }, pipeline: { stages: [] } } }),
    );
    api.listRecruitingEmailTemplates.mockReturnValue(of({ success: true, message: '', data: [] }));
    api.publishRecruitingJobOpening.mockReturnValue(of({ data: {} }));
    api.closeRecruitingJobOpening.mockReturnValue(of({ data: {} }));
    TestBed.configureTestingModule({
      providers: [
        { provide: HrExtraApiService, useValue: api },
        { provide: HrEmployeeApiService, useValue: { getPositions: vi.fn().mockReturnValue(of({ data: [] })) } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
  });

  it('lists the openings and publishes a draft', () => {
    const fixture = TestBed.createComponent(AtsOpeningsComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    expect(api.listRecruitingJobOpenings).toHaveBeenCalled();
    (fixture.componentInstance as unknown as { publish(row: unknown, internal: boolean): void }).publish({ id: 'o1' }, true);
    expect(api.publishRecruitingJobOpening).toHaveBeenCalledWith('o1', { internal_only: true });
  });

  it('closes an opening with an outcome', () => {
    const fixture = TestBed.createComponent(AtsOpeningsComponent);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { close(row: unknown, outcome: string): void }).close({ id: 'o1' }, 'filled');
    expect(api.closeRecruitingJobOpening).toHaveBeenCalledWith('o1', { outcome: 'filled' });
  });

  it('filters the applications by stage', () => {
    const fixture = TestBed.createComponent(AtsApplicationsComponent);
    fixture.detectChanges();
    fixture.componentInstance.load();
    expect(api.listRecruitingApplications).toHaveBeenCalledWith(expect.objectContaining({ per_page: 20 }));
  });

  it('renders the page with its four tabs without errors', () => {
    const fixture = TestBed.createComponent(RecruitingAtsComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.ant-tabs-tab').length).toBe(4);
  });
});
