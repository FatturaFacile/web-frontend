import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import type { FsmWorkOrder } from '@core';
import { ClientApiService, FsmApiService, I18nService, InventoryApiService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { FieldWorkOrdersComponent } from './field-work-orders.component';

interface Harness {
  form: { patchValue(value: object): void; controls: { required_parts: { length: number } } };
  save(): void;
  openCreate(): void;
  addPart(): void;
  setStatus(value: string | null): void;
  setType(value: string | null): void;
  parts: { at(index: number): { patchValue(value: object): void } };
}

const order: FsmWorkOrder = {
  id: 'w1',
  work_order_number: 'WO-1',
  work_order_type: 'preventive',
  status: 'dispatched',
  priority: 'high',
  title: 'Yearly service',
  problem_description: null,
  customer_id: 'c1',
  equipment_passport_id: null,
  service_contract_id: null,
  assigned_technician_id: 't1',
  required_skills: [],
  required_parts: [],
  scheduled_start: '2026-03-02T08:00:00+00:00',
  scheduled_end: '2026-03-02T10:00:00+00:00',
  actual_arrival: null,
  actual_completion: null,
  site: null,
  client_uuid: null,
  invoice_id: null,
};

describe('FieldWorkOrdersComponent', () => {
  let fixture: ComponentFixture<FieldWorkOrdersComponent>;
  let harness: Harness;

  const api = { listWorkOrders: vi.fn(), listEquipment: vi.fn(), listContracts: vi.fn(), createWorkOrder: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.listWorkOrders.mockReturnValue(of({ data: [order] }));
    api.listEquipment.mockReturnValue(of({ data: [] }));
    api.listContracts.mockReturnValue(of({ data: [] }));
    api.createWorkOrder.mockReturnValue(of({ data: order }));

    await TestBed.configureTestingModule({
      imports: [FieldWorkOrdersComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: FsmApiService, useValue: api },
        { provide: ClientApiService, useValue: { list: () => of({ data: [] }) } },
        { provide: InventoryApiService, useValue: { getProducts: () => of({ data: [] }) } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { currentLanguage: () => 'it', translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FieldWorkOrdersComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  it('lists the work orders with a link to the detail', () => {
    expect(api.listWorkOrders).toHaveBeenCalledWith({ status: '', work_order_type: '' });
    const link = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('[data-testid="wo-table"] a');
    expect(link?.textContent).toContain('WO-1');
    expect(link?.getAttribute('href')).toBe('/field-service/work-orders/w1');
  });

  it('reloads with the chosen status and type filters', () => {
    harness.setStatus('completed');
    expect(api.listWorkOrders).toHaveBeenLastCalledWith({ status: 'completed', work_order_type: '' });
    harness.setType('preventive');
    expect(api.listWorkOrders).toHaveBeenLastCalledWith({ status: 'completed', work_order_type: 'preventive' });
    harness.setStatus(null);
    expect(api.listWorkOrders).toHaveBeenLastCalledWith({ status: '', work_order_type: 'preventive' });
  });

  it('does not save an incomplete form', () => {
    harness.openCreate();
    harness.save();
    expect(api.createWorkOrder).not.toHaveBeenCalled();
  });

  it('creates an idempotent work order with skills and required parts', () => {
    harness.openCreate();
    harness.addPart();
    harness.form.patchValue({
      customer_id: 'c1',
      title: 'Leak',
      work_order_type: 'corrective',
      required_skills: ['hvac'],
      site_address: 'Zurich',
    });
    harness.parts.at(0).patchValue({ product_id: 'p1', quantity: 2 });

    harness.save();

    expect(api.createWorkOrder).toHaveBeenCalledTimes(1);
    const payload = api.createWorkOrder.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        work_order_type: 'corrective',
        customer_id: 'c1',
        title: 'Leak',
        priority: 'normal',
        site_address: 'Zurich',
        required_skills: ['hvac'],
        required_parts: [{ product_id: 'p1', quantity: 2 }],
      }),
    );
    expect(typeof payload.client_uuid).toBe('string');
    expect(message.success).toHaveBeenCalled();
  });
});
