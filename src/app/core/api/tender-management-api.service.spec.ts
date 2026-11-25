import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { TenderManagementApiService } from './tender-management-api.service';

describe('TenderManagementApiService', () => {
  const base = `${environment.apiBaseUrl}/tender-management`;
  let service: TenderManagementApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), TenderManagementApiService],
    });
    service = TestBed.inject(TenderManagementApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the lookups and the dashboard', () => {
    service.getLookups().subscribe();
    http.expectOne(`${base}/lookups`).flush({ success: true, message: 'ok', data: {} });

    service.getDashboard().subscribe();
    http.expectOne(`${base}/dashboard`).flush({ success: true, message: 'ok', data: {} });
  });

  it('lists the participations with the filters as query parameters', () => {
    service.listParticipations({ status: 'Submitted', jurisdiction: 'CH_SIMAP_LAPub', per_page: 200 }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/participations`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('status')).toBe('Submitted');
    expect(request.request.params.get('jurisdiction')).toBe('CH_SIMAP_LAPub');
    expect(request.request.params.get('per_page')).toBe('200');
    request.flush({ success: true, message: 'ok', data: [], meta: {} });
  });

  it('wraps the simap.ch notice in a payload field', () => {
    service.ingestSimap({ projectNumber: '123' }).subscribe();

    const request = http.expectOne(`${base}/notices/ingest-simap`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ payload: { projectNumber: '123' } });
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('posts a status transition with its reason', () => {
    service.transition('p-1', 'Lost', 'price').subscribe();

    const request = http.expectOne(`${base}/participations/p-1/transition`);
    expect(request.request.body).toEqual({ status: 'Lost', reason: 'price' });
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('calls the eligibility evaluation and the economic offer', () => {
    service.evaluateEligibility('p-1').subscribe();
    http.expectOne(`${base}/participations/p-1/evaluate-eligibility`).flush({ success: true, message: 'ok', data: {} });

    service
      .calculateOffer('p-1', {
        discount_percentage: 12.5,
        company_safety_costs_declared: 1000,
        company_labor_costs_declared: 5000,
        bid_base_percentage: '2.00',
        persist: true,
      })
      .subscribe();
    const request = http.expectOne(`${base}/participations/p-1/economic-offer`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.persist).toBe(true);
    expect(request.request.body.bid_base_percentage).toBe('2.00');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('uploads an envelope document as multipart', () => {
    const file = new File(['x'], 'dgue.pdf', { type: 'application/pdf' });
    service.uploadEnvelopeDocument('p-1', 'administrative', 'dgue', file, 'DGUE').subscribe();

    const request = http.expectOne(`${base}/participations/p-1/envelopes/administrative/documents`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body.get('doc_key')).toBe('dgue');
    expect(body.get('label')).toBe('DGUE');
    expect((body.get('file') as File).name).toBe('dgue.pdf');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('removes an envelope document and seeds a checklist', () => {
    service.removeEnvelopeDocument('p-1', 'technical', 'relazione').subscribe();
    const remove = http.expectOne(`${base}/participations/p-1/envelopes/technical/documents/relazione`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ success: true, message: 'ok', data: {} });

    service.seedChecklist('p-1', 'economic').subscribe();
    const seed = http.expectOne(`${base}/participations/p-1/envelopes/economic/seed`);
    expect(seed.request.method).toBe('POST');
    seed.flush({ success: true, message: 'ok', data: [] });
  });

  it('downloads the eDGUE as a blob in the chosen format', () => {
    service.downloadEdgue('p-1', 'xml').subscribe();

    const request = http.expectOne((req) => req.url === `${base}/participations/p-1/edgue/download`);
    expect(request.request.params.get('format')).toBe('xml');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['<xml/>']));
  });

  it('converts an awarded dossier', () => {
    service.convert('p-1', { contact_id: 'c-1', contract_title: 'Contratto' }).subscribe();

    const request = http.expectOne(`${base}/participations/p-1/convert`);
    expect(request.request.body).toEqual({ contact_id: 'c-1', contract_title: 'Contratto' });
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('creates a vault document as multipart, with the SOA list as JSON and without empty values', () => {
    const file = new File(['x'], 'soa.pdf');
    service
      .createVaultDocument({
        doc_type: 'IT_SOA_Attestation',
        document_number: 'SOA-1',
        expiry_date: '2030-01-01',
        issuing_body: '',
        soa_categories_classifications: [{ category: 'OG1', classification: 'III' }],
        file,
      })
      .subscribe();

    const request = http.expectOne(`${base}/vault/documents`);
    const body = request.request.body as FormData;
    expect(body.get('doc_type')).toBe('IT_SOA_Attestation');
    expect(body.get('document_number')).toBe('SOA-1');
    expect(body.has('issuing_body')).toBe(false);
    expect(JSON.parse(body.get('soa_categories_classifications') as string)).toEqual([
      { category: 'OG1', classification: 'III' },
    ]);
    expect((body.get('file') as File).name).toBe('soa.pdf');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('updates a vault document through a method override because PHP does not parse multipart PUT', () => {
    service.updateVaultDocument('d-1', { doc_type: 'IT_DURC', notes: 'n' }).subscribe();

    const request = http.expectOne(`${base}/vault/documents/d-1`);
    expect(request.request.method).toBe('POST');
    expect((request.request.body as FormData).get('_method')).toBe('PUT');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('renews a document and syncs it with FVOE', () => {
    service.renewVaultDocument('d-1', { doc_type: 'IT_DURC', expiry_date: '2029-01-01' }).subscribe();
    http.expectOne(`${base}/vault/documents/d-1/renew`).flush({ success: true, message: 'ok', data: {} });

    service.syncFvoe('d-1').subscribe();
    http.expectOne(`${base}/vault/documents/d-1/sync-fvoe`).flush({ success: true, message: 'ok', data: {} });
  });

  it('filters the vault and reads its overview', () => {
    service.listVaultDocuments({ jurisdiction: 'CH', verification_status: 'Expired' }).subscribe();
    const request = http.expectOne((req) => req.url === `${base}/vault/documents`);
    expect(request.request.params.get('jurisdiction')).toBe('CH');
    expect(request.request.params.get('verification_status')).toBe('Expired');
    request.flush({ success: true, message: 'ok', data: [], meta: {} });

    service.getVaultOverview().subscribe();
    http.expectOne(`${base}/vault/overview`).flush({ success: true, message: 'ok', data: {} });
  });

  it('sends the winners-only flag as 1 and drops it when off', () => {
    service.listBenchmarks({ winners_only: true, cpv_code: '45000000' }).subscribe();
    const on = http.expectOne((req) => req.url === `${base}/benchmarks`);
    expect(on.request.params.get('winners_only')).toBe('1');
    expect(on.request.params.get('cpv_code')).toBe('45000000');
    on.flush({ success: true, message: 'ok', data: [], meta: {} });

    service.listBenchmarks({ winners_only: false }).subscribe();
    const off = http.expectOne((req) => req.url === `${base}/benchmarks`);
    expect(off.request.params.has('winners_only')).toBe(false);
    off.flush({ success: true, message: 'ok', data: [], meta: {} });
  });

  it('reads the statistics of an authority', () => {
    service.getBenchmarkStatistics({ contracting_authority_name: 'Comune di Milano' }).subscribe();

    const request = http.expectOne((req) => req.url === `${base}/benchmarks/statistics`);
    expect(request.request.params.get('contracting_authority_name')).toBe('Comune di Milano');
    request.flush({ success: true, message: 'ok', data: {} });
  });

  it('lists the open alerts and acknowledges one', () => {
    service.listAlerts({ acknowledged: false }).subscribe();
    const list = http.expectOne((req) => req.url === `${base}/alerts`);
    expect(list.request.params.get('acknowledged')).toBe('0');
    list.flush({ success: true, message: 'ok', data: [], meta: {} });

    service.acknowledgeAlert('a-1').subscribe();
    const ack = http.expectOne(`${base}/alerts/a-1/acknowledge`);
    expect(ack.request.method).toBe('POST');
    ack.flush({ success: true, message: 'ok', data: {} });
  });
});
