import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  ChildcareAttendance,
  ChildcareBill,
  ChildcareChild,
  ChildcareDailyNote,
  PaginatedResponse,
} from '../models';
import { ChildcareApiService } from './childcare-api.service';

describe('ChildcareApiService', () => {
  let service: ChildcareApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/childcare`;

  const mockChild: ChildcareChild = {
    id: 'ch-1-uuid',
    group_id: 'grp-1',
    billing_contact_id: 'parent-1',
    first_name: 'Sofia',
    last_name: 'Bianchi',
    birth_date: '2023-05-12',
    enrolled_on: '2024-09-01',
    status: 'active',
  };

  const mockAttendance: ChildcareAttendance = {
    id: 'att-1-uuid',
    child_id: 'ch-1-uuid',
    date: '2026-03-02',
    status: 'present',
    check_in_at: '2026-03-02T08:15:00Z',
    temperature: '36.5',
  };

  const mockDailyNote: ChildcareDailyNote = {
    id: 'note-1-uuid',
    child_id: 'ch-1-uuid',
    date: '2026-03-02',
    category: 'sleep',
    body: 'Ha dormito 1h e 30m senza risvegli',
    visible_to_family: true,
  };

  const mockBill: ChildcareBill = {
    id: 'bill-1-uuid',
    child_id: 'ch-1-uuid',
    contact_id: 'parent-1',
    period: '2026-03',
    gross_amount: '650.00',
    subsidy_amount: '150.00',
    net_amount: '500.00',
    currency: 'EUR',
    status: 'issued',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ChildcareApiService,
      ],
    });

    service = TestBed.inject(ChildcareApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('should fetch children list with pagination', () => {
    const mockResponse: PaginatedResponse<ChildcareChild> = {
      success: true,
      message: '',
      data: [mockChild],
      meta: { current_page: 1, from: 1, last_page: 1, per_page: 10, to: 1, total: 1 },
    };

    service.getChildren({ page: 1, per_page: 10, status: 'active' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].first_name).toBe('Sofia');
    });

    const req = httpTesting.expectOne((r) => r.url.includes(`${baseUrl}/children`));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('active');
    req.flush(mockResponse);
  });

  it('should enrol a new child', () => {
    service
      .enrolChild({
        first_name: 'Sofia',
        last_name: 'Bianchi',
        billing_contact_id: 'parent-1',
        enrolled_on: '2024-09-01',
      })
      .subscribe((res) => {
        expect(res.data.id).toBe('ch-1-uuid');
      });

    const req = httpTesting.expectOne(`${baseUrl}/children`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.first_name).toBe('Sofia');
    req.flush({ data: mockChild });
  });

  it('should register check-in and check-out attendances', () => {
    service
      .checkIn({ child_id: 'ch-1-uuid', temperature: '36.5' })
      .subscribe((res) => {
        expect(res.data.status).toBe('present');
      });

    const reqIn = httpTesting.expectOne(`${baseUrl}/attendances/check-in`);
    expect(reqIn.request.method).toBe('POST');
    reqIn.flush({ data: mockAttendance });

    service
      .checkOut({ child_id: 'ch-1-uuid', picked_up_by: 'Madre' })
      .subscribe((res) => {
        expect(res.data.id).toBe('att-1-uuid');
      });

    const reqOut = httpTesting.expectOne(`${baseUrl}/attendances/check-out`);
    expect(reqOut.request.method).toBe('POST');
    reqOut.flush({ data: { ...mockAttendance, check_out_at: '2026-03-02T16:30:00Z', picked_up_by: 'Madre' } });
  });

  it('should create daily note and fetch daily report', () => {
    service
      .createNote({
        child_id: 'ch-1-uuid',
        date: '2026-03-02',
        category: 'sleep',
        body: 'Ha dormito 1h e 30m',
        visible_to_family: true,
      })
      .subscribe((res) => {
        expect(res.data.category).toBe('sleep');
      });

    const reqNote = httpTesting.expectOne(`${baseUrl}/notes`);
    expect(reqNote.request.method).toBe('POST');
    reqNote.flush({ data: mockDailyNote });

    service.getDailyReport('ch-1-uuid', '2026-03-02').subscribe((res) => {
      expect(res.data.notes.length).toBe(1);
    });

    const reqRep = httpTesting.expectOne((r) => r.url.includes(`${baseUrl}/children/ch-1-uuid/daily-report`));
    expect(reqRep.request.method).toBe('GET');
    reqRep.flush({ data: { notes: [mockDailyNote], attendances: [mockAttendance] } });
  });

  it('should run monthly billing and fetch bills', () => {
    service.runBilling({ period: '2026-03', date: '2026-03-31' }).subscribe((res) => {
      expect(res.data.run_id).toBe('run-1');
      expect(res.data.total_billed).toBe('12500.00');
    });

    const reqRun = httpTesting.expectOne(`${baseUrl}/billing/runs`);
    expect(reqRun.request.method).toBe('POST');
    reqRun.flush({ data: { run_id: 'run-1', total_billed: '12500.00' } });

    service.getBills({ period: '2026-03' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].net_amount).toBe('500.00');
    });

    const reqBills = httpTesting.expectOne((r) => r.url.includes(`${baseUrl}/billing/bills`));
    expect(reqBills.request.method).toBe('GET');
    reqBills.flush({ data: [mockBill] });
  });

  it('should read the reference persons from the child resource', () => {
    service.getReferencePersons('ch-1-uuid').subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].full_name).toBe('Anna Rossi');
    });

    const req = httpTesting.expectOne(`${baseUrl}/children/ch-1-uuid`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { ...mockChild, reference_persons: [{ id: 'rp-1', full_name: 'Anna Rossi' }] },
    });
  });

  it('should correct an attendance with PUT and read its correction history with GET', () => {
    service.correctAttendance('att-1-uuid', { reason: 'Orario errato', check_in_at: '2026-03-02T08:00:00Z' }).subscribe();

    const reqPut = httpTesting.expectOne(`${baseUrl}/attendances/att-1-uuid`);
    expect(reqPut.request.method).toBe('PUT');
    expect(reqPut.request.body.reason).toBe('Orario errato');
    reqPut.flush({ data: mockAttendance });

    service.getAttendanceCorrections('att-1-uuid').subscribe((res) => {
      expect(res.data[0].field).toBe('check_in_at');
    });

    const reqGet = httpTesting.expectOne(`${baseUrl}/attendances/att-1-uuid/corrections`);
    expect(reqGet.request.method).toBe('GET');
    reqGet.flush({ data: [{ id: 'c-1', attendance_id: 'att-1-uuid', field: 'check_in_at', reason: 'Orario errato' }] });
  });

  it('should record a staff shift with POST and read staff hours per month with GET', () => {
    service
      .createStaffShift({ user_id: 'u-1', date: '2026-03-02', starts_at: '08:00', ends_at: '16:00' })
      .subscribe();

    const reqPost = httpTesting.expectOne(`${baseUrl}/staff-shifts`);
    expect(reqPost.request.method).toBe('POST');
    expect(reqPost.request.body.starts_at).toBe('08:00');
    reqPost.flush({ data: {} });

    service.getStaffHours({ month: '2026-03' }).subscribe((res) => {
      expect(res.data[0].minutes).toBe(480);
    });

    const reqGet = httpTesting.expectOne((r) => r.url === `${baseUrl}/staff-hours`);
    expect(reqGet.request.method).toBe('GET');
    expect(reqGet.request.params.get('month')).toBe('2026-03');
    reqGet.flush({ data: [{ user_id: 'u-1', name: 'Luisa', shifts: 1, minutes: 480 }] });
  });
});
