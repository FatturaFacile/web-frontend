import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CrmAutomationSequenceRequest, CrmQuoteConfigurationRequest } from '../models';
import { CrmExtensionApiService } from './crm-extension-api.service';

describe('CrmExtensionApiService', () => {
  let service: CrmExtensionApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CrmExtensionApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CrmExtensionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('runs the territory rules with an empty POST', () => {
    service.assignTerritories().subscribe((response) => expect(response.data.assigned).toBe(3));

    const request = httpMock.expectOne((req) => req.url.endsWith('/crm/territories/assign'));
    expect(request.request.method).toBe('POST');
    request.flush({ data: { assigned: 3, unmatched: 1, kept_manual: 0 } });
  });

  it('filters sales quotas by user and skips empty filters', () => {
    service.getSalesQuotas('user-1').subscribe();
    const request = httpMock.expectOne((req) => req.url.endsWith('/crm/sales-quotas'));
    expect(request.request.params.get('user_id')).toBe('user-1');
    request.flush({ data: [] });

    service.getPartners().subscribe();
    const partners = httpMock.expectOne((req) => req.url.endsWith('/crm/partners'));
    expect(partners.request.params.keys()).toEqual([]);
    partners.flush({ data: [] });
  });

  it('sends the rejection reason of a deal registration and of an MDF claim', () => {
    service.rejectDealRegistration('deal-1', 'Customer already covered').subscribe();
    const deal = httpMock.expectOne((req) => req.url.endsWith('/crm/deal-registrations/deal-1/reject'));
    expect(deal.request.body).toEqual({ reason: 'Customer already covered' });
    deal.flush({ data: {} });

    service.rejectMdfClaim('claim-1', 'Fund exhausted').subscribe();
    const claim = httpMock.expectOne((req) => req.url.endsWith('/crm/mdf-claims/claim-1/reject'));
    expect(claim.request.body).toEqual({ reason: 'Fund exhausted' });
    claim.flush({ data: {} });
  });

  it('posts the quote payload the FormRequest accepts and previews it without saving', () => {
    const payload: CrmQuoteConfigurationRequest = { name: 'Big order', quantity: 60, unit_price: 100, extra_discount_percent: 5 };

    service.previewQuoteConfiguration(payload).subscribe((response) => expect(response.data.discount_percent).toBe('20.00'));
    const preview = httpMock.expectOne((req) => req.url.endsWith('/crm/quote-configurations/preview'));
    expect(preview.request.body).toEqual(payload);
    preview.flush({ data: { discount_percent: '20.00' } });

    service.createQuoteConfiguration(payload).subscribe();
    const create = httpMock.expectOne((req) => req.url.endsWith('/crm/quote-configurations') && req.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });
  });

  it('creates an automation sequence with its steps and enrols a lead', () => {
    const payload: CrmAutomationSequenceRequest = {
      name: 'Welcome',
      entity: 'leads',
      trigger_type: 'manual',
      exit_conditions: ['lead_converted'],
      steps: [{ step_type: 'email', delay_days: 0, subject: 'Hi', body: 'Welcome' }],
    };

    service.createAutomationSequence(payload).subscribe();
    const create = httpMock.expectOne((req) => req.url.endsWith('/crm/automation-sequences') && req.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.enrollInAutomation('seq-1', { lead_id: 'lead-1' }).subscribe();
    const enroll = httpMock.expectOne((req) => req.url.endsWith('/crm/automation-sequences/seq-1/enroll'));
    expect(enroll.request.body).toEqual({ lead_id: 'lead-1' });
    enroll.flush({ data: {} });
  });
});
