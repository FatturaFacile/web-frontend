import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  CrmApiService,
  HrApiService,
  HrEmployeeApiService,
  HrSelfServiceApiService,
  HrTimeApiService,
  IntrastatApiService,
  InvoiceApiService,
  PayrollApiService,
} from '@core';

const ok = { success: true, message: '', data: {} };

describe('Payroll and HR service extensions', () => {
  let httpMock: HttpTestingController;
  const api = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('PayrollApiService', () => {
    it('delivers the payslips and creates the payment batches of a run', () => {
      const service = TestBed.inject(PayrollApiService);
      service.deliverPayslips('run1').subscribe();
      const deliver = httpMock.expectOne(`${api}/payroll/runs/run1/deliver-payslips`);
      expect(deliver.request.method).toBe('POST');
      deliver.flush({ ...ok, data: { sent: 2, skipped: [] } });

      service.createPaymentBatches('run1', [{ bank_account_id: 'b1', employee_ids: ['e1'] }]).subscribe();
      const batches = httpMock.expectOne(`${api}/payroll/runs/run1/payment-batches`);
      expect(batches.request.method).toBe('POST');
      expect(batches.request.body).toEqual({ allocations: [{ bank_account_id: 'b1', employee_ids: ['e1'] }] });
      batches.flush({ ...ok, data: [] });
    });
  });

  describe('HrTimeApiService', () => {
    it('transfers a closed month to payroll', () => {
      TestBed.inject(HrTimeApiService).transferToPayroll(2026, 3).subscribe();
      const req = httpMock.expectOne(`${api}/hr/time-closings/2026/3/transfer-to-payroll`);
      expect(req.request.method).toBe('POST');
      req.flush(ok);
    });

    it('manages schedule groups, rules, members and badges', () => {
      const service = TestBed.inject(HrTimeApiService);
      service.getScheduleGroups().subscribe();
      httpMock.expectOne(`${api}/hr/schedule-groups`).flush({ ...ok, data: [] });

      service.createScheduleGroup({ name: 'Turni', is_active: true }).subscribe();
      const create = httpMock.expectOne(`${api}/hr/schedule-groups`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual({ name: 'Turni', is_active: true });
      create.flush(ok);

      service.addScheduleGroupRules('g1', { valid_from: '2026-01-01', rounding_mode: 'nearest', rounding_minutes: 5 }).subscribe();
      const rules = httpMock.expectOne(`${api}/hr/schedule-groups/g1/rules`);
      expect(rules.request.body.rounding_mode).toBe('nearest');
      rules.flush(ok);

      service.addScheduleGroupMember('g1', { employee_id: 'e1', valid_from: '2026-01-01' }).subscribe();
      httpMock.expectOne(`${api}/hr/schedule-groups/g1/members`).flush(ok);

      service.registerBadge({ employee_id: 'e1', badge_code: 'B-1' }).subscribe();
      const badge = httpMock.expectOne(`${api}/hr/time-badges`);
      expect(badge.request.body).toEqual({ employee_id: 'e1', badge_code: 'B-1' });
      badge.flush(ok);
    });

    it('reads presence, the payroll view and the night work balances', () => {
      const service = TestBed.inject(HrTimeApiService);
      service.getPresence().subscribe();
      httpMock.expectOne(`${api}/hr/time/presence`).flush({ ...ok, data: [] });

      service.getPayrollView({ employee_id: 'e1', from: '2026-03-01', to: '2026-03-31' }).subscribe();
      const view = httpMock.expectOne((r) => r.url === `${api}/hr/time/payroll-view`);
      expect(view.request.params.get('employee_id')).toBe('e1');
      expect(view.request.params.get('to')).toBe('2026-03-31');
      view.flush(ok);

      service.getNightWorkBalances({ year: 2026, user_id: 'u1' }).subscribe();
      const night = httpMock.expectOne((r) => r.url === `${api}/hr/time/night-work-balances`);
      expect(night.request.params.get('year')).toBe('2026');
      expect(night.request.params.get('user_id')).toBe('u1');
      night.flush({ ...ok, data: [] });
    });

    it('imports punches and books meals', () => {
      const service = TestBed.inject(HrTimeApiService);
      service
        .importPunches({
          reader_id: 'R1',
          source: 'terminal',
          punches: [{ external_id: 'x1', badge_code: 'B-1', occurred_at: '2026-03-01T08:00:00Z', punch_type: 'In' }],
        })
        .subscribe();
      const punches = httpMock.expectOne(`${api}/hr/time/punches/import`);
      expect(punches.request.method).toBe('POST');
      expect(punches.request.body.punches.length).toBe(1);
      punches.flush({ ...ok, data: { accepted: 1, duplicates: 0, rejected: [] } });

      service.getMealBookings({ from: '2026-03-01', to: '2026-03-31' }).subscribe();
      const list = httpMock.expectOne((r) => r.url === `${api}/hr/time/meal-bookings`);
      expect(list.request.params.get('from')).toBe('2026-03-01');
      list.flush({ ...ok, data: [] });

      service.bookMeal({ meal_type: 'lunch', source: 'web' }).subscribe();
      const book = httpMock.expectOne(`${api}/hr/time/meal-bookings`);
      expect(book.request.method).toBe('POST');
      expect(book.request.body).toEqual({ meal_type: 'lunch', source: 'web' });
      book.flush(ok);
    });
  });

  describe('HR people services', () => {
    it('reads the cross-border employees and withholding parameters', () => {
      const service = TestBed.inject(HrApiService);
      service.getCrossBorderEmployees().subscribe();
      httpMock.expectOne(`${api}/hr/frontalieri`).flush({ ...ok, data: [] });
      service.getWithholdingTaxParameters().subscribe();
      httpMock.expectOne(`${api}/hr/withholding-taxes`).flush(ok);
    });

    it('assigns a position successor and generates the payroll forecast', () => {
      const service = TestBed.inject(HrEmployeeApiService);
      service.assignPositionSuccessor('p1', { successor_employee_id: 'e2', readiness_level: 'ready_now' }).subscribe();
      const patch = httpMock.expectOne(`${api}/hr/positions/p1/successor`);
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toEqual({ successor_employee_id: 'e2', readiness_level: 'ready_now' });
      patch.flush(ok);

      service.generatePayrollForecast('2026-11').subscribe();
      const forecast = httpMock.expectOne(`${api}/hr/payroll-forecast`);
      expect(forecast.request.method).toBe('POST');
      expect(forecast.request.body).toEqual({ period_code: '2026-11' });
      forecast.flush(ok);

      service.generatePayrollForecast().subscribe();
      expect(httpMock.expectOne(`${api}/hr/payroll-forecast`).request.body).toEqual({});
    });

    it('reads the leave types of the employee portal', () => {
      TestBed.inject(HrSelfServiceApiService).getLeaveTypes().subscribe();
      const req = httpMock.expectOne(`${api}/hr/me/leave-types`);
      expect(req.request.method).toBe('GET');
      req.flush({ ...ok, data: [] });
    });
  });

  describe('Other areas', () => {
    it('reads the Intrastat code lists', () => {
      TestBed.inject(IntrastatApiService).getCodes().subscribe();
      const req = httpMock.expectOne(`${api}/intrastat/codes`);
      expect(req.request.method).toBe('GET');
      req.flush(ok);
    });

    it('explains the score of a lead', () => {
      TestBed.inject(CrmApiService).getLeadScore('l1').subscribe((res) => expect(res.current.rating).toBe('hot'));
      const req = httpMock.expectOne(`${api}/crm/leads/l1/score`);
      expect(req.request.method).toBe('GET');
      req.flush({ lead_id: 'l1', score: 40, rating: 'warm', model: null, breakdown: [], calculated_at: null, current: { score: 80, rating: 'hot', model: 'default', breakdown: [] } });
    });

    it('reads the e-mail history of a document', () => {
      TestBed.inject(InvoiceApiService).getDocumentEmails('quote', 'q1').subscribe();
      const req = httpMock.expectOne(`${api}/documents/quote/q1/emails`);
      expect(req.request.method).toBe('GET');
      req.flush({ ...ok, data: [] });
    });
  });
});
