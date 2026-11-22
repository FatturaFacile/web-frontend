import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpdeskSlaApiService, I18nService, TicketCustomerContext } from '@core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketCustomerContextComponent } from './ticket-customer-context.component';

const CONTEXT: TicketCustomerContext = {
  customer_id: 'c1',
  contracts: [
    {
      id: 'k1',
      name: 'Gold support',
      kind: 'prepaid_hours',
      included_hours: 10,
      consumed_hours: 4,
      remaining_hours: 6,
      end_date: '2027-12-31',
    },
    {
      id: 'k2',
      name: 'Maintenance',
      kind: 'flat_rate',
      included_hours: null,
      consumed_hours: null,
      remaining_hours: null,
      end_date: null,
    },
  ],
  assets: [{ id: 'a1', serial_number: 'SN-1', warranty_expiry_date: '2028-01-01' }],
  open_invoices: { count: 2, overdue_count: 1, total_gross: 350 },
  recent_tickets: [
    {
      id: 't9',
      ticket_number: '9',
      subject: 'Printer',
      status: 'closed',
      priority: 'low',
      created_at: '2027-01-01T00:00:00Z',
    },
  ],
};

describe('TicketCustomerContextComponent', () => {
  let fixture: ComponentFixture<TicketCustomerContextComponent>;
  const api = { getCustomerContext: vi.fn() };

  async function create(): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [TicketCustomerContextComponent],
      providers: [
        { provide: HelpdeskSlaApiService, useValue: api },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TicketCustomerContextComponent);
    fixture.componentRef.setInput('ticketId', 't1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCustomerContext.mockReturnValue(of({ data: CONTEXT }));
  });

  it('shows contracts, assets, invoices and recent tickets', async () => {
    const element = await create();

    expect(api.getCustomerContext).toHaveBeenCalledWith('t1');
    expect(element.querySelectorAll('[data-testid="ctx-contract"]').length).toBe(2);
    expect(element.querySelectorAll('[data-testid="ctx-asset"]').length).toBe(1);
    expect(element.querySelector('[data-testid="ctx-invoices"]')?.textContent).toContain(
      'HELPDESK_SLA.INVOICES_OVERDUE',
    );
    expect(element.querySelectorAll('[data-testid="ctx-ticket"]').length).toBe(1);
  });

  it('computes how much of a prepaid contract is used, capped at 100', async () => {
    await create();
    const component = fixture.componentInstance as unknown as {
      usedPercent(contract: unknown): number;
    };

    expect(component.usedPercent(CONTEXT.contracts[0])).toBe(40);
    expect(component.usedPercent({ included_hours: 2, consumed_hours: 5 })).toBe(100);
    expect(component.usedPercent(CONTEXT.contracts[1])).toBe(0);
  });

  it('reads the context again when the refresh token moves', async () => {
    await create();
    fixture.componentRef.setInput('refreshToken', 1);
    fixture.detectChanges();

    expect(api.getCustomerContext).toHaveBeenCalledTimes(2);
  });

  it('tells the agent when the context cannot be loaded', async () => {
    api.getCustomerContext.mockReturnValue(throwError(() => new Error('down')));
    const element = await create();

    expect(element.textContent).toContain('HELPDESK_SLA.CONTEXT_ERROR');
  });
});
