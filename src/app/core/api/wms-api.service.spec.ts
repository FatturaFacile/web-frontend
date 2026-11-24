import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WmsApiService } from './wms-api.service';

describe('WmsApiService', () => {
  let service: WmsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WmsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests the dashboard with the filters the API validates and drops the empty ones', () => {
    service.getDashboard({ days: 7, warehouse_id: '', operating_hours: 10 }).subscribe();
    const request = httpMock.expectOne((req) => req.url.endsWith('/wms/dashboard'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('days')).toBe('7');
    expect(request.request.params.get('operating_hours')).toBe('10');
    expect(request.request.params.has('warehouse_id')).toBe(false);
    request.flush({ data: {} });
  });
});
