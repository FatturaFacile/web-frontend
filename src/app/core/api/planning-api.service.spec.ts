import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlanningApiService } from './planning-api.service';

describe('PlanningApiService', () => {
  let service: PlanningApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlanningApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlanningApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads a single resource', () => {
    service.getResource('r1').subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/planning/resources/r1'));
    expect(req.request.method).toBe('GET');
    req.flush({ data: {} });
  });
});
