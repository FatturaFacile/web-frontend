import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { DocumentTrustExtraApiService } from './document-trust-extra-api.service';
import { HospitalityExtraApiService } from './hospitality-extra-api.service';
import { ManufacturingExtraApiService } from './manufacturing-extra-api.service';
import { MobileApiService } from './mobile-api.service';

describe('Extra API services (manufacturing, hospitality, mobile, document-trust)', () => {
  let httpMock: HttpTestingController;
  const api = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ManufacturingExtraApiService,
        HospitalityExtraApiService,
        MobileApiService,
        DocumentTrustExtraApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('manufacturing: engineering changes, quality and subcontracting', () => {
    const svc = TestBed.inject(ManufacturingExtraApiService);
    svc.getEngineeringChanges({ page: 1 }).subscribe();
    httpMock.expectOne((r) => r.url === `${api}/manufacturing/engineering-changes` && r.method === 'GET').flush({ data: [] });
    svc.approveEngineeringChange('1').subscribe();
    const approve = httpMock.expectOne(`${api}/manufacturing/engineering-changes/1/approve`);
    expect(approve.request.method).toBe('POST');
    approve.flush({ data: {} });
    svc.resolveNonConformance('2').subscribe();
    httpMock.expectOne(`${api}/manufacturing/quality/non-conformances/2/resolve`).flush({ data: {} });
    svc.updateWorkCenterCalendar('3', { days: [] }).subscribe();
    expect(httpMock.expectOne(`${api}/manufacturing/work-centers/3/calendar`).request.method).toBe('PUT');
  });

  it('hospitality: stays lifecycle and group blocks', () => {
    const svc = TestBed.inject(HospitalityExtraApiService);
    svc.checkInStay('5').subscribe();
    expect(httpMock.expectOne(`${api}/hospitality/stays/5/check-in`).request.method).toBe('POST');
    svc.getStayQuote({ search: 'x' }).subscribe();
    httpMock.expectOne((r) => r.url === `${api}/hospitality/stay-quote`).flush({ data: {} });
    svc.addGroupBlockStays('7', { stays: [] }).subscribe();
    expect(httpMock.expectOne(`${api}/hospitality/group-blocks/7/stays`).request.method).toBe('POST');
  });

  it('mobile: devices, payslips and work sites', () => {
    const svc = TestBed.inject(MobileApiService);
    svc.deleteDevice('d1').subscribe();
    expect(httpMock.expectOne(`${api}/mobile/devices/d1`).request.method).toBe('DELETE');
    svc.downloadPayslip('p1').subscribe();
    expect(httpMock.expectOne(`${api}/mobile/payslips/p1/download`).request.responseType).toBe('blob');
    svc.updateWorkSite('w1', { name: 'A' }).subscribe();
    expect(httpMock.expectOne(`${api}/mobile/work-sites/w1`).request.method).toBe('PUT');
  });

  it('document-trust: packages, legal hold and settings', () => {
    const svc = TestBed.inject(DocumentTrustExtraApiService);
    svc.placeLegalHold('9').subscribe();
    expect(httpMock.expectOne(`${api}/document-trust/preservation-packages/9/legal-hold`).request.method).toBe('POST');
    svc.releaseLegalHold('9').subscribe();
    expect(httpMock.expectOne(`${api}/document-trust/preservation-packages/9/legal-hold`).request.method).toBe('DELETE');
    svc.updatePreservationSettings({ retention_years: 10 }).subscribe();
    expect(httpMock.expectOne(`${api}/document-trust/preservation-settings`).request.method).toBe('PUT');
    svc.approveDisposalProposal('4').subscribe();
    httpMock.expectOne(`${api}/document-trust/preservation-disposal-proposals/4/approve`).flush({ data: {} });
  });
});
