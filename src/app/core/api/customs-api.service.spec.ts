import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LOCALLY_HANDLED_ERROR_STATUSES } from '../http/error-handling.context';
import { CustomsApiService } from './customs-api.service';
import { CustomsDossierRequest } from '../models';

describe('CustomsApiService', () => {
  let service: CustomsApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CustomsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CustomsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches dossiers with query params', () => {
    service
      .getDossiers({ status: 'open', search: 'EXP-2026', page: 1, per_page: 10 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].dossier_number).toBe('DOS-001');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/customs/dossiers`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('open');
    expect(req.request.params.get('search')).toBe('EXP-2026');

    req.flush({
      success: true,
      data: [{ id: 'dos-1', dossier_number: 'DOS-001', status: 'open' }],
      meta: { current_page: 1, total: 1 },
    });
  });

  it('creates a new customs dossier', () => {
    const payload: CustomsDossierRequest = {
      customer_contact_id: 'cust-1',
      service_type: 'import_standard',
      direction: 'import',
      currency: 'CHF',
      notes: 'Test consignment',
    };

    service.createDossier(payload).subscribe((res) => {
      expect(res.data.id).toBe('dos-new');
      expect(res.data.direction).toBe('import');
    });

    const req = httpTesting.expectOne(`${base}/customs/dossiers`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({
      success: true,
      data: { id: 'dos-new', dossier_number: 'DOS-NEW', ...payload, status: 'open' },
    });
  });

  it('validates, submits, and cancels customs declaration', () => {
    service.validateDeclaration('decl-1').subscribe((res) => {
      expect(res.data.status).toBe('validated');
    });
    const reqVal = httpTesting.expectOne(`${base}/customs/declarations/decl-1/validate`);
    expect(reqVal.request.method).toBe('POST');
    reqVal.flush({ success: true, data: { status: 'validated', warnings: [] } });

    service.submitDeclaration('decl-1').subscribe((res) => {
      expect(res.data.mrn).toBe('26CH00001234567890');
      expect(res.data.status).toBe('submitted');
    });
    const reqSub = httpTesting.expectOne(`${base}/customs/declarations/decl-1/submit`);
    expect(reqSub.request.method).toBe('POST');
    reqSub.flush({ success: true, data: { mrn: '26CH00001234567890', status: 'submitted' } });

    service.cancelDeclaration('decl-1').subscribe((res) => {
      expect(res.data.status).toBe('cancelled');
    });
    const reqCan = httpTesting.expectOne(`${base}/customs/declarations/decl-1/cancel`);
    expect(reqCan.request.method).toBe('POST');
    reqCan.flush({ success: true, data: { status: 'cancelled' } });
  });

  it('fetches assessment decisions and downloads PDF', () => {
    service
      .getAssessmentDecisions({ mrn: '26CH0001', direction: 'import' })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].signature_status).toBe('verified');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/customs/assessment-decisions`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('mrn')).toBe('26CH0001');
    req.flush({
      success: true,
      data: [
        {
          id: 'dec-1',
          mrn: '26CH0001',
          version: 1,
          document_type: 'eVV',
          direction: 'import',
          document_date: '2026-11-09',
          duty_amount: '120.50',
          vat_amount: '350.00',
          signature_status: 'verified',
        },
      ],
      meta: { current_page: 1, total: 1 },
    });

    service.downloadAssessmentPdf('dec-1').subscribe((blob) => {
      expect(blob).toBeTruthy();
    });
    const reqPdf = httpTesting.expectOne(`${base}/customs/assessment-decisions/dec-1/pdf`);
    expect(reqPdf.request.method).toBe('GET');
    reqPdf.flush(new Blob(['dummy pdf'], { type: 'application/pdf' }));
  });

  it('manages tariff grids and shipment requests', () => {
    service.getTariffGrids().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const reqGrid = httpTesting.expectOne(`${base}/customs/tariff-grids`);
    expect(reqGrid.request.method).toBe('GET');
    reqGrid.flush({
      success: true,
      data: [{ id: 'grid-1', name: 'CH-IT Freight Standard', service_type: 'freight', currency: 'CHF', is_active: true }],
    });

    service.acceptShipmentRequest('req-1').subscribe((res) => {
      expect(res.data.status).toBe('accepted');
    });
    const reqAccept = httpTesting.expectOne(`${base}/customs/shipment-requests/req-1/accept`);
    expect(reqAccept.request.method).toBe('POST');
    reqAccept.flush({ success: true, data: { status: 'accepted' } });
  });

  describe('trade compliance', () => {
    it('loads the trade compliance dashboard', () => {
      service.getTradeComplianceDashboard().subscribe((res) => {
        expect(res.data.transit_overdue).toBe(2);
        expect(res.data.missing_evv[0].invoices[0].invoice_number).toBe('2026/1');
      });
      const req = httpTesting.expectOne(`${base}/customs/trade-compliance/dashboard`);
      expect(req.request.method).toBe('GET');
      req.flush({
        success: true,
        data: {
          by_direction: { export: 3 },
          by_regime: { edec: 3 },
          by_status: { draft: 1 },
          transit_overdue: 2,
          missing_evv: [
            { declaration_id: 'd-1', trader_declaration_number: 'DEC-1', mrn: null, invoices: [{ id: 'i-1', invoice_number: '2026/1' }] },
          ],
        },
      });
    });

    it('assigns an MRN and leaves the 422 to the caller', () => {
      let status = 0;
      service.assignMrn('d-1', '25CH000000000000A1').subscribe({
        error: (err: { status: number }) => (status = err.status),
      });
      const req = httpTesting.expectOne(`${base}/customs/declarations/d-1/mrn`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ mrn: '25CH000000000000A1' });
      expect(req.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toEqual([422]);
      req.flush({ message: 'x', errors: { mrn: ['bad'] } }, { status: 422, statusText: 'Unprocessable' });
      expect(status).toBe(422);
    });

    it('links invoices manually and automatically', () => {
      service.linkInvoices('d-1', ['i-1', 'i-2']).subscribe();
      const link = httpTesting.expectOne(`${base}/customs/declarations/d-1/invoices`);
      expect(link.request.method).toBe('POST');
      expect(link.request.body).toEqual({ invoice_ids: ['i-1', 'i-2'] });
      link.flush({ success: true, data: { id: 'd-1' } });

      service.autoLinkInvoices('d-1').subscribe((res) => expect(res.data.linked).toBe(2));
      const auto = httpTesting.expectOne(`${base}/customs/declarations/d-1/invoices/auto-link`);
      expect(auto.request.method).toBe('POST');
      auto.flush({ success: true, data: { linked: 2 } });
    });

    it('reads the export proof and discharges the transit', () => {
      service.getExportProof('d-1').subscribe((res) => {
        expect(res.data.has_proof).toBe(false);
        expect(res.data.decision).toBeNull();
      });
      const proof = httpTesting.expectOne(`${base}/customs/declarations/d-1/export-proof`);
      expect(proof.request.method).toBe('GET');
      proof.flush({ success: true, data: { has_proof: false, decision: null } });

      service.dischargeTransit('d-1').subscribe();
      const discharge = httpTesting.expectOne(`${base}/customs/declarations/d-1/transit-discharge`);
      expect(discharge.request.method).toBe('POST');
      discharge.flush({ success: true, data: { id: 'd-1' } });
    });

    it('downloads the generated payload as text', () => {
      service.getDeclarationMessage('d-1').subscribe((text) => expect(text).toBe('<xml/>'));
      const req = httpTesting.expectOne(`${base}/customs/declarations/d-1/message`);
      expect(req.request.responseType).toBe('text');
      req.flush('<xml/>');
    });

    it('downloads the pro-forma and the transit sheet as blobs with the language', () => {
      service.downloadProForma('d-1', 'it_de').subscribe((blob) => expect(blob).toBeTruthy());
      const proForma = httpTesting.expectOne((r) => r.url === `${base}/customs/declarations/d-1/pro-forma`);
      expect(proForma.request.params.get('language')).toBe('it_de');
      expect(proForma.request.responseType).toBe('blob');
      proForma.flush(new Blob(['pdf'], { type: 'application/pdf' }));

      service.downloadTransitSheet('d-1', 'it_en').subscribe((blob) => expect(blob).toBeTruthy());
      const sheet = httpTesting.expectOne((r) => r.url === `${base}/customs/declarations/d-1/transit-sheet`);
      expect(sheet.request.params.get('language')).toBe('it_en');
      expect(sheet.request.responseType).toBe('blob');
      sheet.flush(new Blob(['pdf'], { type: 'application/pdf' }));
    });
  });

  describe('import bills', () => {
    it('lists, shows and creates import bills', () => {
      service.getImportBills({ page: 2, per_page: 10 }).subscribe((res) => expect(res.data.length).toBe(1));
      const list = httpTesting.expectOne((r) => r.url === `${base}/customs/import-bills`);
      expect(list.request.params.get('page')).toBe('2');
      list.flush({ success: true, data: [{ id: 'b-1', status: 'draft' }], meta: { total: 1 } });

      service.getImportBill('b-1').subscribe((res) => expect(res.data.id).toBe('b-1'));
      httpTesting.expectOne(`${base}/customs/import-bills/b-1`).flush({ success: true, data: { id: 'b-1' } });

      service
        .createImportBill({
          bill_number: 'B-1',
          bill_date: '2026-11-17',
          currency: 'CHF',
          customs_value: 1000,
          duty_amount: 50,
          vat_rate: 8.1,
        })
        .subscribe();
      const create = httpTesting.expectOne(`${base}/customs/import-bills`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body.bill_number).toBe('B-1');
      expect(create.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toEqual([422]);
      create.flush({ success: true, data: { id: 'b-1' } });
    });

    it('reads the reconciliation and posts the bill', () => {
      service.getImportBillReconciliation('b-1').subscribe((res) => {
        expect(res.data.matches).toBe(true);
        expect(res.data.remainder).toBe('0.00');
      });
      const rec = httpTesting.expectOne(`${base}/customs/import-bills/b-1/reconciliation`);
      expect(rec.request.method).toBe('GET');
      rec.flush({ success: true, data: { bill_total: '10.00', supplier_total: '10.00', remainder: '0.00', matches: true } });

      service.postImportBill('b-1').subscribe((res) => expect(res.data.status).toBe('posted'));
      const post = httpTesting.expectOne(`${base}/customs/import-bills/b-1/post`);
      expect(post.request.method).toBe('POST');
      post.flush({ success: true, data: { id: 'b-1', status: 'posted' } });
    });
  });
});
