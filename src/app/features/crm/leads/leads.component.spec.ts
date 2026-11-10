import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { AuthStore, CrmApiService, I18nService, LeadResource, TranslateService } from '@core';
import { LeadsComponent } from './leads.component';

describe('LeadsComponent', () => {
  let fixture: ComponentFixture<LeadsComponent>;
  let component: LeadsComponent;

  const mockLeads: LeadResource[] = [
    {
      id: 'lead-1',
      first_name: 'Alice',
      last_name: 'Smith',
      full_name: 'Alice Smith',
      company_name: 'Alpha SA',
      title: 'Sales Director',
      email: 'alice@alpha.ch',
      phone: '+41919998877',
      website: 'https://alpha.ch',
      country: 'CH',
      status: 'new',
      score: 75,
      rating: 'warm',
      score_breakdown: [],
      score_model: 'v1',
      score_calculated_at: '2026-11-08',
      estimated_budget: '25000',
      lead_source: null,
      converted_at: null,
      converted_account_id: null,
      converted_contact_id: null,
      converted_opportunity_id: null,
      tags: [],
      created_at: '2026-11-08',
      updated_at: '2026-11-08',
    },
  ];

  const mockCrmApi = {
    getLeadScore: vi.fn().mockReturnValue(
      of({
        lead_id: 'l1',
        score: 40,
        rating: 'warm',
        model: null,
        breakdown: [{ rule: 'budget', points: 40, reason: 'Budget above threshold' }],
        calculated_at: null,
        current: {
          score: 70,
          rating: 'hot',
          model: 'tenant_rules',
          breakdown: [{ rule: 'budget', points: 70, reason: 'Budget above threshold' }],
        },
      }),
    ),
    getLeads: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockLeads,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 15 },
      }),
    ),
    createLead: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockLeads[0],
      }),
    ),
    recalculateLeadScores: vi.fn().mockReturnValue(of({ recalculated: 1 })),
    qualifyLead: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockLeads[0], status: 'qualified' },
      }),
    ),
    disqualifyLead: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockLeads[0], status: 'disqualified' },
      }),
    ),
    convertLead: vi.fn().mockReturnValue(
      of({
        success: true,
        data: null,
      }),
    ),
    deleteLead: vi.fn().mockReturnValue(
      of({
        success: true,
        data: null,
      }),
    ),
  };

  const mockTranslate = {
    instant: vi.fn((k: string) => k),
    translate: vi.fn((k: string) => k),
    currentLanguage: signal('it'),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  const mockModal = {
    confirm: vi.fn(),
  };

  const mockAuthStore = {
    activeJurisdiction: vi.fn().mockReturnValue('CH'),
    activeCurrency: vi.fn().mockReturnValue('CHF'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: CrmApiService, useValue: mockCrmApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
        { provide: NzModalService, useValue: mockModal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadsComponent);
    component = fixture.componentInstance;
  });

  it('loads leads on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockCrmApi.getLeads).toHaveBeenCalled();
    expect(component.leads()).toEqual(mockLeads);
    expect(component.total()).toBe(1);
  });

  it('filters leads by search term', () => {
    fixture.detectChanges();
    const event = { target: { value: 'Alpha' } } as unknown as Event;
    component.onSearch(event);

    expect(component.searchTerm()).toBe('Alpha');
    expect(mockCrmApi.getLeads).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Alpha', page: 1 }),
    );
  });

  it('submits create lead form', () => {
    fixture.detectChanges();
    component.openCreateDrawer();
    component.leadForm.patchValue({
      company_name: 'Gamma Gmbh',
      country: 'CH',
      estimated_budget: 12000,
    });

    component.submitCreateLead();

    expect(mockCrmApi.createLead).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'Gamma Gmbh',
        country: 'CH',
        estimated_budget: 12000,
      }),
    );
    expect(mockMessage.success).toHaveBeenCalledWith('Lead created successfully');
    expect(component.createDrawerVisible()).toBe(false);
  });

  it('recalculates lead score', () => {
    fixture.detectChanges();
    component.recalculateScore(mockLeads[0]);

    expect(mockCrmApi.recalculateLeadScores).toHaveBeenCalledWith('lead-1');
    expect(mockMessage.success).toHaveBeenCalledWith('Score recalculated');
  });

  it('explains the score of a lead: stored and under the current model', () => {
    fixture.detectChanges();
    component.openScoreModal(mockLeads[0]);

    expect(mockCrmApi.getLeadScore).toHaveBeenCalledWith('lead-1');
    expect(component.scoreModalVisible()).toBe(true);
    const explanation = component.scoreExplanation();
    expect(explanation?.current.score).toBe(70);
    expect(component.storedBreakdown(explanation as NonNullable<typeof explanation>)).toHaveLength(1);
    // The modal service of this spec is a stub: close it before the next change detection.
    component.scoreModalVisible.set(false);
  });

  it('qualifies a lead', () => {
    fixture.detectChanges();
    component.qualify(mockLeads[0]);

    expect(mockCrmApi.qualifyLead).toHaveBeenCalledWith('lead-1');
    expect(mockMessage.success).toHaveBeenCalledWith('Lead marked as Qualified');
  });

  it('disqualifies a lead', () => {
    fixture.detectChanges();
    component.disqualify(mockLeads[0]);

    expect(mockCrmApi.disqualifyLead).toHaveBeenCalledWith('lead-1');
    expect(mockMessage.success).toHaveBeenCalledWith('Lead marked as Disqualified');
  });
});
