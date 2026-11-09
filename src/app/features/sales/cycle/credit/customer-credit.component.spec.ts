import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import {
  AuthStore,
  BillingApiService,
  CoreOrder,
  I18nService,
  SalesCycleApiService,
} from '@core';
import { icons } from '../../../../icons-provider';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { CustomerCreditComponent } from './customer-credit.component';

const heldOrder: CoreOrder = {
  id: 'o1',
  order_number: 'SO-2026-0001',
  contact_id: 'c1',
  date: '2026-11-09',
  currency: 'EUR',
  status: 'on_hold',
  credit_hold_id: 'h1',
  credit_hold_reason: 'Credit limit exceeded',
  total_gross: '122.00',
};

describe('CustomerCreditComponent', () => {
  let fixture: ComponentFixture<CustomerCreditComponent>;
  let component: CustomerCreditComponent;
  let roles: string[];

  const billingApi = {
    getCustomerCredit: vi.fn(),
    getCustomerStatement: vi.fn(),
    getCustomerAging: vi.fn(),
    setCustomerCreditLimit: vi.fn(),
    releaseCreditHold: vi.fn(),
  };
  const ordersApi = { getOrders: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  function setup(activeRoles: string[], held: CoreOrder[] = [heldOrder]): void {
    roles = activeRoles;
    billingApi.getCustomerCredit.mockReturnValue(
      of({ data: { credit_limit: '1000.00', is_credit_hold: true, hold_reason: 'Limit' } }),
    );
    billingApi.getCustomerStatement.mockReturnValue(of({ data: [] }));
    billingApi.getCustomerAging.mockReturnValue(of({ data: {} }));
    billingApi.releaseCreditHold.mockReturnValue(of({ success: true, message: 'ok', data: null }));
    ordersApi.getOrders.mockReturnValue(of({ data: held, meta: { total: held.length } }));

    TestBed.configureTestingModule({
      imports: [CustomerCreditComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: BillingApiService, useValue: billingApi },
        { provide: SalesCycleApiService, useValue: ordersApi },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: i18n },
        { provide: AuthStore, useValue: { activeRoles: () => roles, activeCurrency: () => 'EUR' } },
        {
          provide: SalesLookupsService,
          useValue: { load: vi.fn(), contacts: () => [], contactLabel: () => '' },
        },
      ],
    });
    fixture = TestBed.createComponent(CustomerCreditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('lists the orders of the customer on credit hold', () => {
    setup(['accountant']);
    component['load']('c1');
    expect(ordersApi.getOrders).toHaveBeenCalledWith({ status: 'on_hold', contact_id: 'c1', per_page: 50 });
    expect(component['heldOrders']()).toEqual([heldOrder]);
    expect(component['holdIdOf'](heldOrder)).toBe('h1');
  });

  it('releases the hold of an order with the same endpoint as the order detail and reloads', () => {
    setup(['owner']);
    component['load']('c1');
    component['releaseHold'](heldOrder);

    expect(billingApi.releaseCreditHold).toHaveBeenCalledWith('h1');
    expect(message.success).toHaveBeenCalledWith('SC.ORDERS.HOLD_RELEASED');
    expect(ordersApi.getOrders).toHaveBeenCalledTimes(2);
  });

  it('does nothing for an order without a hold id', () => {
    setup(['owner'], [{ ...heldOrder, credit_hold_id: null }]);
    component['load']('c1');
    component['releaseHold']({ ...heldOrder, credit_hold_id: null });
    expect(billingApi.releaseCreditHold).not.toHaveBeenCalled();
  });

  it('explains a 403 on release', () => {
    setup(['owner']);
    billingApi.releaseCreditHold.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    component['load']('c1');
    component['releaseHold'](heldOrder);
    expect(message.error).toHaveBeenCalledWith('SC.CREDIT.FORBIDDEN');
    expect(component['releasingId']()).toBeNull();
  });

  it('shows the release button only to credit managers', () => {
    setup(['sales']);
    expect(component['canManage']()).toBe(false);
    TestBed.resetTestingModule();
    setup(['accountant']);
    expect(component['canManage']()).toBe(true);
  });
});
