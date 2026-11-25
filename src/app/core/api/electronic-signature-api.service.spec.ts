import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { EsigEnvelopePayload, EsigProviderPayload } from '../models/electronic-signature.model';
import {
  appendFormValue,
  ElectronicSignatureApiService,
  esigFormData,
} from './electronic-signature-api.service';

describe('ElectronicSignatureApiService', () => {
  let service: ElectronicSignatureApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/signatures`;
  const publicBase = `${environment.apiBaseUrl}/public`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ElectronicSignatureApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ElectronicSignatureApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads the lookups, the dashboard and the policy of a document', () => {
    service.getLookups().subscribe();
    httpTesting.expectOne(`${base}/lookups`).flush({ data: {} });

    service.getDashboard().subscribe();
    httpTesting.expectOne(`${base}/dashboard`).flush({ data: {} });

    service.getPolicy('purchase_order', '6000.00').subscribe();
    const policy = httpTesting.expectOne((req) => req.url === `${base}/policy`);
    expect(policy.request.params.get('document_type')).toBe('purchase_order');
    expect(policy.request.params.get('amount')).toBe('6000.00');
    policy.flush({ data: { minimum_level: 'FEA', template: null } });
  });

  it('lists the envelopes with the filters', () => {
    service.listEnvelopes({ status: 'pending', search: 'contract' }).subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/envelopes`);

    expect(request.request.params.get('status')).toBe('pending');
    expect(request.request.params.get('search')).toBe('contract');
    request.flush({ data: [], meta: {} });
  });

  it('creates an envelope of a business document as JSON without a file', () => {
    const payload = {
      signable_type: 'quote',
      signable_id: 'q-1',
      required_level: 'FES',
      jurisdiction: 'eIDAS',
      recipients: [],
    } as unknown as EsigEnvelopePayload;

    service.createEnvelope(payload).subscribe();
    const request = httpTesting.expectOne(`${base}/envelopes`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).not.toBeInstanceOf(FormData);
    expect(request.request.body.signable_id).toBe('q-1');
    request.flush({ data: {} });
  });

  it('creates the envelope of an uploaded file as multipart', () => {
    const file = new File(['%PDF-'], 'a.pdf', { type: 'application/pdf' });
    const payload = {
      signable_type: 'upload',
      file,
      required_level: 'FES',
      jurisdiction: 'eIDAS',
      recipients: [{ full_name: 'Anna', email: 'anna@example.com', role: 'SIGNER' }],
    } as unknown as EsigEnvelopePayload;

    service.createEnvelope(payload).subscribe();
    const request = httpTesting.expectOne(`${base}/envelopes`);
    const body = request.request.body as FormData;

    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBeInstanceOf(File);
    expect(body.get('recipients[0][email]')).toBe('anna@example.com');
    request.flush({ data: {} });
  });

  it('sends, reminds, voids, audits and downloads an envelope', () => {
    service.sendEnvelope('e-1').subscribe();
    httpTesting.expectOne(`${base}/envelopes/e-1/send`).flush({ data: {} });

    service.remindEnvelope('e-1').subscribe();
    httpTesting.expectOne(`${base}/envelopes/e-1/remind`).flush({ data: { reminded: 1 } });

    service.voidEnvelope('e-1', 'Mistake').subscribe();
    const voided = httpTesting.expectOne(`${base}/envelopes/e-1/void`);
    expect(voided.request.body).toEqual({ reason: 'Mistake' });
    voided.flush({ data: {} });

    service.getAudit('e-1').subscribe();
    httpTesting
      .expectOne(`${base}/envelopes/e-1/audit`)
      .flush({ data: [], meta: { chain_valid: true } });

    service.downloadEnvelope('e-1', 'certificate').subscribe();
    const download = httpTesting.expectOne(`${base}/envelopes/e-1/download/certificate`);
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['%PDF-']));
  });

  it('saves a provider as multipart and overrides the method for an update', () => {
    const payload = {
      provider: 'native',
      jurisdiction: 'BOTH',
      name: 'Native',
      is_sandbox: true,
      is_active: true,
      is_default: false,
      credentials: {},
      settings: null,
      certificate: null,
      certificate_password: null,
    } as EsigProviderPayload;

    service.createProvider(payload).subscribe();
    const created = httpTesting.expectOne(`${base}/providers`);
    expect(created.request.body).toBeInstanceOf(FormData);
    created.flush({ data: {} });

    service.updateProvider('p-1', payload).subscribe();
    const updated = httpTesting.expectOne(`${base}/providers/p-1`);
    expect(updated.request.method).toBe('POST');
    expect((updated.request.body as FormData).get('_method')).toBe('PUT');
    updated.flush({ data: {} });

    service.testProvider('p-1').subscribe();
    httpTesting.expectOne(`${base}/providers/p-1/test`).flush({ data: {} });

    service.deleteProvider('p-1').subscribe();
    httpTesting.expectOne(`${base}/providers/p-1`).flush({ data: null });
  });

  it('manages the compliance templates', () => {
    service.listTemplates().subscribe();
    httpTesting.expectOne(`${base}/templates`).flush({ data: [] });

    service.createTemplate({ name: 'Rule' } as never).subscribe();
    httpTesting.expectOne(`${base}/templates`).flush({ data: {} });

    service.updateTemplate('t-1', { name: 'Rule' } as never).subscribe();
    const update = httpTesting.expectOne(`${base}/templates/t-1`);
    expect(update.request.method).toBe('PUT');
    update.flush({ data: {} });

    service.deleteTemplate('t-1').subscribe();
    httpTesting.expectOne(`${base}/templates/t-1`).flush({ data: null });
  });

  it('talks to the public portal with the token of the link and no staff path', () => {
    service.getPortal('tok').subscribe();
    httpTesting.expectOne(`${publicBase}/sign/tok`).flush({ data: {} });

    service.getPortalDocument('tok').subscribe();
    expect(httpTesting.expectOne(`${publicBase}/sign/tok/document`).request.responseType).toBe(
      'blob',
    );
    httpTesting
      .match(`${publicBase}/sign/tok/document`)
      .forEach((request) => request.flush(new Blob(['x'])));

    service.startChallenge('tok').subscribe();
    httpTesting.expectOne(`${publicBase}/sign/tok/challenge`).flush({ data: {} });

    service
      .sign('tok', { consent_terms: true, consent_legal: true, signature_method: 'click' } as never)
      .subscribe();
    const sign = httpTesting.expectOne(`${publicBase}/sign/tok/sign`);
    expect(sign.request.body.consent_terms).toBe(true);
    sign.flush({ data: { status: 'signed' } });

    service.decline('tok', 'No').subscribe();
    expect(httpTesting.expectOne(`${publicBase}/sign/tok/decline`).request.body).toEqual({
      reason: 'No',
    });
  });

  it('verifies by code, by hash and by file on the public endpoint', () => {
    service.verifyByCode('AAAAA-BBBBB-CCCCC-DDDDD').subscribe();
    const code = httpTesting.expectOne(`${publicBase}/signatures/verify`);
    expect(code.request.body).toEqual({ code: 'AAAAA-BBBBB-CCCCC-DDDDD' });
    code.flush({ data: {} });

    service.verifyByHash('abc').subscribe();
    const hash = httpTesting.expectOne(`${publicBase}/signatures/verify`);
    expect(hash.request.body).toEqual({ sha256: 'abc' });
    hash.flush({ data: {} });

    service.verifyFile(new File(['x'], 'a.pdf')).subscribe();
    const file = httpTesting.expectOne(`${publicBase}/signatures/verify`);
    expect(file.request.body).toBeInstanceOf(FormData);
    file.flush({ data: {} });
  });
});

describe('esigFormData', () => {
  it('flattens nested values, booleans, nulls and files the way PHP reads them', () => {
    const form = esigFormData({
      name: 'Native',
      is_sandbox: true,
      is_default: false,
      settings: null,
      credentials: { client_id: 'abc' },
      list: [1, 2],
      file: new File(['x'], 'seal.p12'),
    });

    expect(form.get('name')).toBe('Native');
    expect(form.get('is_sandbox')).toBe('1');
    expect(form.get('is_default')).toBe('0');
    expect(form.has('settings')).toBe(false);
    expect(form.get('credentials[client_id]')).toBe('abc');
    expect(form.get('list[1]')).toBe('2');
    expect(form.get('file')).toBeInstanceOf(File);
  });

  it('adds the method override only when asked', () => {
    expect(esigFormData({ a: 1 }).has('_method')).toBe(false);
    expect(esigFormData({ a: 1 }, 'PUT').get('_method')).toBe('PUT');
  });

  it('appends a single value', () => {
    const form = new FormData();
    appendFormValue(form, 'x', 'y');

    expect(form.get('x')).toBe('y');
  });
});
