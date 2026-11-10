import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import { HelpdeskApiService, I18nService, TicketApiService } from '@core';
import { TicketBulkModalComponent } from './ticket-bulk-modal.component';

interface Harness {
  action: { set(value: string): void };
  status: { set(value: string): void };
  priority: { set(value: string): void };
  tags: { set(value: string[]): void };
  valid(): boolean;
  apply(): void;
  failedOutcomes(): { ticket_id: string }[];
}

describe('TicketBulkModalComponent', () => {
  let fixture: ComponentFixture<TicketBulkModalComponent>;
  let harness: Harness;
  const tickets = { bulkUpdate: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    tickets.bulkUpdate.mockReturnValue(
      of({
        data: [
          { ticket_id: 'a', ok: true, error: null },
          { ticket_id: 'b', ok: false, error: 'locked' },
        ],
        meta: { succeeded: 1, failed: 1 },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [TicketBulkModalComponent],
      providers: [
        provideNzIcons(icons),
        { provide: TicketApiService, useValue: tickets },
        { provide: HelpdeskApiService, useValue: { getMacros: () => of({ data: [] }) } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: { error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketBulkModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('ticketIds', ['a', 'b']);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('needs a value for the chosen action before it can be applied', () => {
    expect(harness.valid()).toBe(false);
    harness.status.set('resolved');
    expect(harness.valid()).toBe(true);
    harness.action.set('add_tags');
    expect(harness.valid()).toBe(false);
    harness.tags.set(['vip']);
    expect(harness.valid()).toBe(true);
  });

  it('sends the status change for every selected ticket and reports the failures', () => {
    const done = vi.fn();
    fixture.componentInstance.done.subscribe(done);
    harness.status.set('resolved');

    harness.apply();

    expect(tickets.bulkUpdate).toHaveBeenCalledWith({ ticket_ids: ['a', 'b'], action: 'status', status: 'resolved' });
    expect(harness.failedOutcomes().map((outcome) => outcome.ticket_id)).toEqual(['b']);
    expect(done).toHaveBeenCalled();
  });

  it('sends the tags for the tag actions', () => {
    harness.action.set('remove_tags');
    harness.tags.set(['old']);
    harness.apply();
    expect(tickets.bulkUpdate).toHaveBeenCalledWith({ ticket_ids: ['a', 'b'], action: 'remove_tags', tags: ['old'] });
  });
});
