import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HelpdeskSlaApiService } from './helpdesk-sla-api.service';

describe('HelpdeskSlaApiService', () => {
  let service: HelpdeskSlaApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/esm`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HelpdeskSlaApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the breach risk queue with the risk threshold and the limit', () => {
    service.getBreachRisk({ risk_percent: 75, limit: 100 }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${base}/helpdesk/breach-risk`);

    expect(request.request.params.get('risk_percent')).toBe('75');
    expect(request.request.params.get('limit')).toBe('100');
    request.flush({ data: [] });
  });

  it('reads the metrics of a period grouped by queue', () => {
    service.getMetrics({ from: '2027-01-01', to: '2027-01-31', group_by: 'queue' }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${base}/helpdesk/metrics`);

    expect(request.request.params.get('group_by')).toBe('queue');
    expect(request.request.params.get('from')).toBe('2027-01-01');
    request.flush({ data: { period: null, group_by: 'queue', totals: {}, groups: [] } });
  });

  it('reads the context, the escalations and the time entries of a ticket', () => {
    service.getCustomerContext('t1').subscribe();
    service.getEscalations('t1').subscribe();
    service.getTimeEntries('t1').subscribe();

    http.expectOne(`${base}/tickets/t1/customer-context`).flush({ data: {} });
    http.expectOne(`${base}/tickets/t1/escalations`).flush({ data: [] });
    http.expectOne(`${base}/tickets/t1/time-entries`).flush({ data: [] });
  });

  it('logs time on a ticket', () => {
    service.logTime('t1', { minutes: 45, is_billable: true }).subscribe();
    const request = http.expectOne(`${base}/tickets/t1/time-entries`);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ minutes: 45, is_billable: true });
    request.flush({ data: {} }, { status: 201, statusText: 'Created' });
  });

  it('tells a first field service hand-off (201) from a repeated one (200)', () => {
    const results: boolean[] = [];
    service
      .escalateToFieldService('t1', { work_type: 'repair' })
      .subscribe((result) => results.push(result.created));
    http
      .expectOne(`${base}/tickets/t1/escalate/field-service`)
      .flush({ data: { id: 'w1' } }, { status: 201, statusText: 'Created' });
    service.escalateToFieldService('t1').subscribe((result) => results.push(result.created));
    http.expectOne(`${base}/tickets/t1/escalate/field-service`).flush({ data: { id: 'w1' } });

    expect(results).toEqual([true, false]);
  });

  it('returns the tracking token of an RMA hand-off', () => {
    let token: string | undefined;
    service.escalateToRma('t1', { serial_number: 'SN1', goodwill: true }).subscribe((result) => {
      token = result.meta?.tracking_token;
    });
    http
      .expectOne(`${base}/tickets/t1/escalate/rma`)
      .flush(
        { data: { id: 'r1' }, meta: { tracking_token: 'abc' } },
        { status: 201, statusText: 'Created' },
      );

    expect(token).toBe('abc');
  });

  it('surfaces a 422 of the hand-off as an error', () => {
    let status = 0;
    service
      .escalateToRma('t1')
      .subscribe({ error: (err: { status: number }) => (status = err.status) });
    http
      .expectOne(`${base}/tickets/t1/escalate/rma`)
      .flush({ message: 'no unit' }, { status: 422, statusText: 'Unprocessable Entity' });

    expect(status).toBe(422);
  });

  it('manages the escalation chains', () => {
    const payload = {
      code: 'GOLD',
      name: 'Gold',
      steps: [{ target: 'response' as const, threshold_percent: 80, action: 'notify' as const }],
    };
    service.getEscalationChains().subscribe();
    service.createEscalationChain(payload).subscribe();
    service.updateEscalationChain('c1', payload).subscribe();
    service.deleteEscalationChain('c1').subscribe();

    http
      .expectOne({ method: 'GET', url: `${base}/helpdesk/escalation-chains` })
      .flush({ data: [] });
    http
      .expectOne({ method: 'POST', url: `${base}/helpdesk/escalation-chains` })
      .flush({ data: {} });
    http
      .expectOne({ method: 'PATCH', url: `${base}/helpdesk/escalation-chains/c1` })
      .flush({ data: {} });
    http
      .expectOne({ method: 'DELETE', url: `${base}/helpdesk/escalation-chains/c1` })
      .flush(null, { status: 204, statusText: 'No Content' });
  });

  it('saves the settings of an SLA policy', () => {
    service
      .updateSlaPolicySettings('p1', {
        escalation_chain_id: 'c1',
        next_update_interval_minutes: 60,
        pause_on_on_hold: true,
      })
      .subscribe();
    const request = http.expectOne({
      method: 'PUT',
      url: `${base}/helpdesk/sla-policies/p1/settings`,
    });

    expect(request.request.body).toEqual({
      escalation_chain_id: 'c1',
      next_update_interval_minutes: 60,
      pause_on_on_hold: true,
    });
    request.flush({ data: {} });
  });

  it('previews the holidays of a canton', () => {
    service.getHolidays({ country: 'CH', region: 'TI', year: 2027 }).subscribe();
    const request = http.expectOne((candidate) => candidate.url === `${base}/helpdesk/holidays`);

    expect(request.request.params.get('country')).toBe('CH');
    expect(request.request.params.get('region')).toBe('TI');
    expect(request.request.params.get('year')).toBe('2027');
    request.flush({ data: { country: 'CH', region: 'TI', year: 2027, dates: [] } });
  });
});
