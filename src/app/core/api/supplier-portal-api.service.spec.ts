import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SupplierPortalApiService } from './supplier-portal-api.service';

describe('SupplierPortalApiService', () => {
  let service: SupplierPortalApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/supplier-portal`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SupplierPortalApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists onboardings with the filters it was given and no empty ones', () => {
    service.getOnboardings({ status: 'under_review', country: 'CH', search: '' }).subscribe();

    const req = httpMock.expectOne((request) => request.url === `${base}/onboardings`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('under_review');
    expect(req.request.params.get('country')).toBe('CH');
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ data: [] });
  });

  it('invites a supplier and runs the review steps on the onboarding', () => {
    service.inviteSupplier({ supplier_id: 'sup-1', country: 'IT', invitation_email: 'a@b.it' }).subscribe();
    const invite = httpMock.expectOne(`${base}/onboardings`);
    expect(invite.request.method).toBe('POST');
    expect(invite.request.body).toEqual({ supplier_id: 'sup-1', country: 'IT', invitation_email: 'a@b.it' });
    invite.flush({ data: {} });

    service.approveOnboarding('onb-1', { notes: 'ok' }).subscribe();
    httpMock.expectOne(`${base}/onboardings/onb-1/approve`).flush({ data: {} });

    service.rejectOnboarding('onb-1', { reason: 'no answer' }).subscribe();
    expect(httpMock.expectOne(`${base}/onboardings/onb-1/reject`).request.body).toEqual({ reason: 'no answer' });
  });

  it('asks only for active requirements when told so', () => {
    service.getDocumentRequirements({ country: 'IT', active: true }).subscribe();

    const req = httpMock.expectOne((request) => request.url === `${base}/document-requirements`);
    expect(req.request.params.get('active')).toBe('1');
    expect(req.request.params.get('country')).toBe('IT');
    req.flush({ data: [] });
  });

  it('accepts and rejects documents and filters the expiring ones', () => {
    service.getDocuments({ expiring_within_days: 30 }).subscribe();
    const list = httpMock.expectOne((request) => request.url === `${base}/documents`);
    expect(list.request.params.get('expiring_within_days')).toBe('30');
    list.flush({ data: [] });

    service.acceptDocument('doc-1', { expires_at: '2027-12-01' }).subscribe();
    expect(httpMock.expectOne(`${base}/documents/doc-1/accept`).request.body).toEqual({ expires_at: '2027-12-01' });

    service.rejectDocument('doc-1', { reason: 'Illegible' }).subscribe();
    expect(httpMock.expectOne(`${base}/documents/doc-1/reject`).request.body).toEqual({ reason: 'Illegible' });
  });

  it('scores a qualification through the assessment endpoints', () => {
    service.createAssessment({ supplier_id: 'sup-1', scores: [{ criterion_id: 'c-1', score: 4 }] }).subscribe();
    httpMock.expectOne(`${base}/qualification-assessments`).flush({ data: {} });

    service.recordScores('as-1', { scores: [{ criterion_id: 'c-2', score: '3.5' }] }).subscribe();
    const put = httpMock.expectOne(`${base}/qualification-assessments/as-1/scores`);
    expect(put.request.method).toBe('PUT');
    put.flush({ data: {} });

    service.completeAssessment('as-1').subscribe();
    httpMock.expectOne(`${base}/qualification-assessments/as-1/complete`).flush({ data: {} });
  });

  it('walks a bank change through callback, approval and rejection', () => {
    service.verifyBankChangeCallback('bc-1', { note: 'called' }).subscribe();
    expect(httpMock.expectOne(`${base}/bank-changes/bc-1/verify-callback`).request.body).toEqual({ note: 'called' });

    service.approveBankChange('bc-1', { comment: 'ok' }).subscribe();
    httpMock.expectOne(`${base}/bank-changes/bc-1/approve`).flush({ data: {} });

    service.rejectBankChange('bc-1', { reason: 'not confirmed' }).subscribe();
    httpMock.expectOne(`${base}/bank-changes/bc-1/reject`).flush({ data: {} });

    service.cancelBankChange('bc-1').subscribe();
    httpMock.expectOne(`${base}/bank-changes/bc-1/cancel`).flush({ data: {} });
  });

  it('reads the risk, the checks and the comparison of the answers to a request', () => {
    service.getRiskProfiles({ min_level: 'high' }).subscribe();
    const risk = httpMock.expectOne((request) => request.url === `${base}/risk`);
    expect(risk.request.params.get('min_level')).toBe('high');
    risk.flush({ data: [] });

    service.recordCheck({ supplier_id: 'sup-1', check_type: 'vat_status', result: 'failed' }).subscribe();
    httpMock.expectOne(`${base}/checks`).flush({ data: {} });

    service.getRfqComparison('rfq-1').subscribe();
    httpMock.expectOne(`${base}/rfq-responses/rfq-1/comparison`).flush({ data: {} });
  });
});
