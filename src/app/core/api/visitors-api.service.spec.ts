import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  VisitorsCheckInRequest,
  VisitorsKiosk,
  VisitorsKioskCheckInRequest,
  VisitorsKioskCheckOutRequest,
  VisitorsKioskRequest,
  VisitorsKioskVisit,
  VisitorsVisit,
  VisitorsVisitRequest,
  VisitorsVisitor,
  VisitorsVisitorRequest,
} from '../models';
import { VisitorsApiService } from './visitors-api.service';

describe('VisitorsApiService', () => {
  let service: VisitorsApiService;
  let httpMock: HttpTestingController;

  const mockVisitor: VisitorsVisitor = {
    id: 'vis-1',
    first_name: 'Paolo',
    last_name: 'Bianchi',
    full_name: 'Paolo Bianchi',
    company_name: 'Acme Corp',
    email: 'paolo@acme.it',
    phone: '+39 333 444555',
    has_document: true,
    last_visit_at: '2026-11-09T09:00:00Z',
    created_at: '2026-11-01T08:00:00Z',
  };

  const mockVisit: VisitorsVisit = {
    id: 'vst-1',
    visitor_id: 'vis-1',
    visitor: mockVisitor,
    host_user_id: 'usr-1',
    host: { id: 'usr-1', name: 'Laura Direzione' },
    expected_at: '2026-11-09T10:00:00Z',
    purpose: 'Riunione commerciale',
    status: 'expected',
  };

  const mockKiosk: VisitorsKiosk = {
    id: 'ksk-1',
    name: 'Reception Ingresso',
    device_key: 'dev-key-123',
    is_active: true,
    created_at: '2026-11-01T08:00:00Z',
  };

  const mockKioskVisit: VisitorsKioskVisit = {
    id: 'vst-1',
    visitor_name: 'Paolo B.',
    host_name: 'Laura Direzione',
    expected_at: '2026-11-09T10:00:00Z',
    status: 'expected',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VisitorsApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(VisitorsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should list visitors registry with search filter', () => {
    service.getVisitors({ search: 'Paolo' }).subscribe((res) => {
      expect(res.data).toEqual([mockVisitor]);
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/visitors/visitors') && r.params.get('search') === 'Paolo');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [mockVisitor] });
  });

  it('should create and update a visitor record', () => {
    const payload: VisitorsVisitorRequest = {
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario@rossi.it',
    };

    service.createVisitor(payload).subscribe((res) => {
      expect(res.data.id).toBe('vis-1');
    });

    const req1 = httpMock.expectOne((r) => r.url.endsWith('/visitors/visitors'));
    expect(req1.request.method).toBe('POST');
    req1.flush({ data: mockVisitor });

    service.updateVisitor('vis-1', { company_name: 'New Tech' }).subscribe((res) => {
      expect(res.data).toBeDefined();
    });

    const req2 = httpMock.expectOne((r) => r.url.endsWith('/visitors/visitors/vis-1'));
    expect(req2.request.method).toBe('PUT');
    req2.flush({ data: { ...mockVisitor, company_name: 'New Tech' } });
  });

  it('should announce, check-in, check-out, and cancel a visit', () => {
    const visitReq: VisitorsVisitRequest = {
      visitor_id: 'vis-1',
      host_user_id: 'usr-1',
      expected_at: '2026-11-09T10:00:00Z',
      purpose: 'Colloquio',
    };

    service.announceVisit(visitReq).subscribe((res) => {
      expect(res.data.id).toBe('vst-1');
    });
    const r1 = httpMock.expectOne((r) => r.url.endsWith('/visitors/visits'));
    expect(r1.request.method).toBe('POST');
    r1.flush({ data: mockVisit });

    const checkInReq: VisitorsCheckInRequest = { badge_number: 'B-101' };
    service.checkInVisit('vst-1', checkInReq).subscribe((res) => {
      expect(res.data.status).toBe('checked_in');
    });
    const r2 = httpMock.expectOne((r) => r.url.endsWith('/visitors/visits/vst-1/check-in'));
    expect(r2.request.method).toBe('POST');
    r2.flush({ data: { ...mockVisit, status: 'checked_in', badge_number: 'B-101' } });

    service.checkOutVisit('vst-1').subscribe((res) => {
      expect(res.data.status).toBe('checked_out');
    });
    const r3 = httpMock.expectOne((r) => r.url.endsWith('/visitors/visits/vst-1/check-out'));
    expect(r3.request.method).toBe('POST');
    r3.flush({ data: { ...mockVisit, status: 'checked_out' } });

    service.cancelVisit('vst-1').subscribe((res) => {
      expect(res.data.status).toBe('cancelled');
    });
    const r4 = httpMock.expectOne((r) => r.url.endsWith('/visitors/visits/vst-1/cancel'));
    expect(r4.request.method).toBe('POST');
    r4.flush({ data: { ...mockVisit, status: 'cancelled' } });
  });

  it('should manage kiosks and kiosk self-service operations', () => {
    const kioskReq: VisitorsKioskRequest = { name: 'Totem Ingresso' };
    service.registerKiosk(kioskReq).subscribe((res) => {
      expect(res.data.id).toBe('ksk-1');
    });
    const r1 = httpMock.expectOne((r) => r.url.endsWith('/visitors/kiosks'));
    expect(r1.request.method).toBe('POST');
    r1.flush({ data: mockKiosk });

    service.getKioskExpected('dev-key-123').subscribe((res) => {
      expect(res.data).toEqual([mockKioskVisit]);
    });
    const r2 = httpMock.expectOne((r) => r.url.endsWith('/visitor-kiosk/expected'));
    expect(r2.request.method).toBe('GET');
    r2.flush({ data: [mockKioskVisit] });

    const kCheckIn: VisitorsKioskCheckInRequest = {
      visit_id: 'vst-1',
      badge_number: 'B-101',
    };
    service.kioskCheckIn(kCheckIn).subscribe((res) => {
      expect(res.data.badge_number).toBe('B-101');
    });
    const r3 = httpMock.expectOne((r) => r.url.endsWith('/visitor-kiosk/check-in'));
    expect(r3.request.method).toBe('POST');
    r3.flush({ data: { ...mockKioskVisit, badge_number: 'B-101', status: 'checked_in' } });

    const kCheckOut: VisitorsKioskCheckOutRequest = { badge_number: 'B-101' };
    service.kioskCheckOut(kCheckOut).subscribe((res) => {
      expect(res.data.status).toBe('checked_out');
    });
    const r4 = httpMock.expectOne((r) => r.url.endsWith('/visitor-kiosk/check-out'));
    expect(r4.request.method).toBe('POST');
    r4.flush({ data: { ...mockKioskVisit, status: 'checked_out' } });
  });
});
