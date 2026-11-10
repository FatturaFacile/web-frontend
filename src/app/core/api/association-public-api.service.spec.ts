import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssociationPublicApiService } from './association-public-api.service';

describe('AssociationPublicApiService', () => {
  let service: AssociationPublicApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/association-public/enrolment`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssociationPublicApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssociationPublicApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the public form', () => {
    let title = '';
    service.getForm('tok').subscribe((res) => (title = res.data.title));
    const req = http.expectOne(`${base}/tok`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { association: 'ASD Lugano', title: 'Iscrizione 2027', description: null, is_open: true, fields: [], documents: [] } });
    expect(title).toBe('Iscrizione 2027');
  });

  it('submits the application as multipart form data', () => {
    const payload = new FormData();
    payload.append('first_name', 'Anna');
    payload.append('documents[d-1]', new File(['x'], 'id.pdf'));
    let code = '';
    service.submit('tok', payload).subscribe((res) => (code = res.data.tracking_code));
    const req = http.expectOne(`${base}/tok`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(payload);
    req.flush({ data: { tracking_code: 'ABC123', received: true } });
    expect(code).toBe('ABC123');
  });

  it('downloads the template of a document', () => {
    service.downloadTemplate('tok', 'd-1').subscribe((blob) => expect(blob.size).toBe(3));
    const req = http.expectOne(`${base}/tok/documents/d-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['pdf']));
  });

  it('tracks an application with its tracking code', () => {
    let status = '';
    service.trackApplication('tok', 'ABC 123').subscribe((res) => (status = res.data.status));
    const req = http.expectOne(`${base}/tok/applications/ABC%20123`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { status: 'approved' } });
    expect(status).toBe('approved');
  });
});
