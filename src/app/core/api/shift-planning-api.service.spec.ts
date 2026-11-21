import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ShiftPlanningApiService } from './shift-planning-api.service';

describe('ShiftPlanningApiService', () => {
  let service: ShiftPlanningApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/shift-planning`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ShiftPlanningApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ShiftPlanningApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists the periods of a type that overlap a window', () => {
    service.getPeriods('weekly', '2026-03-02', '2026-03-08').subscribe();
    const request = httpTesting.expectOne((req) => req.url === `${base}/periods`);

    expect(request.request.params.get('period_type')).toBe('weekly');
    expect(request.request.params.get('from')).toBe('2026-03-02');
    request.flush({ data: [] });
  });

  it('loads the matrix grouped by role and publishes and locks a period', () => {
    service.getMatrix('p-1', 'role').subscribe();
    expect(
      httpTesting
        .expectOne((req) => req.url === `${base}/periods/p-1/matrix`)
        .request.params.get('group_by'),
    ).toBe('role');

    service.publishPeriod('p-1').subscribe();
    expect(httpTesting.expectOne(`${base}/periods/p-1/publish`).request.method).toBe('POST');

    service.lockPeriod('p-1').subscribe();
    expect(httpTesting.expectOne(`${base}/periods/p-1/lock`).request.method).toBe('POST');
  });

  it('creates a shift and moves one with a PATCH', () => {
    const payload = {
      roster_schedule_period_id: 'p-1',
      shift_date: '2026-03-02',
      shift_template_id: 't-1',
      employee_id: 'e-1',
    };

    service.createAssignment(payload).subscribe();
    const created = httpTesting.expectOne(`${base}/assignments`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);

    service.moveAssignment('a-1', payload).subscribe();
    expect(httpTesting.expectOne(`${base}/assignments/a-1`).request.method).toBe('PATCH');
  });

  it('decides a swap and reads the inbox and the employee views', () => {
    service.getSwaps('pending_manager_approval').subscribe();
    expect(
      httpTesting.expectOne((req) => req.url === `${base}/swaps`).request.params.get('status'),
    ).toBe('pending_manager_approval');

    service.decideSwap('s-1', { decision: 'reject', rejection_reason: 'No' }).subscribe();
    expect(httpTesting.expectOne(`${base}/swaps/s-1/decision`).request.body).toEqual({
      decision: 'reject',
      rejection_reason: 'No',
    });

    service.getMyShifts('2026-03-02').subscribe();
    httpTesting.expectOne((req) => req.url === `${base}/my/shifts`);
    service.getOpenShifts().subscribe();
    httpTesting.expectOne((req) => req.url === `${base}/my/open-shifts`);
    service.claimOpenShift('a-1').subscribe();
    expect(httpTesting.expectOne(`${base}/my/open-shifts/a-1/claim`).request.method).toBe('POST');
  });

  it('reads the team calendar and the colleagues eligible for a swap', () => {
    service.getTeamShifts('2026-03-02', '2026-03-29').subscribe();
    expect(
      httpTesting.expectOne((req) => req.url === `${base}/my/team-shifts`).request.params.get('to'),
    ).toBe('2026-03-29');

    service.getEligiblePeers('a-1').subscribe();
    expect(httpTesting.expectOne(`${base}/my/shifts/a-1/eligible-peers`).request.method).toBe(
      'GET',
    );
  });

  it('requests a swap and answers one as the colleague', () => {
    service.getMySwaps('pending_peer_acceptance').subscribe();
    expect(
      httpTesting.expectOne((req) => req.url === `${base}/my/swaps`).request.params.get('status'),
    ).toBe('pending_peer_acceptance');

    const payload = { shift_assignment_id: 'a-1', target_peer_employee_id: null };
    service.requestSwap(payload).subscribe();
    const created = httpTesting.expectOne(`${base}/my/swaps`);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual(payload);

    service.respondToSwap('s-1', 'reject').subscribe();
    expect(httpTesting.expectOne(`${base}/my/swaps/s-1/respond`).request.body).toEqual({
      decision: 'reject',
    });
  });

  it('writes the templates', () => {
    const payload = {
      code: 'MORN',
      name: { it: 'M', de: 'F', fr: 'M', en: 'Morning' },
      start_time: '06:00',
      end_time: '14:00',
    };

    service.getTemplates().subscribe();
    httpTesting.expectOne(`${base}/templates`);
    service.createTemplate(payload).subscribe();
    expect(httpTesting.expectOne(`${base}/templates`).request.method).toBe('POST');
    service.updateTemplate('t-1', payload).subscribe();
    expect(httpTesting.expectOne(`${base}/templates/t-1`).request.method).toBe('PUT');
  });
});
