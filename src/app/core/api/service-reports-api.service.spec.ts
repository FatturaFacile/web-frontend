import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ServiceReportsApiService } from './service-reports-api.service';

describe('ServiceReportsApiService', () => {
  let service: ServiceReportsApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/service-reports`;
  const ok = { success: true, message: '', data: { id: 'sr-1' } };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ServiceReportsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ServiceReportsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('creates and reads a service report', () => {
    service.createServiceReport({ contact_id: 'c1', technician_id: 't1', report_date: '2026-03-01' }).subscribe();
    const create = httpTesting.expectOne(base);
    expect(create.request.method).toBe('POST');
    create.flush(ok);

    service.getServiceReport('sr-1').subscribe((res) => expect(res.data.id).toBe('sr-1'));
    httpTesting.expectOne(`${base}/sr-1`).flush(ok);
  });

  it('updates with PUT and PATCH and deletes', () => {
    service.updateServiceReport('sr-1', { site_address: 'Via Roma 1' }).subscribe();
    const put = httpTesting.expectOne(`${base}/sr-1`);
    expect(put.request.method).toBe('PUT');
    put.flush(ok);

    service.patchServiceReport('sr-1', { is_portal_visible: true }).subscribe();
    const patch = httpTesting.expectOne(`${base}/sr-1`);
    expect(patch.request.method).toBe('PATCH');
    patch.flush(ok);

    service.deleteServiceReport('sr-1').subscribe();
    const del = httpTesting.expectOne(`${base}/sr-1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });
});
