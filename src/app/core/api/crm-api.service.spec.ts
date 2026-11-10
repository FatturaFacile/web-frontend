import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  ConsentResponse,
  CrmApiService,
  CrmDuplicateMatch,
  LeadResource,
  PipelineStageResource,
  StoreConsentPayload,
  StoreLeadPayload,
  StoreOpportunityPayload,
} from '@core';

describe('CrmApiService', () => {
  let service: CrmApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/crm`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CrmApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CrmApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches leads with pagination and filters', () => {
    const mockLeads: LeadResource[] = [
      {
        id: 'lead-1',
        first_name: 'John',
        last_name: 'Doe',
        full_name: 'John Doe',
        company_name: 'Acme Corp',
        title: 'CTO',
        email: 'john@acme.com',
        phone: '+41791234567',
        website: 'https://acme.com',
        country: 'CH',
        status: 'new',
        score: 85,
        rating: 'hot',
        score_breakdown: [],
        score_model: 'standard',
        score_calculated_at: '2026-11-08',
        estimated_budget: '50000',
        lead_source: { id: 'src-1', code: 'web', name: 'Website' },
        converted_at: null,
        converted_account_id: null,
        converted_contact_id: null,
        converted_opportunity_id: null,
        tags: ['enterprise'],
        created_at: '2026-11-08',
        updated_at: '2026-11-08',
      },
    ];

    service.getLeads({ page: 1, per_page: 15, status: 'new' }).subscribe((res) => {
      expect(res.data).toEqual(mockLeads);
      expect(res.meta.total).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/leads` && r.params.get('status') === 'new');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: mockLeads,
      meta: { current_page: 1, total: 1, last_page: 1, per_page: 15 },
    });
  });

  it('creates and scores lead', () => {
    const payload: StoreLeadPayload = {
      first_name: 'Jane',
      last_name: 'Smith',
      company_name: 'Beta Ltd',
      country: 'IT',
    };

    service.createLead(payload).subscribe((res) => {
      expect(res.data.id).toBe('lead-2');
    });

    const reqCreate = httpMock.expectOne(`${baseUrl}/leads`);
    expect(reqCreate.request.method).toBe('POST');
    expect(reqCreate.request.body).toEqual(payload);
    reqCreate.flush({ success: true, data: { id: 'lead-2', ...payload } });

    service.recalculateLeadScores('lead-2').subscribe((res) => {
      expect(res.recalculated).toBe(1);
    });

    const reqScore = httpMock.expectOne(`${baseUrl}/lead-scoring-rules/recalculate`);
    expect(reqScore.request.method).toBe('POST');
    expect(reqScore.request.body).toEqual({ lead_id: 'lead-2' });
    reqScore.flush({ recalculated: 1 });
  });

  it('qualifies and converts lead', () => {
    service.qualifyLead('lead-1').subscribe((res) => {
      expect(res.data.status).toBe('qualified');
    });

    const reqQualify = httpMock.expectOne(`${baseUrl}/leads/lead-1/qualify`);
    expect(reqQualify.request.method).toBe('POST');
    reqQualify.flush({ success: true, data: { id: 'lead-1', status: 'qualified' } });

    service.convertLead('lead-1', { create_opportunity: true }).subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const reqConvert = httpMock.expectOne(`${baseUrl}/leads/lead-1/convert`);
    expect(reqConvert.request.method).toBe('POST');
    reqConvert.flush({ success: true, data: { converted: true } });
  });

  it('manages opportunities and pipeline stages', () => {
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
    ];

    service.getPipelineStages().subscribe((res) => {
      expect(res.data).toEqual(mockStages);
    });

    const reqStages = httpMock.expectOne(`${baseUrl}/pipeline-stages`);
    expect(reqStages.request.method).toBe('GET');
    reqStages.flush({ success: true, data: mockStages });

    const oppPayload: StoreOpportunityPayload = {
      account_id: 'acc-1',
      name: 'ERP Implementation',
      amount: 15000,
      currency: 'CHF',
      stage_code: 'discovery',
    };

    service.createOpportunity(oppPayload).subscribe((res) => {
      expect(res.data.name).toBe('ERP Implementation');
    });

    const reqCreateOpp = httpMock.expectOne(`${baseUrl}/opportunities`);
    expect(reqCreateOpp.request.method).toBe('POST');
    reqCreateOpp.flush({ success: true, data: { id: 'opp-1', ...oppPayload } });

    service.updateOpportunityStage('opp-1', 'proposal').subscribe((res) => {
      expect(res.data.stage?.code).toBe('proposal');
    });

    const reqStageUpdate = httpMock.expectOne(`${baseUrl}/opportunities/opp-1/stage`);
    expect(reqStageUpdate.request.method).toBe('POST');
    expect(reqStageUpdate.request.body).toEqual({ target_stage_code: 'proposal' });
    reqStageUpdate.flush({
      success: true,
      data: { id: 'opp-1', stage: { id: 'st-2', code: 'proposal', name: 'Proposal', is_won: false, is_lost: false } },
    });
  });

  it('checks duplicates and merges contacts', () => {
    const mockDuplicates: CrmDuplicateMatch = {
      entity: 'contacts',
      mode: 'matches',
      data: [{ id: 'c-1', email: 'dup@example.com' }],
    };

    service.getDuplicates({ entity: 'contacts', email: 'dup@example.com' }).subscribe((res) => {
      expect(res.data.mode).toBe('matches');
    });

    const reqDup = httpMock.expectOne((r) => r.url === `${baseUrl}/duplicates` && r.params.get('email') === 'dup@example.com');
    expect(reqDup.request.method).toBe('GET');
    reqDup.flush({ success: true, data: mockDuplicates });

    const mergePayload = {
      survivor_contact_id: 'c-1',
      merged_contact_id: 'c-2',
    };

    service.mergeContacts(mergePayload).subscribe((res) => {
      expect(res.data.id).toBe('merge-1');
    });

    const reqMerge = httpMock.expectOne(`${baseUrl}/contact-merges`);
    expect(reqMerge.request.method).toBe('POST');
    reqMerge.flush({
      success: true,
      data: {
        id: 'merge-1',
        survivor_contact_id: 'c-1',
        merged_contact_id: 'c-2',
        repointed: {},
        retained: {},
        filled_fields: [],
        merged_snapshot: {},
        merged_by_user_id: 'u-1',
        created_at: '2026-11-08',
      },
    });
  });

  it('retrieves and stores GDPR consents', () => {
    const mockConsents: ConsentResponse = {
      effective: [
        {
          channel: 'email',
          purpose: 'marketing',
          status: 'granted',
          captured_at: '2026-11-08',
          source: 'web_form',
        },
      ],
      history: [],
    };

    service.getConsents({ contact_id: 'c-1' }).subscribe((res) => {
      expect(res.data.effective.length).toBe(1);
    });

    const reqGetConsents = httpMock.expectOne((r) => r.url === `${baseUrl}/consents` && r.params.get('contact_id') === 'c-1');
    expect(reqGetConsents.request.method).toBe('GET');
    reqGetConsents.flush({ success: true, data: mockConsents });

    const consentPayload: StoreConsentPayload = {
      contact_id: 'c-1',
      channel: 'email',
      purpose: 'marketing',
      status: 'granted',
      source: 'app_admin',
    };

    service.storeConsent(consentPayload).subscribe((res) => {
      expect(res.data.id).toBe('consent-1');
    });

    const reqStoreConsent = httpMock.expectOne(`${baseUrl}/consents`);
    expect(reqStoreConsent.request.method).toBe('POST');
    reqStoreConsent.flush({
      success: true,
      data: {
        id: 'consent-1',
        ...consentPayload,
        captured_at: '2026-11-08',
        created_at: '2026-11-08',
      },
    });
  });
});
