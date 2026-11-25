import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { CorporateConventionsApiService } from './corporate-conventions-api.service';

describe('CorporateConventionsApiService', () => {
  let api: CorporateConventionsApiService;
  let http: HttpTestingController;
  const sales = `${environment.apiBaseUrl}/sales`;
  const conventions = `${sales}/corporate-conventions`;
  const publicBase = `${environment.apiBaseUrl}/public/conventions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(CorporateConventionsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('lists the conventions with the filters as query parameters, dropping the empty ones', () => {
    api.listConventions({ country_code: 'CH', status: '', q: 'acme', page: 2 }).subscribe();

    const request = http.expectOne((req) => req.url === conventions);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('country_code')).toBe('CH');
    expect(request.request.params.get('q')).toBe('acme');
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ success: true, message: '', data: [], meta: {} });
  });

  it('transitions a convention and imports the employer list as a dry run first', () => {
    api.transitionConvention('c-1', 'ACTIVE').subscribe();
    const transition = http.expectOne(`${conventions}/c-1/transition`);
    expect(transition.request.body).toEqual({ status: 'ACTIVE' });
    transition.flush({});

    api.importIdentifiers('c-1', ['A001'], true).subscribe();
    const imported = http.expectOne(`${conventions}/c-1/identifiers`);
    expect(imported.request.body).toEqual({ identifiers: ['A001'], dry_run: true });
    imported.flush({});
  });

  it('uploads the contract and the logo as multipart forms', () => {
    const file = new File(['%PDF'], 'contract.pdf', { type: 'application/pdf' });
    api.uploadContract('c-1', file).subscribe();
    const contract = http.expectOne(`${conventions}/c-1/contract`);
    expect(contract.request.body instanceof FormData).toBe(true);
    contract.flush({});

    api.uploadLogo('c-1', file).subscribe();
    expect(http.expectOne(`${conventions}/c-1/logo`).request.body instanceof FormData).toBe(true);
  });

  it('prices the cart and commits the sale at the till', () => {
    api.priceCart({ identifier: 'FFCONV:x', lines: [{ quantity: 1, unit_price: 10 }] }).subscribe();
    const pricing = http.expectOne(`${conventions}/pos/pricing`);
    expect(pricing.request.method).toBe('POST');
    expect(pricing.request.body.identifier).toBe('FFCONV:x');
    pricing.flush({});

    api
      .checkout({
        enrollment_id: 'e-1',
        lines: [],
        source_document_type: 'POS_RECEIPT',
        source_document_id: 'doc',
      })
      .subscribe();
    expect(http.expectOne(`${conventions}/pos/checkout`).request.body.source_document_type).toBe(
      'POS_RECEIPT',
    );
  });

  it('previews and generates the consolidated invoice, and reads the pending quotas', () => {
    api.getPendingQuotas().subscribe();
    http.expectOne(`${sales}/split-billings/pending`).flush({});

    api
      .previewConsolidation({ convention_id: 'c-1', period: '2028-02', anonymize: true })
      .subscribe();
    expect(http.expectOne(`${sales}/split-billings/preview`).request.body).toEqual({
      convention_id: 'c-1',
      period: '2028-02',
      anonymize: true,
    });

    api.generateInvoice({ convention_id: 'c-1', period: '2028-02' }).subscribe();
    expect(http.expectOne(`${sales}/split-billings/generate-invoice`).request.method).toBe('POST');
  });

  it('records welfare vouchers and reconciles them against a statement', () => {
    api.submitVoucherBatch('EDENRED', 'B-1', ['v1']).subscribe();
    expect(http.expectOne(`${sales}/welfare-vouchers/submit-batch`).request.body).toEqual({
      provider: 'EDENRED',
      batch_reference: 'B-1',
      redemption_ids: ['v1'],
    });

    api
      .reconcileVouchers({
        provider: 'EDENRED',
        batch_reference: 'B-1',
        lines: [{ voucher_code: 'X', settled_amount: 9.2 }],
      })
      .subscribe();
    expect(http.expectOne(`${sales}/welfare-vouchers/reconcile`).request.body.lines).toHaveLength(
      1,
    );
  });

  it('downloads the ROI export and the schedule as blobs', () => {
    api.exportRoi({ currency: 'CHF' }).subscribe();
    const roi = http.expectOne((req) => req.url === `${conventions}/analytics/roi/export`);
    expect(roi.request.responseType).toBe('blob');
    expect(roi.request.params.get('currency')).toBe('CHF');
    roi.flush(new Blob(['x']));

    api.downloadSchedule('inv-1').subscribe();
    expect(
      http.expectOne(`${sales}/split-billings/invoices/inv-1/attachment`).request.responseType,
    ).toBe('blob');
  });

  it('serves the public landing page without the back-office prefix', () => {
    api.getPublicConvention('acme').subscribe();
    http.expectOne(`${publicBase}/acme`).flush({});

    api.requestOtp('acme', 'mario@acme.it').subscribe();
    expect(http.expectOne(`${publicBase}/acme/request-otp`).request.body).toEqual({
      email: 'mario@acme.it',
    });

    api.verifyOtp('acme', 'mario@acme.it', '123456', 'Mario Rossi').subscribe();
    expect(http.expectOne(`${publicBase}/acme/verify-otp`).request.body).toEqual({
      email: 'mario@acme.it',
      code: '123456',
      full_name: 'Mario Rossi',
    });

    api.addPublicFamilyMember('pass-1', { full_name: 'Anna', relationship: 'SPOUSE' }).subscribe();
    expect(
      http.expectOne(`${publicBase}/passes/pass-1/family-members`).request.body.relationship,
    ).toBe('SPOUSE');
  });

  it('builds the asset URLs of a pass', () => {
    expect(api.passAssetUrl('pass-1', 'qr.svg')).toBe(`${publicBase}/passes/pass-1/qr.svg`);
    expect(api.passAssetUrl('pass-1', 'apple.pkpass')).toBe(
      `${publicBase}/passes/pass-1/apple.pkpass`,
    );
    expect(api.publicLogoUrl('acme')).toBe(`${publicBase}/acme/logo`);
  });
});
