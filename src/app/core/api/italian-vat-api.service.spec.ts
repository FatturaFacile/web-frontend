import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ItalianVatApiService } from './italian-vat-api.service';

describe('ItalianVatApiService', () => {
  const base = `${environment.apiBaseUrl}/italian-vat`;
  let api: ItalianVatApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ItalianVatApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the sezionali of a register type', () => {
    api.getSections('sales').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/sections`);
    expect(req.request.params.get('register_type')).toBe('sales');
    req.flush({ success: true, message: '', data: [] });
  });

  it('reads a register of a period and prints it definitively', () => {
    api.getRegister('s1', { from: '2026-01-01', to: '2026-03-31' }).subscribe();
    const read = http.expectOne((r) => r.url === `${base}/registers/s1`);
    expect(read.request.params.get('from')).toBe('2026-01-01');
    read.flush({ data: {} });

    api.printRegister('s1', { year: 2026, period_to: '2026-03-31' }).subscribe();
    const print = http.expectOne(`${base}/registers/s1/prints`);
    expect(print.request.method).toBe('POST');
    expect(print.request.body).toEqual({ year: 2026, period_to: '2026-03-31' });
  });

  it('verifies and downloads a print', () => {
    api.verifyPrint('p1').subscribe();
    http.expectOne(`${base}/register-prints/p1/verify`);
    api.downloadPrintPdf('p1').subscribe();
    expect(http.expectOne(`${base}/register-prints/p1/pdf`).request.responseType).toBe('blob');
  });

  it('previews and registers the ventilation of the takings', () => {
    const request = {
      entry_date: '2026-01-02',
      gross_takings: '100.00',
      purchase_basis: [{ rate: '22', amount: '50.00' }],
    };
    api.previewVentilation(request).subscribe();
    expect(http.expectOne(`${base}/receipts/ventilation/preview`).request.body).toEqual(request);
    api.registerVentilation(request).subscribe();
    expect(http.expectOne(`${base}/receipts/ventilation`).request.method).toBe('POST');
  });

  it('manages third-party goods movements and balances', () => {
    api.getGoodsMovements({ from: '2026-01-01' }).subscribe();
    expect(
      http.expectOne((r) => r.url === `${base}/goods-movements`).request.params.get('from'),
    ).toBe('2026-01-01');
    api.getGoodsBalances({ as_of: '2026-12-31' }).subscribe();
    expect(
      http.expectOne((r) => r.url === `${base}/goods-balances`).request.params.get('as_of'),
    ).toBe('2026-12-31');
    api
      .createGoodsMovement({
        movement_date: '2026-01-02',
        movement_type: 'received',
        contact_id: 'c1',
        description: 'Wine',
        quantity: 3,
      })
      .subscribe();
    expect(http.expectOne(`${base}/goods-movements`).request.method).toBe('POST');
  });

  it('monitors, checks and revokes plafond declarations', () => {
    api.getPlafondMonitor(2026).subscribe();
    expect(
      http.expectOne((r) => r.url === `${base}/plafond/monitor`).request.params.get('year'),
    ).toBe('2026');
    api.checkPlafond({ contact_id: 'c1', date: '2026-02-01', amount: 100 }).subscribe();
    expect(http.expectOne(`${base}/plafond/check`).request.method).toBe('POST');
    api.revokeDeclaration('d1', 'closed').subscribe();
    expect(http.expectOne(`${base}/plafond/declarations/d1/revoke`).request.body).toEqual({
      reason: 'closed',
    });
  });

  it('drives the LIPE status flow', () => {
    api.getLipeList(2026).subscribe();
    http.expectOne((r) => r.url === `${base}/lipe`);
    api.generateLipe({ year: 2026, quarter: 1 }).subscribe();
    expect(http.expectOne(`${base}/lipe`).request.body).toEqual({ year: 2026, quarter: 1 });
    api.reconcileLipe('l1').subscribe();
    http.expectOne(`${base}/lipe/l1/reconcile`);
    api.signLipe('l1', { signature: 'sig', certificate: 'cert' }).subscribe();
    http.expectOne(`${base}/lipe/l1/signature`);
    api.markLipeReady('l1').subscribe();
    http.expectOne(`${base}/lipe/l1/ready`);
    api.recordLipeTransmission('l1', { protocol: '12345678901234567-000001' }).subscribe();
    http.expectOne(`${base}/lipe/l1/transmission`);
    api.recordLipeRejection('l1', 'schema').subscribe();
    expect(http.expectOne(`${base}/lipe/l1/rejection`).request.body).toEqual({ reason: 'schema' });
    api.downloadLipeXml('l1').subscribe();
    expect(http.expectOne(`${base}/lipe/l1/xml`).request.responseType).toBe('blob');
  });

  it('calculates and finalises the annual VAT', () => {
    api.getAnnualVat(2025).subscribe();
    http.expectOne(`${base}/annual-vat/2025`);
    api.calculateAnnualVat(2025).subscribe();
    expect(http.expectOne(`${base}/annual-vat/2025/calculate`).request.method).toBe('POST');
    api.finalizeAnnualVat(2025).subscribe();
    http.expectOne(`${base}/annual-vat/2025/finalize`);
  });

  it('builds, validates, issues and exports the Certificazione Unica', () => {
    api.getCertifications(2025).subscribe();
    http.expectOne(`${base}/cu/2025`);
    api.buildCertifications(2025).subscribe();
    http.expectOne(`${base}/cu/2025/build`);
    api.issueCertifications(2025).subscribe();
    http.expectOne(`${base}/cu/2025/issue`);
    api.validateCertifications(2025).subscribe();
    http.expectOne(`${base}/cu/2025/validation`);
    api.downloadCuFile(2025).subscribe();
    expect(http.expectOne(`${base}/cu/2025/file`).request.responseType).toBe('blob');
    api.downloadCuPdf('c1').subscribe();
    expect(http.expectOne(`${base}/cu/certifications/c1/pdf`).request.responseType).toBe('blob');
  });

  it('tracks the F24 payments of the withholdings', () => {
    api.getF24(2025).subscribe();
    http.expectOne(`${base}/f24/2025`);
    api.syncF24(2025).subscribe();
    http.expectOne(`${base}/f24/2025/sync`);
    api.getF24Reconciliation(2025).subscribe();
    http.expectOne(`${base}/f24/2025/reconciliation`);
    api.payF24('f1', { amount: 10, paid_at: '2026-01-16' }).subscribe();
    expect(http.expectOne(`${base}/f24/payments/f1/payments`).request.body).toEqual({
      amount: 10,
      paid_at: '2026-01-16',
    });
  });
});
