import { signal } from '@angular/core';
import {
  ApplicationStage,
  BoardStageColumn,
  CandidateApplication,
  CandidateApplicationCard,
  JobOfferLetter,
  JobOpening,
} from '@core';

/** Shared test fixtures for recruiting specs (not used by application code). */

/** I18nService test double: returns keys (with params appended) so assertions stay language-independent. */
export function i18nStub() {
  return {
    currentLanguage: signal<'en' | 'it' | 'de' | 'fr'>('en'),
    translate: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    instant: (key: string) => key,
    setLanguage: (_lang: string) => Promise.resolve({}),
  };
}

export function opening(overrides: Partial<JobOpening> = {}): JobOpening {
  return {
    id: 'o1',
    reference: 'JOB-2026-001',
    position_id: 'p1',
    position_title: 'Accountant',
    department_id: 'd1',
    department_name: 'Finance',
    location_site: 'Lugano',
    employment_type: 'full_time',
    openings_count: 1,
    hires_count: 0,
    salary_range_public: null,
    status: 'published',
    published_languages: ['it-CH'],
    translations: {
      'it-CH': { title: 'Contabile', description: 'D', requirements: '', benefits: '' },
    },
    published_at: '2026-11-01T08:00:00Z',
    closes_at: null,
    closed_at: null,
    applications_count: 2,
    created_at: '2026-11-01T08:00:00Z',
    updated_at: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

export function card(
  id: string,
  stage: ApplicationStage,
  overrides: Partial<CandidateApplicationCard> = {},
): CandidateApplicationCard {
  return {
    id,
    job_opening_id: 'o1',
    job_opening_title: 'Accountant',
    first_name: 'Anna',
    last_name: id,
    full_name: `Anna ${id}`,
    email: `${id}@example.com`,
    phone: null,
    stage,
    stage_entered_at: '2026-11-02T08:00:00Z',
    board_position: 0,
    source: 'careers_page',
    cv_parse_status: 'parsed',
    skills: ['Excel'],
    average_score: null,
    scorecards_count: 0,
    privacy_consent_expires_at: null,
    is_anonymized: false,
    created_at: '2026-11-02T08:00:00Z',
    ...overrides,
  };
}

export function boardStages(
  cards: CandidateApplicationCard[],
  disabled: ApplicationStage[] = [],
): BoardStageColumn[] {
  const stages: ApplicationStage[] = [
    'applied',
    'hr_screening',
    'technical_interview',
    'manager_interview',
    'offer_extended',
    'hired',
    'rejected',
  ];
  return stages.map((stage) => {
    const applications = cards.filter((c) => c.stage === stage);
    return {
      stage,
      label: stage,
      enabled: !disabled.includes(stage),
      count: applications.length,
      applications,
    };
  });
}

export function offer(overrides: Partial<JobOfferLetter> = {}): JobOfferLetter {
  return {
    id: 'of1',
    application_id: 'a1',
    proposed_salary: 90000,
    currency: 'CHF',
    start_date: '2027-01-01',
    employment_type: 'full_time',
    contract_type: 'permanent',
    weekly_hours: 42,
    probation_months: 3,
    valid_until: null,
    status: 'signed',
    signature_status: 'signed',
    signature_provider: 'manual',
    signature_external_id: null,
    rendered_body: '<p>Offer</p>',
    sent_at: '2026-11-10T08:00:00Z',
    signed_at: '2026-11-11T08:00:00Z',
    declined_at: null,
    created_at: '2026-11-10T08:00:00Z',
    ...overrides,
  };
}

export function application(overrides: Partial<CandidateApplication> = {}): CandidateApplication {
  return {
    ...card('a1', 'offer_extended'),
    cover_letter: null,
    notes: null,
    locale: 'it-CH',
    cv: null,
    extracted_profile: null,
    consent: {
      given_at: '2026-11-02T08:00:00Z',
      text_version: 'v1',
      expires_at: '2027-05-02',
      extended_at: null,
    },
    rejection: null,
    history: [],
    emails: [],
    offer: offer(),
    hired_employee_id: null,
    ...overrides,
  };
}
