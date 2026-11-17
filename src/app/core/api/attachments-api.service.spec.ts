import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AttachmentsApiService } from './attachments-api.service';

describe('AttachmentsApiService', () => {
  let service: AttachmentsApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/attachments`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AttachmentsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AttachmentsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the attachments of a record', () => {
    service.list('invoice', 'inv-1').subscribe();
    const req = httpTesting.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('attachable_type')).toBe('invoice');
    expect(req.request.params.get('attachable_id')).toBe('inv-1');
    req.flush({ success: true, message: '', data: [] });
  });

  it('uploads a file as multipart', () => {
    service.upload('ticket', 't-1', new File(['x'], 'a.pdf')).subscribe();
    const req = httpTesting.expectOne(base);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('attachable_type')).toBe('ticket');
    expect(body.get('attachable_id')).toBe('t-1');
    expect(body.get('file')).toBeInstanceOf(File);
    req.flush({ success: true, message: '', data: { id: 'a-1' } });
  });

  it('downloads as blob and deletes', () => {
    service.download('a-1').subscribe();
    const dl = httpTesting.expectOne(`${base}/a-1/download`);
    expect(dl.request.responseType).toBe('blob');
    dl.flush(new Blob(['x']));

    service.delete('a-1').subscribe();
    const del = httpTesting.expectOne(`${base}/a-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
