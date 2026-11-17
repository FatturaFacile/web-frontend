import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ViesApiService } from './vies-api.service';

describe('ViesApiService', () => {
  let service: ViesApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ViesApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('posts the VAT number to the VIES endpoint', () => {
    service.validate({ vat_number: 'DE123456789', country_code: 'DE' }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/fiscal/vies/validate'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ vat_number: 'DE123456789', country_code: 'DE' });
    req.flush({ success: true, message: 'ok', data: { status: 'valid' } });
    httpMock.verify();
  });
});
