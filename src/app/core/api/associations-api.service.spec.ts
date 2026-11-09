import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AssociationsApiService } from './associations-api.service';
import {
  AssociationCourseRequest,
  AssociationDonationRequest,
  AssociationMemberRequest,
} from '../models';

describe('AssociationsApiService', () => {
  let service: AssociationsApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssociationsApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssociationsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches association members list with params', () => {
    service
      .getMembers({ status: 'active', search: 'Rossi', page: 1, per_page: 20 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].last_name).toBe('Rossi');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/associations/members`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('active');
    expect(req.request.params.get('search')).toBe('Rossi');

    req.flush({
      success: true,
      data: [{ id: 'mem-1', first_name: 'Mario', last_name: 'Rossi', status: 'active' }],
      meta: { current_page: 1, total: 1 },
    });
  });

  it('creates an association member', () => {
    const payload: AssociationMemberRequest = {
      first_name: 'Elena',
      last_name: 'Ferrari',
      email: 'elena.ferrari@example.ch',
      fiscal_code: 'FRRLNE85M41L123X',
      joined_on: '2026-01-15',
      member_number: 'SOC-2026-088',
    };

    service.createMember(payload).subscribe((res) => {
      expect(res.data.id).toBe('mem-88');
      expect(res.data.member_number).toBe('SOC-2026-088');
    });

    const req = httpTesting.expectOne(`${base}/associations/members`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ success: true, data: { id: 'mem-88', ...payload, status: 'active' } });
  });

  it('manages courses and enrolment', () => {
    const payload: AssociationCourseRequest = {
      name: 'Yoga Dinamico Principianti',
      discipline: 'Ginnastica Posturale',
      max_participants: 15,
      season: '2025/2026',
    };

    service.createCourse(payload).subscribe((res) => {
      expect(res.data.id).toBe('crs-1');
    });

    const reqCreate = httpTesting.expectOne(`${base}/associations/courses`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'crs-1', ...payload, status: 'active' } });

    service.enrolInCourse('crs-1', { member_id: 'mem-88' }).subscribe((res) => {
      expect(res.data.success).toBe(true);
    });

    const reqEnrol = httpTesting.expectOne(`${base}/associations/courses/crs-1/enrolments`);
    expect(reqEnrol.request.method).toBe('POST');
    reqEnrol.flush({ success: true, data: { success: true } });
  });

  it('registers a donation and generates receipt', () => {
    const payload: AssociationDonationRequest = {
      donor_name: 'Fondazione Benefica Ticino',
      amount: '5000.00',
      currency: 'CHF',
      donation_date: '2026-02-10',
      is_cash: false,
    };

    service.createDonation(payload).subscribe((res) => {
      expect(res.data.id).toBe('don-1');
    });

    const reqDon = httpTesting.expectOne(`${base}/associations/donations`);
    expect(reqDon.request.method).toBe('POST');
    reqDon.flush({ success: true, data: { id: 'don-1', ...payload } });

    service.generateDonationReceipt('don-1').subscribe((res) => {
      expect(res.data.receipt_number).toBe('RIC-DON-2026-01');
    });

    const reqRec = httpTesting.expectOne(`${base}/associations/donations/don-1/receipt`);
    expect(reqRec.request.method).toBe('POST');
    reqRec.flush({ success: true, data: { receipt_number: 'RIC-DON-2026-01' } });
  });

  it('manages volunteers and expense reimbursements', () => {
    service.getVolunteers(2026).subscribe((res) => {
      expect(res.data.length).toBe(1);
    });

    const reqVol = httpTesting.expectOne(`${base}/associations/volunteers/year/2026`);
    expect(reqVol.request.method).toBe('GET');
    reqVol.flush({
      success: true,
      data: [{ id: 'vol-1', member_id: 'mem-1', name: 'Mario Rossi', is_registered_in_runts_book: true }],
    });

    service
      .decideReimbursement('reimb-1', { approved: true })
      .subscribe((res) => {
        expect(res.data.status).toBe('approved');
      });

    const reqDec = httpTesting.expectOne(`${base}/associations/reimbursements/reimb-1/decision`);
    expect(reqDec.request.method).toBe('POST');
    reqDec.flush({ success: true, data: { id: 'reimb-1', status: 'approved' } });
  });
});
