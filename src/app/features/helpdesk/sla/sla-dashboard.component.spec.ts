import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpdeskSlaApiService, I18nService } from '@core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlaClock } from './sla-countdown';
import { SlaDashboardComponent } from './sla-dashboard.component';

const NOW = Date.parse('2027-03-01T10:00:00Z');

const TICKETS = [
  {
    ticket_id: 't1',
    ticket_number: '101',
    subject: 'Server down',
    priority: 'critical',
    status: 'open',
    customer_id: null,
    assigned_team_id: 'team-1',
    assigned_technician_id: null,
    risk_percent: 120,
    targets: [
      {
        target: 'response',
        due_at: '2027-03-01T09:00:00Z',
        elapsed_percent: 120,
        state: 'breached',
      },
    ],
  },
  {
    ticket_id: 't2',
    ticket_number: '102',
    subject: 'Slow VPN',
    priority: 'low',
    status: 'open',
    customer_id: null,
    assigned_team_id: 'team-2',
    assigned_technician_id: null,
    risk_percent: 80,
    targets: [
      {
        target: 'resolution',
        due_at: '2027-03-01T12:00:00Z',
        elapsed_percent: 80,
        state: 'at_risk',
      },
    ],
  },
];

describe('SlaDashboardComponent', () => {
  let fixture: ComponentFixture<SlaDashboardComponent>;
  const api = { getBreachRisk: vi.fn(), getMetrics: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getBreachRisk.mockReturnValue(of({ data: TICKETS }));
    api.getMetrics.mockReturnValue(
      of({ data: { period: null, group_by: 'queue', totals: {}, groups: [] } }),
    );
    await TestBed.configureTestingModule({
      imports: [SlaDashboardComponent],
      providers: [
        { provide: HelpdeskSlaApiService, useValue: api },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: SlaClock, useValue: { now: () => NOW } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SlaDashboardComponent);
    fixture.detectChanges();
  });

  it('loads the queue on open with the default risk threshold', () => {
    expect(api.getBreachRisk).toHaveBeenCalledWith({ risk_percent: 75, limit: 100 });
  });

  it('renders a row per ticket with the live countdown and a breach badge on the late one', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('tbody tr').length).toBe(2);
    expect(element.querySelectorAll('[data-testid="sla-breach-badge"]').length).toBe(1);
    expect(element.querySelector('[data-testid="breached-count"]')).not.toBeNull();
  });

  it('reloads with a higher threshold', () => {
    (
      fixture.componentInstance as unknown as { changeThreshold(percent: number): void }
    ).changeThreshold(90);

    expect(api.getBreachRisk).toHaveBeenLastCalledWith({ risk_percent: 90, limit: 100 });
  });

  it('emits the id of the ticket the agent opens', () => {
    const opened = vi.fn();
    fixture.componentInstance.openTicket.subscribe(opened);
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'tbody button',
    ) as HTMLButtonElement;

    button.click();

    expect(opened).toHaveBeenCalledWith('t1');
  });

  it('loads the metrics once, the first time that tab opens', () => {
    const component = fixture.componentInstance as unknown as { onTab(index: number): void };
    component.onTab(1);
    component.onTab(1);

    expect(api.getMetrics).toHaveBeenCalledTimes(1);
  });
});
