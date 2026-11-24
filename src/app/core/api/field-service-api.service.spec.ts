import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { FieldServiceApiService } from './field-service-api.service';

describe('FieldServiceApiService', () => {
  let service: FieldServiceApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FieldServiceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FieldServiceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('lists the field service tickets', () => {
    service.getTickets().subscribe((res) => expect(res.data).toEqual([]));
    const req = httpTesting.expectOne(`${environment.apiBaseUrl}/field-service/tickets`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: [] });
    httpTesting.verify();
  });
});
