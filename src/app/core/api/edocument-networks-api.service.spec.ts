import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { EDocumentNetworksApiService } from './edocument-networks-api.service';

describe('EDocumentNetworksApiService', () => {
  let service: EDocumentNetworksApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/edocument-networks`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EDocumentNetworksApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EDocumentNetworksApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the networks', () => {
    service.getNetworks().subscribe();
    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [] });
  });

  it('downloads the Peppol UBL of an invoice as a blob', () => {
    service.downloadPeppolUbl('inv-1').subscribe();
    const req = httpMock.expectOne(`${base}/peppol/invoices/inv-1/ubl`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['<Invoice/>']));
  });
});
