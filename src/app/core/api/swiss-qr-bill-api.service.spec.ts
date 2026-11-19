import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { SwissQrBillApiService } from './swiss-qr-bill-api.service';

describe('SwissQrBillApiService', () => {
  let service: SwissQrBillApiService;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/swiss-qr-bill`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SwissQrBillApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SwissQrBillApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('requests the payment slip PDF as a blob with the chosen layout options', () => {
    service.generatePdf({ invoice_id: 'inv-1', mode: 'STANDALONE', perforation: 'NONE', language: 'de' }).subscribe((blob) => {
      expect(blob.size).toBe(4);
    });

    const req = http.expectOne(`${url}/generate-pdf`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.body).toEqual({ invoice_id: 'inv-1', mode: 'STANDALONE', perforation: 'NONE', language: 'de' });
    req.flush(new Blob(['%PDF']));
  });

  it('uploads the QR-bill file as multipart form data to the parse endpoint', () => {
    const file = new File(['x'], 'bill.pdf', { type: 'application/pdf' });
    service.parseFile(file).subscribe();

    const req = http.expectOne(`${url}/parse`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({ success: true, data: {} });
  });

  it('posts a raw payload to the parse endpoint', () => {
    service.parsePayload('SPC\n0200').subscribe();
    const req = http.expectOne(`${url}/parse`);
    expect(req.request.body).toEqual({ payload: 'SPC\n0200' });
    req.flush({ success: true, data: {} });
  });

  it('validates an IBAN and reference pair', () => {
    service.validateReference('CH9300762011623852957', 'RF18539007547034').subscribe();
    const req = http.expectOne(`${url}/validate-reference`);
    expect(req.request.body).toEqual({ iban: 'CH9300762011623852957', reference: 'RF18539007547034' });
    req.flush({ success: true, data: { valid: true } });
  });
});
