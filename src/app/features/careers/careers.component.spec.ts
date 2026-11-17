import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, PublicCareersApiService } from '@core';
import { httpError, i18nStub } from '../warranty-rma/testing/rma-fixtures';
import { CareersComponent } from './careers.component';

describe('CareersComponent (public)', () => {
  let api: {
    getCareersPage: ReturnType<typeof vi.fn>;
    getJobs: ReturnType<typeof vi.fn>;
    getJob: ReturnType<typeof vi.fn>;
    apply: ReturnType<typeof vi.fn>;
  };

  async function setup(query: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [CareersComponent],
      providers: [
        { provide: PublicCareersApiService, useValue: api },
        { provide: I18nService, useValue: i18nStub() },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ slug: 'acme' }), queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CareersComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = {
      getCareersPage: vi.fn().mockReturnValue(
        of({ data: { company_name: 'ACME SA', intro: 'Join us', consent_text_version: 'v2', available_locales: ['en'] } }),
      ),
      getJobs: vi.fn().mockReturnValue(
        of({ data: [{ id: 'j1', title: 'Backend developer', location_site: 'Lugano', employment_type: 'full_time' }] }),
      ),
      getJob: vi.fn().mockReturnValue(of({ data: { id: 'j1', title: 'Backend developer', description: 'Build APIs' } })),
      apply: vi.fn().mockReturnValue(of({ data: { reference: 'APP-1', message: 'Application received' } })),
    };
  });

  it('lists the published openings of the company', async () => {
    const fixture = await setup();
    expect(api.getCareersPage).toHaveBeenCalledWith('acme');
    expect(api.getJobs).toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Backend developer');
    expect(text).toContain('Lugano');
    expect(fixture.componentInstance.companyName()).toBe('ACME SA');
  });

  it('opens the opening from the job query parameter', async () => {
    const fixture = await setup({ job: 'j1' });
    expect(api.getJob).toHaveBeenCalledWith('acme', 'j1', 'en');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Build APIs');
  });

  it('submits the application only with the consent and a CV', async () => {
    const fixture = await setup({ job: 'j1' });
    const cmp = fixture.componentInstance;
    cmp.form.first_name = 'Ada';
    cmp.form.last_name = 'Lovelace';
    cmp.form.email = 'ada@example.com';
    cmp.touch();
    expect(cmp.canSubmit()).toBe(false);

    const cv = new File(['cv'], 'cv.pdf', { type: 'application/pdf' });
    cmp.onFile({ target: { files: { item: () => cv } } } as unknown as Event);
    cmp.form.consent = true;
    cmp.touch();
    expect(cmp.canSubmit()).toBe(true);

    cmp.apply();
    expect(api.apply).toHaveBeenCalledWith(
      'acme',
      'j1',
      expect.objectContaining({ first_name: 'Ada', consent_accepted: true, consent_text_version: 'v2', cv }),
    );
    expect(cmp.applied()).toBe('Application received');
  });

  it('shows the not-found state for an unknown slug', async () => {
    api.getCareersPage.mockReturnValue(httpError(404));
    const fixture = await setup();
    expect(fixture.componentInstance.state()).toBe('notFound');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('CAREERS.NOT_FOUND');
  });
});
