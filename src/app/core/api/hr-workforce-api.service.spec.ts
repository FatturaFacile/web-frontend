import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HrWorkforceApiService } from '@core';

const ok = { success: true, message: '', data: [] };
const one = { success: true, message: '', data: {} };

describe('HrWorkforceApiService', () => {
  let service: HrWorkforceApiService;
  let httpMock: HttpTestingController;
  const hr = `${environment.apiBaseUrl}/hr`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HrWorkforceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HrWorkforceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('goal cycles: list, create, update and close', () => {
    service.getGoalCycles().subscribe();
    httpMock.expectOne(`${hr}/goal-cycles`).flush(ok);
    service.createGoalCycle({ name: 'H1', starts_on: '2027-01-01', ends_on: '2027-06-30' }).subscribe();
    const post = httpMock.expectOne(`${hr}/goal-cycles`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.ends_on).toBe('2027-06-30');
    post.flush(one);
    service.updateGoalCycle('c1', { status: 'active' }).subscribe();
    const put = httpMock.expectOne(`${hr}/goal-cycles/c1`);
    expect(put.request.method).toBe('PUT');
    put.flush(one);
    service.closeGoalCycle('c1').subscribe();
    const close = httpMock.expectOne(`${hr}/goal-cycles/c1/close`);
    expect(close.request.method).toBe('POST');
    close.flush(one);
  });

  it('goals: filters, detail, create with key results, update and delete', () => {
    service.getGoals({ per_page: 20 }).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${hr}/goals`);
    expect(list.request.params.get('per_page')).toBe('20');
    list.flush(ok);
    service.getGoal('g1').subscribe();
    httpMock.expectOne(`${hr}/goals/g1`).flush(one);
    service
      .createGoal({
        goal_cycle_id: 'c1',
        level: 'employee',
        employee_id: 'e1',
        title: 'Ship',
        key_results: [{ metric: 'Releases', target_value: '2' }],
      })
      .subscribe();
    const post = httpMock.expectOne(`${hr}/goals`);
    expect(post.request.body.key_results[0].target_value).toBe('2');
    post.flush(one);
    service.updateGoal('g1', { title: 'Ship v2' }).subscribe();
    expect(httpMock.expectOne(`${hr}/goals/g1`).request.method).toBe('PUT');
    service.deleteGoal('g1').subscribe();
    const del = httpMock.expectOne(`${hr}/goals/g1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('key results, check-ins and the employee goal progress', () => {
    service.addKeyResult('g1', { metric: 'Bugs', target_value: '0', start_value: '10' }).subscribe();
    httpMock.expectOne(`${hr}/goals/g1/key-results`).flush(one);
    service.updateKeyResult('k1', { current_value: '5' }).subscribe();
    expect(httpMock.expectOne(`${hr}/goal-key-results/k1`).request.method).toBe('PUT');
    service.deleteKeyResult('k1').subscribe();
    httpMock.expectOne(`${hr}/goal-key-results/k1`).flush(null);
    service.getGoalCheckIns('g1').subscribe();
    httpMock.expectOne(`${hr}/goals/g1/check-ins`).flush(ok);
    service.checkInGoal('g1', { key_result_id: 'k1', value: '7', comment: 'ok' }).subscribe();
    const checkIn = httpMock.expectOne(`${hr}/goals/g1/check-ins`);
    expect(checkIn.request.method).toBe('POST');
    expect(checkIn.request.body).toEqual({ key_result_id: 'k1', value: '7', comment: 'ok' });
    checkIn.flush(one);
    service.getEmployeeGoalProgress('e1', 'c1').subscribe();
    const progress = httpMock.expectOne((r) => r.url === `${hr}/employees/e1/goal-progress`);
    expect(progress.request.params.get('goal_cycle_id')).toBe('c1');
    progress.flush(one);
    service.getTeams().subscribe();
    httpMock.expectOne(`${hr}/teams`).flush(ok);
  });

  it('offboarding: templates, checklists, tasks and exit interviews', () => {
    service.getOffboardingTemplates().subscribe();
    httpMock.expectOne(`${hr}/offboarding-templates`).flush(ok);
    service.createOffboardingTemplate({ name: 'Exit', tasks: [{ title: 'Return laptop', code: 'asset_return', due_after_days: 0 }] }).subscribe();
    const create = httpMock.expectOne(`${hr}/offboarding-templates`);
    expect(create.request.body.tasks[0].code).toBe('asset_return');
    create.flush(one);
    service.updateOffboardingTemplate('t1', { name: 'Exit 2' }).subscribe();
    expect(httpMock.expectOne(`${hr}/offboarding-templates/t1`).request.method).toBe('PUT');
    service.deleteOffboardingTemplate('t1').subscribe();
    httpMock.expectOne(`${hr}/offboarding-templates/t1`).flush(null);
    service.getOffboardingChecklists({ per_page: 10 }).subscribe();
    httpMock.expectOne((r) => r.url === `${hr}/offboarding-checklists`).flush(ok);
    service.getOffboardingChecklist('l1').subscribe();
    httpMock.expectOne(`${hr}/offboarding-checklists/l1`).flush(one);
    service.startOffboarding({ employee_id: 'e1', template_id: null }).subscribe();
    const start = httpMock.expectOne(`${hr}/offboarding-checklists`);
    expect(start.request.method).toBe('POST');
    start.flush(one);
    service.completeOffboardingTask('k1').subscribe();
    const task = httpMock.expectOne(`${hr}/offboarding-tasks/k1/complete`);
    expect(task.request.method).toBe('POST');
    task.flush(one);
    service.getExitReasonCodes().subscribe();
    httpMock.expectOne(`${hr}/exit-reason-codes`).flush(ok);
    service.getExitInterviews().subscribe();
    httpMock.expectOne(`${hr}/exit-interviews`).flush(ok);
    service.recordExitInterview({ employee_id: 'e1', conducted_on: '2026-12-12', reason_code: 'other' }).subscribe();
    const interview = httpMock.expectOne(`${hr}/exit-interviews`);
    expect(interview.request.body.reason_code).toBe('other');
    interview.flush(one);
  });

  it('analytics: each report with its query', () => {
    const query = { from: '2026-01-01', to: '2026-12-31', granularity: 'quarter' as const, as_of: '2026-11-06', days: 30 };
    const reports: [() => unknown, string][] = [
      [() => service.getHeadcountAnalytics(query).subscribe(), 'headcount'],
      [() => service.getTurnoverAnalytics(query).subscribe(), 'turnover'],
      [() => service.getTenureAnalytics(query).subscribe(), 'tenure'],
      [() => service.getAbsenteeismAnalytics(query).subscribe(), 'absenteeism'],
      [() => service.getPositionsAnalytics(query).subscribe(), 'positions'],
      [() => service.getUpcomingExpiries(query).subscribe(), 'upcoming-expiries'],
    ];
    for (const [call, report] of reports) {
      call();
      const request = httpMock.expectOne((r) => r.url === `${hr}/analytics/${report}`);
      expect(request.request.params.get('from')).toBe('2026-01-01');
      expect(request.request.params.get('granularity')).toBe('quarter');
      expect(request.request.params.get('days')).toBe('30');
      request.flush(one);
    }
    service.getHeadcountAnalytics().subscribe();
    const bare = httpMock.expectOne(`${hr}/analytics/headcount`);
    expect(bare.request.params.keys()).toEqual([]);
    bare.flush(one);
  });
});
