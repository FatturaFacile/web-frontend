import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { EsterometroApiService } from './esterometro-api.service';

describe('EsterometroApiService', () => {
  let service: EsterometroApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EsterometroApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests dashboard summary', () => {
    service.getDashboard().subscribe();
    const req = httpMock.expectOne('/api/v1/esterometro/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush({ data: { counts: { total: 0 } } });
  });

  it('posts classify-preview and generateFromPassive', () => {
    service.classifyPreview({ supplier_country_code: 'DE', transaction_nature: 'SERVICES' }).subscribe();
    const previewReq = httpMock.expectOne('/api/v1/esterometro/classify-preview');
    expect(previewReq.request.method).toBe('POST');
    previewReq.flush({ data: { document_type: 'TD17' } });

    service.generateFromPassive('inv-1').subscribe();
    const genReq = httpMock.expectOne('/api/v1/esterometro/self-invoices/from-passive/inv-1');
    expect(genReq.request.method).toBe('POST');
    genReq.flush({ data: { id: 'si-1' } });
  });

  it('posts batch-send', () => {
    service.batchSendToSdi(['si-1', 'si-2']).subscribe();
    const req = httpMock.expectOne('/api/v1/esterometro/self-invoices/batch-send');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ids: ['si-1', 'si-2'] });
    req.flush({ data: { sent_ids: ['si-1', 'si-2'], failed: [] } });
  });
});
