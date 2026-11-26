import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpdeskSlaApiService, I18nService, TicketResource } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketHandoffComponent } from './ticket-handoff.component';

interface Harness {
  confirmFieldService(): void;
  escalateRma(): void;
  serialNumber: { set(value: string): void };
  goodwill: { set(value: boolean): void };
  available(): boolean;
}

describe('TicketHandoffComponent', () => {
  let fixture: ComponentFixture<TicketHandoffComponent>;
  let harness: Harness;

  const api = { escalateToFieldService: vi.fn(), escalateToRma: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  const translate = vi.fn((key: string, _params?: Record<string, unknown>) => key);
  const modal = { confirm: vi.fn((options: { nzOnOk: () => void }) => options.nzOnOk()) };

  async function setup(ticket: Partial<TicketResource> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TicketHandoffComponent],
      providers: [
        { provide: HelpdeskSlaApiService, useValue: api },
        { provide: I18nService, useValue: { translate } },
        { provide: NzMessageService, useValue: message },
      ],
    })
      .overrideProvider(NzModalService, { useValue: modal })
      .compileComponents();

    fixture = TestBed.createComponent(TicketHandoffComponent);
    fixture.componentRef.setInput('ticket', {
      id: 't1',
      status: 'open',
      merged_into_ticket_id: null,
      ...ticket,
    });
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  }

  beforeEach(() => vi.clearAllMocks());

  it('asks for confirmation and reports a new work order (201)', async () => {
    api.escalateToFieldService.mockReturnValue(of({ created: true, data: { id: 'w1' } }));
    await setup();
    const handedOff = vi.fn();
    fixture.componentInstance.handedOff.subscribe(handedOff);

    harness.confirmFieldService();

    expect(modal.confirm).toHaveBeenCalled();
    expect(api.escalateToFieldService).toHaveBeenCalledWith('t1');
    expect(message.success).toHaveBeenCalledWith('HELPDESK_SLA.FIELD_SERVICE_CREATED');
    expect(handedOff).toHaveBeenCalledWith('field_service');
  });

  it('tells an already handed-off ticket (200) without claiming a new document', async () => {
    api.escalateToFieldService.mockReturnValue(of({ created: false, data: { id: 'w1' } }));
    await setup();

    harness.confirmFieldService();

    expect(message.info).toHaveBeenCalledWith('HELPDESK_SLA.ALREADY_HANDED_OFF');
    expect(message.success).not.toHaveBeenCalled();
  });

  it('sends the unit to the RMA and shows its tracking code', async () => {
    api.escalateToRma.mockReturnValue(
      of({ created: true, data: { id: 'r1' }, meta: { tracking_token: 'TRK1' } }),
    );
    await setup();

    harness.serialNumber.set(' SN-42 ');
    harness.goodwill.set(true);
    harness.escalateRma();

    expect(api.escalateToRma).toHaveBeenCalledWith('t1', {
      serial_number: 'SN-42',
      reported_symptom: undefined,
      goodwill: true,
    });
    expect(translate).toHaveBeenCalledWith('HELPDESK_SLA.RMA_CREATED', { token: 'TRK1' });
    expect(message.success).toHaveBeenCalledWith('HELPDESK_SLA.RMA_CREATED');
  });

  it('shows the reason of a 422 refusal', async () => {
    api.escalateToRma.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { message: 'No unit to return' } }),
      ),
    );
    await setup();

    harness.escalateRma();

    expect(message.error).toHaveBeenCalledWith('No unit to return');
  });

  it('falls back to the generic refusal text when the 422 carries no message', async () => {
    api.escalateToFieldService.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: {} })),
    );
    await setup();

    harness.confirmFieldService();

    expect(message.error).toHaveBeenCalledWith('HELPDESK_SLA.HANDOFF_REFUSED');
  });

  it('turns the hand-off off for a closed or merged ticket', async () => {
    await setup({ status: 'closed' });
    expect(harness.available()).toBe(false);
  });
});
