import { TestBed } from '@angular/core/testing';
import { BreachRiskTicket, HelpdeskSlaApiService } from '@core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BreachRiskStore } from './breach-risk.store';

function ticket(
  id: string,
  priority: BreachRiskTicket['priority'],
  team: string | null,
  state: 'at_risk' | 'breached',
): BreachRiskTicket {
  return {
    ticket_id: id,
    ticket_number: id.toUpperCase(),
    subject: `Subject ${id}`,
    priority,
    status: 'open',
    customer_id: null,
    assigned_team_id: team,
    assigned_technician_id: null,
    risk_percent: state === 'breached' ? 120 : 80,
    targets: [{ target: 'response', due_at: '2027-03-01T12:00:00Z', elapsed_percent: 80, state }],
  };
}

describe('BreachRiskStore', () => {
  const api = { getBreachRisk: vi.fn(), getMetrics: vi.fn() };
  let store: InstanceType<typeof BreachRiskStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    api.getBreachRisk.mockReturnValue(
      of({
        data: [
          ticket('a', 'high', 'team-1', 'breached'),
          ticket('b', 'low', 'team-2', 'at_risk'),
          ticket('c', 'high', null, 'at_risk'),
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [BreachRiskStore, { provide: HelpdeskSlaApiService, useValue: api }],
    });
    store = TestBed.inject(BreachRiskStore);
  });

  it('loads the queue with the chosen risk threshold', () => {
    store.setFilters({ riskPercent: 90 });
    store.load().subscribe();

    expect(api.getBreachRisk).toHaveBeenCalledWith({ risk_percent: 90, limit: 100 });
    expect(store.tickets().length).toBe(3);
    expect(store.loading()).toBe(false);
  });

  it('counts the tickets that already breached a target', () => {
    store.load().subscribe();

    expect(store.breachedCount()).toBe(1);
  });

  it('filters by priority, status and queue', () => {
    store.load().subscribe();

    store.setFilters({ priorityFilter: 'high' });
    expect(store.visible().map((item) => item.ticket_id)).toEqual(['a', 'c']);

    store.setFilters({ queueFilter: 'team-1' });
    expect(store.visible().map((item) => item.ticket_id)).toEqual(['a']);

    store.setFilters({ statusFilter: 'closed' });
    expect(store.visible()).toEqual([]);
  });

  it('lists the queues present in the loaded tickets', () => {
    store.load().subscribe();

    expect(store.queues()).toEqual(['team-1', 'team-2']);
  });

  it('flags a failed load and empties the queue', () => {
    api.getBreachRisk.mockReturnValue(throwError(() => new Error('down')));
    store.load().subscribe();

    expect(store.failed()).toBe(true);
    expect(store.tickets()).toEqual([]);
  });

  it('loads the metrics grouped as asked and remembers the grouping', () => {
    api.getMetrics.mockReturnValue(
      of({ data: { period: null, group_by: 'priority', totals: {}, groups: [] } }),
    );
    store.loadMetrics({ group_by: 'priority', from: '2027-01-01' }).subscribe();

    expect(api.getMetrics).toHaveBeenCalledWith({ group_by: 'priority', from: '2027-01-01' });
    expect(store.metricsGroupBy()).toBe('priority');
    expect(store.metrics()?.group_by).toBe('priority');
  });

  it('flags failed metrics', () => {
    api.getMetrics.mockReturnValue(throwError(() => new Error('down')));
    store.loadMetrics().subscribe();

    expect(store.metricsFailed()).toBe(true);
    expect(store.metrics()).toBeNull();
  });
});
