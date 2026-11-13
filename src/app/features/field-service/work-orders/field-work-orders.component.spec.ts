import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { ClientApiService, FieldServiceApiService, I18nService, PermissionsService, SettingsApiService } from '@core';
import { FieldWorkOrdersComponent } from './field-work-orders.component';

interface Harness {
  form: { patchValue(value: object): void; controls: { lines: { at(index: number): { patchValue(value: object): void } } } };
  save(): void;
  openCreate(): void;
  complete(order: unknown): void;
  sign(result: { signerName: string; signature: string }): void;
  signTarget: { set(value: unknown): void };
}

describe('FieldWorkOrdersComponent', () => {
  let fixture: ComponentFixture<FieldWorkOrdersComponent>;
  let harness: Harness;

  const order = { id: 'w1', work_order_number: 'WO-1', date: '2026-11-01T08:00:00+01:00', status: 'draft', labor_hours: '2.00', total_amount: '100.00' };
  const api = {
    getWorkOrders: vi.fn(),
    getWorkOrder: vi.fn(),
    createWorkOrder: vi.fn(),
    updateWorkOrder: vi.fn(),
    completeWorkOrder: vi.fn(),
    signWorkOrder: vi.fn(),
    invoiceWorkOrder: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const modal = { confirm: vi.fn((options: { nzOnOk: () => void }) => options.nzOnOk()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getWorkOrders.mockReturnValue(of({ data: { data: [order], total: 1 } }));
    api.createWorkOrder.mockReturnValue(of({ data: order }));
    api.completeWorkOrder.mockReturnValue(of({ data: order }));
    api.signWorkOrder.mockReturnValue(of({ data: order }));

    await TestBed.overrideProvider(NzModalService, { useValue: modal })
      .configureTestingModule({
      imports: [FieldWorkOrdersComponent],
      providers: [
        provideNzIcons(icons),
        { provide: FieldServiceApiService, useValue: api },
        { provide: ClientApiService, useValue: { list: () => of({ data: [{ id: 'c1', company_name: 'Alpha' }] }) } },
        { provide: SettingsApiService, useValue: { getTenantUsers: () => of({ data: [{ id: 'u1', name: 'Tech' }] }) } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FieldWorkOrdersComponent);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 30));
    fixture.detectChanges();
  });

  it('loads the first page of work orders', () => {
    expect(api.getWorkOrders).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 20 }));
    expect(fixture.nativeElement.textContent).toContain('WO-1');
  });

  it('does not save an incomplete form', () => {
    harness.openCreate();
    harness.save();
    expect(api.createWorkOrder).not.toHaveBeenCalled();
  });

  it('creates a work order with its lines', () => {
    harness.openCreate();
    harness.form.patchValue({ client_id: 'c1', date: '2026-11-02T09:00' });
    harness.form.controls.lines.at(0).patchValue({ description: 'Labour', quantity: 2, unit_price: 50, tax_rate: 22 });

    harness.save();

    expect(api.createWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'c1',
        date: '2026-11-02T09:00',
        ticket_id: null,
        lines: [{ type: 'labor', description: 'Labour', quantity: 2, unit_price: 50, tax_rate: 22 }],
      }),
    );
  });

  it('completes after confirmation and signs with the pad image', () => {
    harness.complete(order);
    expect(api.completeWorkOrder).toHaveBeenCalledWith('w1');

    harness.signTarget.set(order);
    harness.sign({ signerName: 'Rossi', signature: 'data:image/png;base64,AAA' });
    expect(api.signWorkOrder).toHaveBeenCalledWith('w1', { signed_by: 'Rossi', signature_base64: 'data:image/png;base64,AAA' });
  });
});
