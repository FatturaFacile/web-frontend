import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TndEligibility, TranslateService } from '@core';
import { GoNoGoMatrixComponent } from './go-no-go-matrix.component';

function eligibility(overrides: Partial<TndEligibility> = {}): TndEligibility {
  return {
    participation_id: 'p-1',
    strategy: 'it_dlgs36_2023',
    can_bid_solo: false,
    recommended_mode: 'RTI_Consorzio_Mandataria_Mandante',
    overall_score: 55,
    decision: 'conditional',
    criteria: [
      { key: 'turnover', category: 'financial', required: '3000000.00', available: '2500000.00', met: false, gap: '500000.00', weight: 20, score: 12, document_id: null },
      { key: 'soa_OG1', category: 'qualification', required: 'III', available: 'III', met: true, gap: null, weight: 30, score: 30, document_id: 'd-1' },
      { key: 'certification_IT_ISO9001', category: 'certification', required: 'IT_ISO9001', available: 'IT_ISO9001', met: true, gap: null, weight: 10, score: 10, document_id: 'd-2' },
    ],
    gaps: {
      turnover_gap: '500000.00',
      similar_projects_gap: 1,
      soa: [
        { category: 'OG1', required_classification: 'III', available_classification: 'III', met: true },
        { category: 'OS30', required_classification: 'II', available_classification: null, met: false },
      ],
      missing_certifications: ['IT_ISO45001'],
      rti_quota_percentage_suggested: '30.00',
    },
    issues: [{ code: 'soa_category_missing', severity: 'blocking', params: { category: 'OS30' } }],
    ...overrides,
  };
}

describe('GoNoGoMatrixComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslateService,
          useValue: {
            translate: (key: string, params?: Record<string, string | number>) =>
              params && Object.keys(params).length > 0 ? `${key} ${JSON.stringify(params)}` : key,
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  function render(value: TndEligibility | null) {
    const fixture = TestBed.createComponent(GoNoGoMatrixComponent);
    fixture.componentRef.setInput('eligibility', value);
    fixture.detectChanges();
    // The table hands its data to the template on the following pass.
    fixture.detectChanges();
    return fixture;
  }

  it('invites to run the evaluation when there is none', () => {
    const text = (render(null).nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('tenderManagement.empty.eligibility');
    expect(text).toContain('tenderManagement.action.evaluate');
  });

  it('renders one row per criterion with the met and unmet tags', () => {
    const root = render(eligibility()).nativeElement as HTMLElement;
    const rows = root.querySelectorAll('tbody tr');
    const text = root.textContent ?? '';

    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(text).toContain('tenderManagement.criterion.turnover');
    expect(text).toContain('tenderManagement.matrix.unmet');
    expect(text).toContain('tenderManagement.matrix.met');
    expect(root.querySelectorAll('tr.unmet').length).toBe(1);
  });

  it('recommends the association with the quota and lists the SOA, turnover and certification gaps', () => {
    const text = (render(eligibility()).nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('tenderManagement.compliance.rti_recommended');
    expect(text).toContain('"quota":"30.00"');
    expect(text).toContain('OS30');
    expect(text).toContain('tenderManagement.compliance.turnover_gap');
    expect(text).toContain('tenderManagement.enum.vaultDocType.IT_ISO45001');
    expect(text).toContain('tenderManagement.enum.decision.conditional');
  });

  it('confirms the solo eligibility and hides the gaps', () => {
    const solo = eligibility({
      can_bid_solo: true,
      recommended_mode: 'SingleCompany',
      decision: 'go',
      overall_score: 100,
      issues: [],
    });
    const text = (render(solo).nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('tenderManagement.compliance.solo_eligible');
    expect(text).not.toContain('tenderManagement.matrix.gapsTitle');
  });

  it('shows the findings of the evaluation with their parameters', () => {
    const text = (render(eligibility()).nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('tenderManagement.compliance.soa_category_missing');
    expect(text).toContain('"category":"OS30"');
  });
});
