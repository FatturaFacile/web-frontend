import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LeaveManagementApiService } from './leave-management-api.service';

describe('LeaveManagementApiService', () => {
  const base = `${environment.apiBaseUrl}/leave-management`;
  let api: LeaveManagementApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LeaveManagementApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests official CH/IT holiday catalog and tenant holiday calendars', () => {
    api.getHolidayCatalog({ country: 'CH', year: 2026, canton_or_province_code: 'TI' }).subscribe();
    const catReq = http.expectOne((r) => r.url === `${base}/holidays/catalog`);
    expect(catReq.request.params.get('canton_or_province_code')).toBe('TI');
    catReq.flush({
      success: true,
      message: '',
      data: { country: 'CH', year: 2026, cantons: [], italian_patron_saints: {}, holidays: [] },
    });

    api.getHolidayCalendars({ country: 'IT', year: 2026 }).subscribe();
    http
      .expectOne((r) => r.url === `${base}/holiday-calendars`)
      .flush({ success: true, message: '', data: [] });
  });

  it('submits standard requests, INPS PUC sick leave, and approval decisions', () => {
    api
      .submitRequest({
        employee_id: 'emp-1',
        country: 'CH',
        leave_type: 'AnnualVacation_Ferie_Ferien',
        start_date: '2026-07-01',
        end_date: '2026-07-05',
      })
      .subscribe();
    expect(http.expectOne(`${base}/requests`).request.method).toBe('POST');

    api
      .registerSickInps({
        employee_id: 'emp-2',
        country: 'IT',
        leave_type: 'SickLeave_Malattia',
        start_date: '2026-03-01',
        end_date: '2026-03-10',
        inps_medical_certificate_protocol_number: 'PUC123456',
      })
      .subscribe();
    expect(http.expectOne(`${base}/requests/sick-inps`).request.method).toBe('POST');

    api.approveRequest('req-1').subscribe();
    expect(http.expectOne(`${base}/requests/req-1/approve`).request.method).toBe('POST');
  });

  it('loads department Gantt calendar, staffing thresholds, and comporto evaluation', () => {
    api.getDepartmentCalendar({ from: '2026-06-01', to: '2026-06-30', country: 'CH' }).subscribe();
    http
      .expectOne((r) => r.url === `${base}/department-calendar`)
      .flush({ success: true, message: '', data: {} });

    api
      .upsertStaffingThreshold('dept-1', {
        min_present_count: 2,
        min_present_percent: 50,
        enforce_hard_block: true,
      })
      .subscribe();
    expect(http.expectOne(`${base}/staffing-thresholds/dept-1`).request.method).toBe('PUT');

    api
      .evaluateComportoOrCurtailment({ employee_id: 'emp-1', fiscal_year: 2026, country: 'CH' })
      .subscribe();
    http
      .expectOne((r) => r.url === `${base}/comporto-curtailment`)
      .flush({ success: true, message: '', data: {} });
  });
});
