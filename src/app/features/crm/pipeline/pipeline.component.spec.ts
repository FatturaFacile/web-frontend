import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import {
  AuthStore,
  CrmApiService,
  I18nService,
  OpportunityResource,
  PipelineStageResource,
  TranslateService,
} from '@core';
import { PipelineComponent } from './pipeline.component';

describe('PipelineComponent', () => {
  let fixture: ComponentFixture<PipelineComponent>;
  let component: PipelineComponent;

  const mockStages: PipelineStageResource[] = [
    {
      id: 'st-1',
      code: 'discovery',
      name: 'Discovery',
      position: 1,
      probability: 20,
      forecast_category: 'pipeline',
      is_won: false,
      is_lost: false,
      is_active: true,
    },
    {
      id: 'st-2',
      code: 'proposal',
      name: 'Proposal',
      position: 2,
      probability: 60,
      forecast_category: 'best_case',
      is_won: false,
      is_lost: false,
      is_active: true,
    },
  ];

  const mockOpportunities: OpportunityResource[] = [
    {
      id: 'opp-1',
      opportunity_number: 'OPP-2026-001',
      name: 'ERP SaaS Subscription',
      amount: 10000,
      expected_revenue: 2000,
      currency: 'CHF',
      probability: 20,
      forecast_category: 'pipeline',
      expected_close_date: '2026-12-31',
      actual_close_date: null,
      status: 'open',
      win_loss_reason: null,
      competitor: null,
      discount_percentage: 0,
      approval_status: 'none',
      workflow_instance_id: null,
      account: { id: 'acc-1', name: 'Alpha SA', tier: 'tier_1' },
      stage: mockStages[0],
      sales_quote_id: null,
      project_id: null,
      created_at: '2026-11-08',
      updated_at: '2026-11-08',
    },
  ];

  const mockCrmApi = {
    getPipelineStages: vi.fn().mockReturnValue(of({ success: true, data: mockStages })),
    getOpportunities: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockOpportunities,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 15 },
      }),
    ),
    createOpportunity: vi.fn().mockReturnValue(of({ success: true, data: mockOpportunities[0] })),
    updateOpportunityStage: vi.fn().mockReturnValue(of({ success: true, data: mockOpportunities[0] })),
    deleteOpportunity: vi.fn().mockReturnValue(of({ success: true, data: null })),
    createQuoteFromOpportunity: vi.fn().mockReturnValue(of({ success: true, data: { id: 'q-1' } })),
    createProjectFromOpportunity: vi.fn().mockReturnValue(of({ success: true, data: { id: 'p-1' } })),
    getDuplicates: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { entity: 'contacts', mode: 'matches', data: [] },
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

  const mockAuthStore = {
    activeJurisdiction: vi.fn().mockReturnValue('CH'),
    activeCurrency: vi.fn().mockReturnValue('CHF'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PipelineComponent],
      providers: [
        provideNzIcons(icons),
        { provide: CrmApiService, useValue: mockCrmApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PipelineComponent);
    component = fixture.componentInstance;
  });

  it('loads pipeline stages and opportunities on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockCrmApi.getPipelineStages).toHaveBeenCalled();
    expect(mockCrmApi.getOpportunities).toHaveBeenCalled();
    expect(component.stages()).toEqual(mockStages);
    expect(component.opportunities()).toEqual(mockOpportunities);
  });

  it('submits create opportunity form', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.oppForm.patchValue({
      name: 'Custom Development',
      account_id: 'acc-2',
      amount: 15000,
      stage_code: 'discovery',
      forecast_category: 'pipeline',
    });

    component.submitCreateOpportunity();

    expect(mockCrmApi.createOpportunity).toHaveBeenCalledWith({
      name: 'Custom Development',
      account_id: 'acc-2',
      amount: 15000,
      currency: 'CHF',
      stage_code: 'discovery',
      forecast_category: 'pipeline',
    });
    expect(mockMessage.success).toHaveBeenCalledWith('CRMX.MSG_OPPORTUNITY_CREATED');
    expect(component.createModalVisible()).toBe(false);
  });

  it('does not create an opportunity from an empty form', () => {
    fixture.detectChanges();
    component.openCreateModal();

    component.submitCreateOpportunity();

    expect(mockCrmApi.createOpportunity).not.toHaveBeenCalled();
    expect(component.errorTip(component.oppForm.controls.name)).not.toBe('');
  });

  it('changes opportunity stage', () => {
    fixture.detectChanges();
    component.changeStage(mockOpportunities[0], 'proposal');

    expect(mockCrmApi.updateOpportunityStage).toHaveBeenCalledWith('opp-1', 'proposal');
    expect(mockMessage.success).toHaveBeenCalledWith('CRMX.MSG_STAGE_UPDATED');
  });

  it('creates a quote and a project from an opportunity', () => {
    fixture.detectChanges();
    const opp = mockOpportunities[0];
    component.createQuote(opp);
    component.createProject(opp);
    expect(mockCrmApi.createQuoteFromOpportunity).toHaveBeenCalledWith(opp.id);
    expect(mockCrmApi.createProjectFromOpportunity).toHaveBeenCalledWith(opp.id);
  });

  it('checks for duplicates', () => {
    fixture.detectChanges();
    component.checkDuplicates();

    expect(mockCrmApi.getDuplicates).toHaveBeenCalledWith({ entity: 'contacts' });
    expect(component.duplicateModalVisible()).toBe(true);
  });
});
