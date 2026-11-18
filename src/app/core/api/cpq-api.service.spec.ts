import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CpqSignRequest } from '../models';
import { CpqApiService } from './cpq-api.service';

describe('CpqApiService', () => {
  let service: CpqApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CpqApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the margin and posts the simulation of a quote', () => {
    service.getMargin('q1').subscribe();
    http.expectOne((req) => req.method === 'GET' && req.url.endsWith('/sales/quotes/q1/margin')).flush({ data: {} });

    service.simulate('q1', { mode: 'target_margin_percent', value: 25 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/sales/quotes/q1/simulate'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mode: 'target_margin_percent', value: 25 });
    req.flush({ data: {} });
  });

  it('lists the revisions and diffs two of them', () => {
    service.getRevisions('q2').subscribe();
    http.expectOne((r) => r.url.endsWith('/sales/quotes/q2/revisions')).flush({ data: [] });

    service.diff('q1', 'q2').subscribe();
    http.expectOne((r) => r.url.endsWith('/sales/quotes/q1/diff/q2')).flush({ data: {} });
  });

  it('drives the tiered approval', () => {
    service.getApprovals('q1').subscribe();
    http.expectOne((r) => r.url.endsWith('/quotes/q1/approvals')).flush({ data: {} });

    service.submitForApproval('q1').subscribe();
    http.expectOne((r) => r.url.endsWith('/quotes/q1/approvals/submit') && r.method === 'POST').flush({ data: [] });

    service.approve('q1').subscribe();
    http.expectOne((r) => r.url.endsWith('/quotes/q1/approvals/approve')).flush({ data: {} });

    service.reject('q1', 'Too thin').subscribe();
    const reject = http.expectOne((r) => r.url.endsWith('/quotes/q1/approvals/reject'));
    expect(reject.request.body).toEqual({ rejection_reason: 'Too thin' });
    reject.flush({ data: {} });
  });

  it('creates, updates and deletes approval tiers', () => {
    const tier = { level: 1, name: 'Manager', approver_role: 'sales_manager' };
    service.saveTier(tier).subscribe();
    const created = http.expectOne((r) => r.url.endsWith('/quote-approval-tiers') && r.method === 'POST');
    expect(created.request.body).toEqual(tier);
    created.flush({ data: {} });

    service.saveTier(tier, 't1').subscribe();
    http.expectOne((r) => r.url.endsWith('/quote-approval-tiers/t1') && r.method === 'PUT').flush({ data: {} });

    service.deleteTier('t1').subscribe();
    http.expectOne((r) => r.url.endsWith('/quote-approval-tiers/t1') && r.method === 'DELETE').flush(null);
  });

  it('creates, lists, revokes and verifies signature links', () => {
    service.createSignatureLink('q1', 'de', 48).subscribe();
    const create = http.expectOne((r) => r.url.endsWith('/quotes/q1/signature-links'));
    expect(create.request.body).toEqual({ locale: 'de', validity_hours: 48 });
    create.flush({ data: {} });

    service.getSignatureRequests('q1').subscribe();
    http.expectOne((r) => r.url.endsWith('/quotes/q1/signature-requests') && r.method === 'GET').flush({ data: [] });

    service.revokeSignatureLink('q1', 'r1').subscribe();
    http.expectOne((r) => r.url.endsWith('/signature-requests/r1/revoke')).flush({ data: {} });

    service.verifySignature('q1', 'r1').subscribe();
    http.expectOne((r) => r.url.endsWith('/signature-requests/r1/verify')).flush({ data: {} });
  });

  it('asks the PDF preview in a language with or without the technical details', () => {
    service.previewPdf('q1', 'fr', false).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/quotes/q1/preview-pdf'));
    expect(req.request.params.get('locale')).toBe('fr');
    expect(req.request.params.get('show_technical_details')).toBe('0');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
  });

  it('uses the public endpoints for the signing page', () => {
    service.getPublicSigning('tok').subscribe();
    http.expectOne((r) => r.url.endsWith('/public/quote-signatures/tok') && r.method === 'GET').flush({ data: {} });

    service.getPublicPdf('tok', 'it').subscribe();
    const pdf = http.expectOne((r) => r.url.endsWith('/public/quote-signatures/tok/pdf'));
    expect(pdf.request.params.get('locale')).toBe('it');
    pdf.flush(new Blob(['%PDF']));

    const payload: CpqSignRequest = { signer_name: 'Anna', signer_role: 'CEO', signature_type: 'typed', signature_data: 'Anna', accept_terms: true };
    service.signPublic('tok', payload).subscribe();
    const sign = http.expectOne((r) => r.url.endsWith('/public/quote-signatures/tok/sign'));
    expect(sign.request.body).toEqual(payload);
    sign.flush({ data: {} });

    service.requestPublicChanges('tok', 'Add delivery').subscribe();
    const changes = http.expectOne((r) => r.url.endsWith('/public/quote-signatures/tok/request-changes'));
    expect(changes.request.body).toEqual({ message: 'Add delivery' });
    changes.flush({ data: {} });
  });
});
