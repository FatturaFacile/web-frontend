import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ContractAuthoringApiService } from './contract-authoring-api.service';

describe('ContractAuthoringApiService', () => {
  let service: ContractAuthoringApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/contract-authoring`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContractAuthoringApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContractAuthoringApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('manages the clause library', () => {
    service.getClauses({ status: 'approved' }).subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/clauses`);
    expect(list.request.method).toBe('GET');
    expect(list.request.params.get('status')).toBe('approved');
    list.flush({ data: [] });

    service.createClause({ code: 'GDPR', title: 'Privacy' }).subscribe();
    httpTesting.expectOne(`${base}/clauses`).flush({ data: { id: 'c1' } });

    service.setClauseStatus('c1', 'approved').subscribe();
    const status = httpTesting.expectOne(`${base}/clauses/c1/status`);
    expect(status.request.body).toEqual({ status: 'approved' });
    status.flush({ data: { id: 'c1' } });

    service.addClauseFallback('c1', { title: 'B', body: 'text' }).subscribe();
    httpTesting.expectOne(`${base}/clauses/c1/fallbacks`).flush({ data: { id: 'c1' } });

    service.deleteClauseFallback('c1', 'f1').subscribe();
    const del = httpTesting.expectOne(`${base}/clauses/c1/fallbacks/f1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('manages templates and previews them', () => {
    service
      .createTemplate({ name: 'NDA', contract_kind: 'customer', clauses: [{ clause_id: 'c1' }] })
      .subscribe();
    httpTesting.expectOne(`${base}/templates`).flush({ data: { id: 't1' } });

    service.previewTemplate('t1', { variables: { client: 'ACME' } }).subscribe((res) => {
      expect(res.data.body).toBe('Hello ACME');
    });
    const preview = httpTesting.expectOne(`${base}/templates/t1/preview`);
    expect(preview.request.method).toBe('POST');
    preview.flush({ data: { body: 'Hello ACME' } });

    service.deleteTemplate('t1').subscribe();
    httpTesting.expectOne(`${base}/templates/t1`).flush(null);
  });

  it('creates document versions and runs negotiation rounds', () => {
    service.createDocumentVersion('supplier', 'k1', { body: 'v2', source: 'edit' }).subscribe();
    httpTesting.expectOne(`${base}/contracts/supplier/k1/versions`).flush({ data: { id: 'v2' } });

    service.createDocumentVersionFromTemplate('supplier', 'k1', { template_id: 't1' }).subscribe();
    httpTesting.expectOne(`${base}/contracts/supplier/k1/versions/from-template`).flush({ data: { id: 'v3' } });

    service.getDocumentVersion('v3').subscribe();
    httpTesting.expectOne(`${base}/document-versions/v3`).flush({ data: { id: 'v3' } });

    service.openRound('supplier', 'k1', 'first').subscribe();
    httpTesting.expectOne(`${base}/contracts/supplier/k1/rounds`).flush({ data: { id: 'r1' } });

    service.closeRound('r1', 'agreed').subscribe();
    const close = httpTesting.expectOne(`${base}/negotiation-rounds/r1/close`);
    expect(close.request.body).toEqual({ outcome: 'agreed', summary: null });
    close.flush({ data: { id: 'r1' } });
  });

  it('drives the e-signature lifecycle', () => {
    service
      .createSignatureRequest('customer', 'k1', {
        document_version_id: 'v1',
        signers: [{ name: 'Mario', email: 'mario@example.com' }],
      })
      .subscribe();
    httpTesting.expectOne(`${base}/contracts/customer/k1/signature-requests`).flush({ data: { id: 's1' } });

    service.sendSignatureRequest('s1').subscribe();
    httpTesting.expectOne(`${base}/signature-requests/s1/send`).flush({ data: { id: 's1' } });

    service.signSignatureRequest('s1', 'tok').subscribe();
    const sign = httpTesting.expectOne(`${base}/signature-requests/s1/sign`);
    expect(sign.request.body).toEqual({ token: 'tok' });
    sign.flush({ data: { id: 's1' } });

    service.declineSignatureRequest('s1', 'tok', 'no').subscribe();
    httpTesting.expectOne(`${base}/signature-requests/s1/decline`).flush({ data: { id: 's1' } });

    service.cancelSignatureRequest('s1').subscribe();
    httpTesting.expectOne(`${base}/signature-requests/s1/cancel`).flush({ data: { id: 's1' } });

    service.getSignatureProviders().subscribe();
    httpTesting.expectOne(`${base}/signature-providers`).flush({ data: [] });
  });
});
