import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { CreditManagementApiService } from './credit-management-api.service';

describe('CreditManagementApiService', () => {
  let service: CreditManagementApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/credit-management`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CreditManagementApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CreditManagementApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('reads single scores, limit requests, insurance policies and disputes', () => {
    service.getScore('s-1').subscribe();
    httpTesting.expectOne(`${base}/scores/s-1`).flush({ data: { id: 's-1' } });

    service.getLimitRequest('l-1').subscribe();
    httpTesting.expectOne(`${base}/limit-requests/l-1`).flush({ data: { id: 'l-1' } });

    service.getInsurancePolicy('p-1').subscribe();
    httpTesting.expectOne(`${base}/insurance-policies/p-1`).flush({ data: { id: 'p-1' } });

    service.getDispute('d-1').subscribe();
    const dispute = httpTesting.expectOne(`${base}/disputes/d-1`);
    expect(dispute.request.method).toBe('GET');
    dispute.flush({ data: { id: 'd-1' } });
  });
});
