import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpdeskSlaApiService, I18nService, SettingsApiService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketTimeLogComponent } from './ticket-time-log.component';

interface Harness {
  form: { patchValue(value: Record<string, unknown>): void };
  submit(): void;
  result(): { billing_status: string; billable_hours: number } | null;
  entries(): unknown[];
  closeDrawer(): void;
}

describe('TicketTimeLogComponent', () => {
  let fixture: ComponentFixture<TicketTimeLogComponent>;
  let harness: Harness;

  const api = { getTimeEntries: vi.fn(), logTime: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const entry = {
    id: 'e1',
    hours: 1.5,
    minutes: 90,
    billing_status: 'partially_deducted',
    contract_hours: 1,
    billable_hours: 0.5,
    service_contract_id: 'c1',
    total_charge: 60,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getTimeEntries.mockReturnValue(of({ data: [] }));
    api.logTime.mockReturnValue(of({ data: entry }));
    await TestBed.configureTestingModule({
      imports: [TicketTimeLogComponent],
      providers: [
        { provide: HelpdeskSlaApiService, useValue: api },
        {
          provide: SettingsApiService,
          useValue: { getTenantUsers: () => of({ data: [{ id: 'u1', name: 'Tech' }] }) },
        },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketTimeLogComponent);
    fixture.componentRef.setInput('ticket', { id: 't1' });
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('loads the entries of the ticket', () => {
    expect(api.getTimeEntries).toHaveBeenCalledWith('t1');
  });

  it('logs the minutes and shows how the contract absorbed them', () => {
    const logged = vi.fn();
    fixture.componentInstance.logged.subscribe(logged);
    harness.form.patchValue({
      minutes: 90,
      technician_id: 'u1',
      description: ' Replaced the board ',
      is_billable: true,
    });

    harness.submit();

    expect(api.logTime).toHaveBeenCalledWith('t1', {
      minutes: 90,
      technician_id: 'u1',
      description: 'Replaced the board',
      is_billable: true,
    });
    expect(harness.result()).toMatchObject({
      billing_status: 'partially_deducted',
      billable_hours: 0.5,
    });
    expect(harness.entries().length).toBe(1);
    expect(logged).toHaveBeenCalledWith(entry);
  });

  it('refuses minutes outside 1..1440 without calling the API', () => {
    harness.form.patchValue({ minutes: 2000 });
    harness.submit();

    expect(api.logTime).not.toHaveBeenCalled();
  });

  it('shows the message of the API when the entry is refused', () => {
    api.logTime.mockReturnValue(throwError(() => ({ error: { message: 'Ticket is closed' } })));
    harness.submit();

    expect(message.error).toHaveBeenCalledWith('Ticket is closed');
  });

  it('clears the outcome when the drawer closes', () => {
    harness.submit();
    harness.closeDrawer();

    expect(harness.result()).toBeNull();
  });
});
