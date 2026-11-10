import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { RetailApiService } from './retail-api.service';
import {
  CommercialDocumentResource,
  DailyCorrispettivoResource,
  PaginatedResponse,
  StoreCommercialDocumentPayload,
} from '../models';

describe('RetailApiService', () => {
  let service: RetailApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/fiscal-retail`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RetailApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(RetailApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches commercial documents, creates a document, and voids it', () => {
    const mockDoc: CommercialDocumentResource = {
      id: 'doc-1',
      document_number: 'DOC-2026-0001',
      issued_at: '2026-04-10T14:30:00Z',
      payment_method: 'electronic',
      total_amount: 54.90,
      status: 'issued',
    };

    const mockResponse: PaginatedResponse<CommercialDocumentResource> = {
      data: [mockDoc],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    };

    service.getCommercialDocuments({ page: 1 }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].document_number).toBe('DOC-2026-0001');
    });

    const getReq = httpMock.expectOne((req) => req.url === `${base}/commercial-documents` && req.params.get('page') === '1');
    expect(getReq.request.method).toBe('GET');
    getReq.flush(mockResponse);

    // Create document
    const payload: StoreCommercialDocumentPayload = {
      payment_method: 'card',
      lines: [{ description: 'Articolo Test', quantity: 1, unit_price: 25, vat_rate: 22 }],
    };
    service.createCommercialDocument(payload).subscribe((res) => {
      expect(res.data.id).toBe('doc-new');
    });
    const postReq = httpMock.expectOne(`${base}/commercial-documents`);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ data: { id: 'doc-new', document_number: 'DOC-002', status: 'issued', ...payload, total_amount: 25, issued_at: '2026-04-10' } });

    // Void document
    service.voidCommercialDocument('doc-1').subscribe((res) => {
      expect(res.data.status).toBe('voided');
    });
    const voidReq = httpMock.expectOne(`${base}/commercial-documents/doc-1/void`);
    expect(voidReq.request.method).toBe('POST');
    voidReq.flush({ data: { ...mockDoc, status: 'voided' } });
  });

  it('fetches daily corrispettivi', () => {
    const mockDaily: DailyCorrispettivoResource = {
      date: '2026-04-10',
      device_serial: 'RT-12345',
      total_sales: 1250.50,
      total_vat: 225.40,
      transactions_count: 42,
      status: 'transmitted',
    };

    service.getDailyCorrispettivi('2026-04-10').subscribe((res) => {
      expect(res.data.total_sales).toBe(1250.50);
      expect(res.data.transactions_count).toBe(42);
    });

    const req = httpMock.expectOne(`${base}/corrispettivi/daily/2026-04-10`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockDaily });
  });

  it('lists POS sessions from /retail/pos/sessions', () => {
    service.getPosSessions({ page: 1 }).subscribe((res) => {
      expect(res.data.data[0].id).toBe('ses-1');
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiBaseUrl}/retail/pos/sessions` && r.params.get('page') === '1',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { current_page: 1, data: [{ id: 'ses-1' }], last_page: 1, per_page: 15, total: 1 } });
  });
});
