import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmWorkOrder, FsmWorkOrderStatus } from '@core';
import { FsmApiService, I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { ServiceReportsComponent } from './service-reports.component';

interface Harness {
  visible: () => FsmWorkOrder[];
  setFilter(value: string): void;
  loadError: () => boolean;
}

function order(id: string, status: FsmWorkOrderStatus, completion: string, invoiceId: string | null = null): FsmWorkOrder {
  return {
    id,
    work_order_number: `WO-${id}`,
    work_order_type: 'corrective',
    status,
    priority: 'normal',
    title: `Job ${id}`,
    problem_description: null,
    customer_id: 'c1',
    equipment_passport_id: null,
    service_contract_id: null,
    assigned_technician_id: 't1',
    required_skills: [],
    required_parts: [],
    scheduled_start: null,
    scheduled_end: null,
    actual_arrival: null,
    actual_completion: completion,
    site: null,
    client_uuid: null,
    invoice_id: invoiceId,
  };
}

describe('ServiceReportsComponent', () => {
  let fixture: ComponentFixture<ServiceReportsComponent>;
  let harness: Harness;
  const api = { listWorkOrders: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listWorkOrders.mockImplementation((params: { status: string }) =>
      of({
        data:
          params.status === 'completed'
            ? [order('1', 'completed', '2026-03-02T10:00:00+00:00')]
            : [order('2', 'invoiced', '2026-03-03T10:00:00+00:00', 'i1')],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [ServiceReportsComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: FsmApiService, useValue: api },
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ServiceReportsComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('loads the completed and invoiced work orders, newest first', () => {
    expect(api.listWorkOrders).toHaveBeenCalledWith({ status: 'completed' });
    expect(api.listWorkOrders).toHaveBeenCalledWith({ status: 'invoiced' });
    expect(harness.visible().map((o) => o.id)).toEqual(['2', '1']);
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-testid="reports-table"] a');
    expect(link?.getAttribute('href')).toBe('/field-service/work-orders/2');
  });

  it('filters the orders still to invoice and the invoiced ones', () => {
    harness.setFilter('to_invoice');
    expect(harness.visible().map((o) => o.id)).toEqual(['1']);
    harness.setFilter('invoiced');
    expect(harness.visible().map((o) => o.id)).toEqual(['2']);
  });

  it('flags a load failure', () => {
    api.listWorkOrders.mockReturnValue(throwError(() => new Error('down')));
    fixture = TestBed.createComponent(ServiceReportsComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
    expect(harness.loadError()).toBe(true);
  });
});
