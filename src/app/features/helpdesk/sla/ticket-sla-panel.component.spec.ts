import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HelpdeskSlaApiService,
  I18nService,
  TicketEscalationLogEntry,
  TicketResource,
} from '@core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SlaClock } from './sla-countdown';
import { TicketSlaPanelComponent } from './ticket-sla-panel.component';

const ENTRY: TicketEscalationLogEntry = {
  id: 'x1',
  chain_id: 'c1',
  step_id: 's1',
  target: 'resolution',
  threshold_percent: 80,
  elapsed_percent: 83,
  action: 'raise_priority',
  outcome: 'priority raised to high',
  fired_at: '2027-03-01T09:00:00Z',
};

describe('TicketSlaPanelComponent', () => {
  let fixture: ComponentFixture<TicketSlaPanelComponent>;
  const api = { getEscalations: vi.fn() };

  async function create(ticket: Partial<TicketResource>): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [TicketSlaPanelComponent],
      providers: [
        { provide: HelpdeskSlaApiService, useValue: api },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: SlaClock, useValue: { now: () => Date.parse('2027-03-01T10:00:00Z') } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TicketSlaPanelComponent);
    fixture.componentRef.setInput('ticket', {
      id: 't1',
      sla_state: 'warning',
      escalation_level: 0,
      first_responded_at: null,
      response_due_at: '2027-03-01T11:00:00Z',
      resolved_at: null,
      resolution_due_at: '2027-03-02T10:00:00Z',
      ...ticket,
    });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getEscalations.mockReturnValue(of({ data: [ENTRY] }));
  });

  it('shows the SLA state and the countdown of both targets', async () => {
    const element = await create({});

    expect(element.querySelector('[data-testid="sla-state"]')?.textContent).toContain(
      'HELPDESK_SLA.STATE_WARNING',
    );
    expect(element.querySelectorAll('app-sla-countdown').length).toBe(2);
  });

  it('replaces the countdown of a target that was met by the date it was met', async () => {
    const element = await create({ first_responded_at: '2027-03-01T09:30:00Z' });

    expect(element.querySelectorAll('app-sla-countdown').length).toBe(1);
    expect(element.textContent).toContain('HELPDESK_SLA.DONE_AT');
  });

  it('lists the escalation steps that fired', async () => {
    const element = await create({ escalation_level: 1 });

    expect(api.getEscalations).toHaveBeenCalledWith('t1');
    expect(element.textContent).toContain('HELPDESK_SLA.ACTION_RAISE_PRIORITY');
    expect(element.textContent).toContain('priority raised to high');
    expect(element.textContent).toContain('HELPDESK_SLA.ESCALATION_LEVEL');
  });

  it('says so when nothing escalated', async () => {
    api.getEscalations.mockReturnValue(of({ data: [] }));
    const element = await create({});

    expect(element.textContent).toContain('HELPDESK_SLA.NO_ESCALATIONS');
  });
});
