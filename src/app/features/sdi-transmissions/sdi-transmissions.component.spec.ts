import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService, SdiTransmissionsApiService } from '@core';
import { icons } from '../../icons-provider';
import { SdiTransmissionsComponent } from './sdi-transmissions.component';

describe('SdiTransmissionsComponent', () => {
  const failed = {
    id: 't1', invoice_id: 'inv-1', invoice_number: 'INV-1', invoice_date: '2026-03-01', total_gross: '122.00', currency: 'EUR',
    sdi_status: 'failed', sdi_identifier: null, file_name: 'IT1_1.xml', sent_at: null, delivered_at: null, last_error: 'Provider timeout', can_retry: true,
  };
  const api = { list: vi.fn(), retry: vi.fn(), notifications: vi.fn(), previewHtml: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: SdiTransmissionsApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true, canRead: () => true } },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(SdiTransmissionsComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(of({ success: true, message: '', data: [failed], meta: { total: 1, current_page: 1, last_page: 1, per_page: 25 } }));
    api.retry.mockReturnValue(of({ success: true, message: '', data: {} }));
  });

  it('lists the transmissions with the last error of a failed one', () => {
    const fixture = setup();
    expect(api.list).toHaveBeenCalledWith({ status: undefined, search: undefined, page: 1, per_page: 25 });
    expect(fixture.nativeElement.textContent).toContain('Provider timeout');
  });

  it('sends a failed invoice again and reloads the list', () => {
    const fixture = setup();
    (fixture.componentInstance as unknown as { retry(row: object): void }).retry(failed);
    expect(api.retry).toHaveBeenCalledWith('inv-1');
    expect(message.success).toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('loads the SDI status history for the timeline, oldest first', () => {
    api.notifications.mockReturnValue(
      of({
        success: true,
        message: '',
        data: {
          outbound: [{ id: 'o1', provider: 'pec', action: 'send', status: 'sent', sdi_uuid: null, file_name: 'IT1_1.xml', error: null, created_at: '2026-03-01T10:00:00Z' }],
          inbound: [{ id: 'i1', provider: 'pec', event_type: 'NS', status: 'rejected', sdi_uuid: null, error: 'Invalid VAT', processed_at: '2026-03-01T11:00:00Z', created_at: '2026-03-01T11:00:00Z' }],
        },
      }),
    );
    const fixture = setup();
    const view = fixture.componentInstance as unknown as {
      openHistory(row: object): void;
      historyVisible(): boolean;
      timeline(): { label: string; direction: string; error: string | null }[];
    };
    view.openHistory(failed);

    expect(api.notifications).toHaveBeenCalledWith('inv-1');
    expect(view.historyVisible()).toBe(true);
    expect(view.timeline().map((entry) => [entry.direction, entry.label])).toEqual([
      ['out', 'send'],
      ['in', 'NS'],
    ]);
    expect(view.timeline()[1].error).toBe('Invalid VAT');
  });
});
