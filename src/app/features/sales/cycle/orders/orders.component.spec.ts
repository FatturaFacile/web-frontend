import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthStore,
  BillingApiService,
  ClientApiService,
  CoreOrder,
  I18nService,
  InventoryApiService,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import { icons } from '../../../../icons-provider';
import { CycleOrdersComponent } from './orders.component';

const heldOrder: CoreOrder = {
  id: 'o1',
  order_number: 'SO-2026-0001',
  contact_id: 'c1',
  date: '2026-11-09',
  currency: 'EUR',
  status: 'on_hold',
  inventory_status: 'not_reserved',
  credit_status: 'on_hold',
  credit_hold_reason: 'Credit limit exceeded',
  holds: [{ id: 'h1', status: 'active', hold_reason: 'Credit limit exceeded' }],
  total_gross: '122.00',
  items: [],
};

describe('CycleOrdersComponent', () => {
  let fixture: ComponentFixture<CycleOrdersComponent>;
  let component: CycleOrdersComponent;
  let roles: string[];

  const page = (data: CoreOrder[]) => ({
    success: true,
    message: 'ok',
    data,
    meta: { current_page: 1, last_page: 1, per_page: 10, total: data.length, from: 1, to: data.length },
  });

  const salesApi = {
    getOrders: vi.fn(),
    getOrder: vi.fn(),
    confirmOrder: vi.fn(),
  };
  const billingApi = { releaseCreditHold: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  async function setup(activeRoles: string[]): Promise<void> {
    roles = activeRoles;
    salesApi.getOrders.mockReturnValue(of(page([heldOrder])));
    salesApi.getOrder.mockReturnValue(of({ success: true, message: 'ok', data: heldOrder }));
    billingApi.releaseCreditHold.mockReturnValue(of({ success: true, message: 'ok', data: null }));

    await TestBed.configureTestingModule({
      imports: [CycleOrdersComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SalesCycleApiService, useValue: salesApi },
        { provide: BillingApiService, useValue: billingApi },
        { provide: ClientApiService, useValue: { list: vi.fn().mockReturnValue(of(page([]))) } },
        {
          provide: InventoryApiService,
          useValue: {
            getProducts: vi.fn().mockReturnValue(of(page([]))),
            getWarehouses: vi.fn().mockReturnValue(of({ success: true, data: [] })),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: AuthStore, useValue: { activeRoles: () => roles, activeCurrency: () => 'EUR' } },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CycleOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the first page of orders from /sales/orders', async () => {
    await setup(['owner']);
    expect(salesApi.getOrders).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 10 }));
    expect(component['facade'].items()).toEqual([heldOrder]);
  });

  it('shows the credit hold and lets a credit manager release it', async () => {
    await setup(['accountant']);
    component['view'](heldOrder);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = document.body.textContent ?? '';
    expect(text).toContain('SC.ORDERS.ON_HOLD_TITLE');
    expect(text).toContain('Credit limit exceeded');

    component['releaseHold'](heldOrder);
    expect(billingApi.releaseCreditHold).toHaveBeenCalledWith('h1');
    expect(message.success).toHaveBeenCalledWith('SC.ORDERS.HOLD_RELEASED');
  });

  it('does not allow releasing the hold to roles outside the credit managers', async () => {
    await setup(['sales']);
    expect(component['canReleaseHold']()).toBe(false);
  });

  it('warns when confirming an order puts it on credit hold', async () => {
    await setup(['owner']);
    salesApi.confirmOrder.mockReturnValue(of({ success: true, message: 'ok', data: heldOrder }));
    component['confirm']({ ...heldOrder, status: 'draft' });
    expect(salesApi.confirmOrder).toHaveBeenCalledWith('o1');
    expect(message.warning).toHaveBeenCalledWith('SC.ORDERS.ON_HOLD_RESULT');
  });

  it('exposes the active hold id only for an active hold', async () => {
    await setup(['owner']);
    expect(component['activeHoldId'](heldOrder)).toBe('h1');
    expect(component['activeHoldId']({ ...heldOrder, holds: [{ id: 'h2', status: 'released' }] })).toBeNull();
    expect(component['activeHoldId']({ ...heldOrder, holds: undefined })).toBeNull();
  });
});
