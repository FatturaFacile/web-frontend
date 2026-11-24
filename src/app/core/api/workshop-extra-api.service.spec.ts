import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkshopExtraApiService } from './workshop-extra-api.service';

describe('WorkshopExtraApiService', () => {
  let service: WorkshopExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [WorkshopExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WorkshopExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['getVehicleStock', 'GET', '/workshop/vehicle-stock/vehicl-1', () => service.getVehicleStock('vehicl-1')],
    ['listBays', 'GET', '/workshop/bays', () => service.listBays()],
    ['createBay', 'POST', '/workshop/bays', () => service.createBay({})],
    ['updateBay', 'PUT', '/workshop/bays/bayId-1', () => service.updateBay('bayId-1', {})],
    ['getSchedule', 'GET', '/workshop/schedule', () => service.getSchedule()],
    ['createSchedule', 'POST', '/workshop/schedule', () => service.createSchedule({})],
    ['updateSchedule', 'PUT', '/workshop/schedule/schedu-1', () => service.updateSchedule('schedu-1', {})],
    ['startSchedule', 'POST', '/workshop/schedule/schedu-1/start', () => service.startSchedule('schedu-1', {})],
    ['completeSchedule', 'POST', '/workshop/schedule/schedu-1/complete', () => service.completeSchedule('schedu-1', {})],
    ['cancelSchedule', 'POST', '/workshop/schedule/schedu-1/cancel', () => service.cancelSchedule('schedu-1', {})],
    ['listEstimates', 'GET', '/workshop/estimates', () => service.listEstimates()],
    ['createEstimate', 'POST', '/workshop/estimates', () => service.createEstimate({})],
    ['getEstimate', 'GET', '/workshop/estimates/estima-1', () => service.getEstimate('estima-1')],
    ['updateEstimate', 'PUT', '/workshop/estimates/estima-1', () => service.updateEstimate('estima-1', {})],
    ['deleteEstimate', 'DELETE', '/workshop/estimates/estima-1', () => service.deleteEstimate('estima-1')],
    ['createEstimateLine', 'POST', '/workshop/estimates/estima-1/lines', () => service.createEstimateLine('estima-1', {})],
    ['deleteEstimateLine', 'DELETE', '/workshop/estimates/estima-1/lines/lineId-2', () => service.deleteEstimateLine('estima-1', 'lineId-2')],
    ['sendEstimate', 'POST', '/workshop/estimates/estima-1/send', () => service.sendEstimate('estima-1', {})],
    ['approveEstimate', 'POST', '/workshop/estimates/estima-1/approve', () => service.approveEstimate('estima-1', {})],
    ['rejectEstimate', 'POST', '/workshop/estimates/estima-1/reject', () => service.rejectEstimate('estima-1', {})],
    ['convertEstimate', 'POST', '/workshop/estimates/estima-1/convert', () => service.convertEstimate('estima-1', {})],
    ['listWarrantyClaims', 'GET', '/workshop/warranty-claims', () => service.listWarrantyClaims()],
    ['createWarrantyClaim', 'POST', '/workshop/warranty-claims', () => service.createWarrantyClaim({})],
    ['getWarrantyClaim', 'GET', '/workshop/warranty-claims/warran-1', () => service.getWarrantyClaim('warran-1')],
    ['updateWarrantyClaim', 'PUT', '/workshop/warranty-claims/warran-1', () => service.updateWarrantyClaim('warran-1', {})],
    ['submitWarrantyClaim', 'POST', '/workshop/warranty-claims/warran-1/submit', () => service.submitWarrantyClaim('warran-1', {})],
    ['acceptWarrantyClaim', 'POST', '/workshop/warranty-claims/warran-1/accept', () => service.acceptWarrantyClaim('warran-1', {})],
    ['rejectWarrantyClaim', 'POST', '/workshop/warranty-claims/warran-1/reject', () => service.rejectWarrantyClaim('warran-1', {})],
    ['reimburseWarrantyClaim', 'POST', '/workshop/warranty-claims/warran-1/reimburse', () => service.reimburseWarrantyClaim('warran-1', {})],
    ['listFolderParts', 'GET', '/workshop/folders/folder-1/parts', () => service.listFolderParts('folder-1')],
    ['createFolderPart', 'POST', '/workshop/folders/folder-1/parts', () => service.createFolderPart('folder-1', {})],
    ['getPartAvailability', 'GET', '/workshop/parts/partId-1/availability', () => service.getPartAvailability('partId-1')],
    ['issuePartConsumption', 'POST', '/workshop/part-consumptions/partCo-1/issue', () => service.issuePartConsumption('partCo-1', {})],
    ['releasePartConsumption', 'POST', '/workshop/part-consumptions/partCo-1/release', () => service.releasePartConsumption('partCo-1', {})],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.getVehicleStock('vehicl-1', { page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/workshop/vehicle-stock/vehicl-1'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
