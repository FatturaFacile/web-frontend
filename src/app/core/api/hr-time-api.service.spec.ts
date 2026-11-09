import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HrApiService, HrLeaveApiService, HrTimeApiService } from '@core';

const ok = { success: true, message: '', data: [] };
const one = { success: true, message: '', data: {} };

describe('HrTimeApiService', () => {
  let service: HrTimeApiService;
  let httpMock: HttpTestingController;
  const hr = `${environment.apiBaseUrl}/hr`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HrTimeApiService, HrLeaveApiService, HrApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HrTimeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists events with filters and manages them with a reason', () => {
    service.getEvents({ from: '2026-11-01', include_deleted: true, per_page: 50 }).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${hr}/time/events`);
    expect(list.request.params.get('from')).toBe('2026-11-01');
    expect(list.request.params.get('include_deleted')).toBe('true');
    list.flush({ ...ok, meta: {} });

    service.createEvent({ event_type: 'In', source: 'manual', reason: 'forgot' }).subscribe();
    const post = httpMock.expectOne(`${hr}/time/events`);
    expect(post.request.method).toBe('POST');
    post.flush(one);

    service.updateEvent('ev1', { note: 'x', reason: 'fix' }).subscribe();
    const patch = httpMock.expectOne(`${hr}/time/events/ev1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ note: 'x', reason: 'fix' });
    patch.flush(one);

    service.deleteEvent('ev1', 'duplicate').subscribe();
    const del = httpMock.expectOne((r) => r.url === `${hr}/time/events/ev1`);
    expect(del.request.method).toBe('DELETE');
    expect(del.request.params.get('reason')).toBe('duplicate');
    del.flush(one);
  });

  it('maps a 409 on a closed month', () => {
    let status = 0;
    service.updateEvent('ev1', { reason: 'fix' }).subscribe({ error: (e) => (status = e.status) });
    httpMock.expectOne(`${hr}/time/events/ev1`).flush({ message: 'closed' }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });

  it('saves daily records, reads report, audit, holidays, overtime and profile', () => {
    service.saveDailyRecord({ date: '2026-11-02', worked_minutes: 480 }).subscribe();
    const put = httpMock.expectOne(`${hr}/time/daily-records`);
    expect(put.request.method).toBe('PUT');
    put.flush(one);

    service.getReport({ from: '2026-11-01', to: '2026-11-30' }).subscribe();
    httpMock.expectOne((r) => r.url === `${hr}/time/report`).flush(one);
    service.getAudit({ per_page: 20 }).subscribe();
    httpMock.expectOne((r) => r.url === `${hr}/time/audit`).flush({ ...ok, meta: {} });
    service.getHolidays({ canton: 'TI', year: 2026 }).subscribe();
    const hol = httpMock.expectOne((r) => r.url === `${hr}/time/holidays`);
    expect(hol.request.params.get('canton')).toBe('TI');
    hol.flush(ok);
    service.getOvertime({ from: '2026-11-01', to: '2026-11-30' }).subscribe();
    httpMock.expectOne((r) => r.url === `${hr}/time/overtime`).flush(one);
    service.getProfile('u1').subscribe();
    httpMock.expectOne(`${hr}/time/profiles/u1`).flush(one);
    service
      .saveProfile('u1', { mode: 'Detailed', legal_max_weekly_hours: '45', weekly_hours: '42.00', work_days_per_week: 5 })
      .subscribe();
    const profile = httpMock.expectOne(`${hr}/time/profiles/u1`);
    expect(profile.request.method).toBe('PUT');
    expect(profile.request.body.weekly_hours).toBe('42.00');
    profile.flush(one);
  });

  it('overtime rules CRUD and monthly closings', () => {
    service.getOvertimeRules().subscribe();
    httpMock.expectOne(`${hr}/overtime-rules`).flush(ok);
    const rule = { code: 'D', name: 'Daily', basis: 'daily' as const, threshold_minutes: 480, premium_percent: '25.00' };
    service.createOvertimeRule(rule).subscribe();
    const post = httpMock.expectOne(`${hr}/overtime-rules`);
    expect(post.request.body.premium_percent).toBe('25.00');
    post.flush(one);
    service.updateOvertimeRule('r1', rule).subscribe();
    const put = httpMock.expectOne(`${hr}/overtime-rules/r1`);
    expect(put.request.method).toBe('PUT');
    put.flush(one);
    service.deleteOvertimeRule('r1').subscribe();
    httpMock.expectOne(`${hr}/overtime-rules/r1`).flush(null, { status: 204, statusText: 'No Content' });

    service.getTimeClosings(2026).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${hr}/time-closings`);
    expect(list.request.params.get('year')).toBe('2026');
    list.flush(ok);
    service.closeMonth(2026, 10).subscribe();
    const close = httpMock.expectOne(`${hr}/time-closings`);
    expect(close.request.body).toEqual({ year: 2026, month: 10 });
    close.flush(one);
    service.reopenMonth('c1', 'correction').subscribe();
    const reopen = httpMock.expectOne(`${hr}/time-closings/c1/reopen`);
    expect(reopen.request.body).toEqual({ reason: 'correction' });
    reopen.flush(one);
  });

  it('cancels an HR leave request with a reason and maps the 409 of a running workflow', () => {
    const hrApi = TestBed.inject(HrApiService);
    let status = 0;
    hrApi.cancelLeaveRequest('l1', 'changed').subscribe();
    const cancel = httpMock.expectOne(`${hr}/leave-requests/l1/cancel`);
    expect(cancel.request.body).toEqual({ reason: 'changed' });
    cancel.flush(one);
    hrApi.approveLeaveRequest('l2').subscribe({ error: (e) => (status = e.status) });
    httpMock
      .expectOne(`${hr}/leave-requests/l2/approve`)
      .flush({ message: 'workflow running' }, { status: 409, statusText: 'Conflict' });
    expect(status).toBe(409);
  });

  it('leave policies, balances, accrual and calendar', () => {
    const leave = TestBed.inject(HrLeaveApiService);
    leave.getAccrualPolicies().subscribe();
    httpMock.expectOne(`${hr}/leave-accrual-policies`).flush(ok);
    const policy = {
      leave_type_id: 't1',
      code: 'P',
      name: 'Policy',
      annual_entitlement_hours: '208.00',
      valid_from: '2026-01-01',
    };
    leave.createAccrualPolicy(policy).subscribe();
    httpMock.expectOne(`${hr}/leave-accrual-policies`).flush(one);
    leave.updateAccrualPolicy('p1', policy).subscribe();
    const put = httpMock.expectOne(`${hr}/leave-accrual-policies/p1`);
    expect(put.request.method).toBe('PUT');
    put.flush(one);
    leave.deleteAccrualPolicy('p1').subscribe();
    httpMock.expectOne(`${hr}/leave-accrual-policies/p1`).flush(null, { status: 204, statusText: 'No Content' });

    leave.getLeaveBalances('e1').subscribe();
    const bal = httpMock.expectOne((r) => r.url === `${hr}/leave-balances`);
    expect(bal.request.params.get('employee_id')).toBe('e1');
    bal.flush(ok);
    leave.accrueLeaveBalances(3).subscribe();
    const accrue = httpMock.expectOne(`${hr}/leave-balances/accrue`);
    expect(accrue.request.body).toEqual({ month: 3 });
    accrue.flush({ success: true, message: '', data: { balances_accrued: 4 } });
    leave.accrueLeaveBalances().subscribe();
    expect(httpMock.expectOne(`${hr}/leave-balances/accrue`).request.body).toEqual({});

    leave.getLeaveCalendar({ from: '2026-11-01', to: '2026-11-30', department_id: 'd1' }).subscribe();
    const cal = httpMock.expectOne((r) => r.url === `${hr}/leave-calendar`);
    expect(cal.request.params.get('department_id')).toBe('d1');
    cal.flush(ok);
  });
});
