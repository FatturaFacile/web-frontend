import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FacilityExtraApiService } from './facility-extra-api.service';

describe('FacilityExtraApiService', () => {
  let service: FacilityExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FacilityExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FacilityExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['getBuilding', 'GET', '/facility/buildings/buildi-1', () => service.getBuilding('buildi-1')],
    ['getSpace', 'GET', '/facility/spaces/spaceI-1', () => service.getSpace('spaceI-1')],
    ['getBooking', 'GET', '/facility/bookings/bookin-1', () => service.getBooking('bookin-1')],
    ['listBookingSeries', 'GET', '/facility/booking-series', () => service.listBookingSeries()],
    ['getBookingSery', 'GET', '/facility/booking-series/bookin-1', () => service.getBookingSery('bookin-1')],
    ['getServiceRequest', 'GET', '/facility/service-requests/servic-1', () => service.getServiceRequest('servic-1')],
    ['updateServiceRequest', 'PUT', '/facility/service-requests/servic-1', () => service.updateServiceRequest('servic-1', {})],
    ['assignServiceRequest', 'POST', '/facility/service-requests/servic-1/assign', () => service.assignServiceRequest('servic-1', {})],
    ['startServiceRequest', 'POST', '/facility/service-requests/servic-1/start', () => service.startServiceRequest('servic-1', {})],
    ['holdServiceRequest', 'POST', '/facility/service-requests/servic-1/hold', () => service.holdServiceRequest('servic-1', {})],
    ['resolveServiceRequest', 'POST', '/facility/service-requests/servic-1/resolve', () => service.resolveServiceRequest('servic-1', {})],
    ['closeServiceRequest', 'POST', '/facility/service-requests/servic-1/close', () => service.closeServiceRequest('servic-1', {})],
    ['reopenServiceRequest', 'POST', '/facility/service-requests/servic-1/reopen', () => service.reopenServiceRequest('servic-1', {})],
    ['cancelServiceRequest', 'POST', '/facility/service-requests/servic-1/cancel', () => service.cancelServiceRequest('servic-1', {})],
    ['linkWorkOrderServiceRequest', 'POST', '/facility/service-requests/servic-1/link-work-order', () => service.linkWorkOrderServiceRequest('servic-1', {})],
    ['raiseWorkOrderServiceRequest', 'POST', '/facility/service-requests/servic-1/raise-work-order', () => service.raiseWorkOrderServiceRequest('servic-1', {})],
    ['getInspectionTemplate', 'GET', '/facility/inspection-templates/inspec-1', () => service.getInspectionTemplate('inspec-1')],
    ['getInspection', 'GET', '/facility/inspections/inspec-1', () => service.getInspection('inspec-1')],
    ['getMeter', 'GET', '/facility/meters/meterI-1', () => service.getMeter('meterI-1')],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.getBuilding('buildi-1', { page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/facility/buildings/buildi-1'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
