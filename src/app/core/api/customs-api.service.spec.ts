import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
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
});
