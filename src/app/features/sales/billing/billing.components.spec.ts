import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthStore,
  BillingApiService,
  BillingPlan,
  ClientApiService,
  I18nService,
  InventoryApiService,
  PermissionsService,
  SalesCycleApiService,
} from '@core';
import { icons } from '../../../icons-provider';
import { BillingPlansComponent } from './plans/billing-plans.component';
import { DeferredBillingComponent } from './deferred/deferred-billing.component';

const plan: BillingPlan = {
  id: 'bp1',
  schedule_number: 'BP-0001',
  sales_order_id: 'o1',
  customer_id: 'c1',
  status: 'active',
  currency: 'EUR',
  total_amount: '1000.00',
  billed_amount: '0.00',
  remaining_amount: '1000.00',
  items: [{ id: 'it1', name: 'Advance', percentage: '50.0000', target_date: '2026-12-01', status: 'pending' }],
};

const page = (data: unknown[]) => ({
  success: true,
  message: 'ok',
  data,
  meta: { current_page: 1, last_page: 1, per_page: 15, total: data.length, from: 1, to: data.length },
});

describe('Billing pages', () => {
  const billingApi = {
    getBillingPlans: vi.fn(),
    getBillingPlan: vi.fn(),
    createBillingPlan: vi.fn(),
    invoiceBillingPlanItem: vi.fn(),
    cancelBillingPlan: vi.fn(),
    runBillingPlans: vi.fn(),
    createDeferredInvoice: vi.fn(),
    runDeferredBilling: vi.fn(),
  };
  const salesApi = { getOrders: vi.fn(), getDeliveryNotes: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const i18n = { translate: vi.fn((key: string) => key), currentLanguage: signal('it') };

  beforeEach(async () => {
    vi.clearAllMocks();
    billingApi.getBillingPlans.mockReturnValue(of(page([plan])));
    billingApi.getBillingPlan.mockReturnValue(of({ success: true, message: 'ok', data: plan }));
    salesApi.getOrders.mockReturnValue(of(page([])));
    salesApi.getDeliveryNotes.mockReturnValue(
      of(
        page([
          { id: 'd1', ddt_number: 'DDT-1', contact_id: 'c1', date: '2026-11-01', status: 'dispatched' },
          { id: 'd2', ddt_number: 'DDT-2', contact_id: 'c1', date: '2026-11-02', status: 'invoiced' },
          { id: 'd3', ddt_number: 'DDT-3', contact_id: 'c1', date: '2026-11-03', status: 'draft' },
        ]),
      ),
    );

    await TestBed.configureTestingModule({
      imports: [BillingPlansComponent, DeferredBillingComponent],
      providers: [
        provideNzIcons(icons),
        { provide: BillingApiService, useValue: billingApi },
        { provide: SalesCycleApiService, useValue: salesApi },
        { provide: ClientApiService, useValue: { list: vi.fn().mockReturnValue(of(page([]))) } },
        {
          provide: InventoryApiService,
          useValue: {
            getProducts: vi.fn().mockReturnValue(of(page([]))),
            getWarehouses: vi.fn().mockReturnValue(of({ success: true, data: [] })),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: AuthStore, useValue: { activeCurrency: () => 'EUR', activeRoles: () => ['owner'] } },
        { provide: I18nService, useValue: i18n },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
  });

  it('loads the billing plans and invoices one milestone', () => {
    const fixture = TestBed.createComponent(BillingPlansComponent);
    fixture.detectChanges();
    expect(billingApi.getBillingPlans).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 15 }));

    billingApi.invoiceBillingPlanItem.mockReturnValue(of({ success: true, message: 'ok', data: {} }));
    fixture.componentInstance['invoiceItem'](plan, plan.items![0]);
    expect(billingApi.invoiceBillingPlanItem).toHaveBeenCalledWith('bp1', 'it1');
    expect(message.success).toHaveBeenCalledWith('SC.BILLING.INVOICE_CREATED');
  });

  it('requires either a percentage or an amount for each milestone', () => {
    const fixture = TestBed.createComponent(BillingPlansComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['openCreate']();
    component['form'].patchValue({ sales_order_id: 'o1' });
    component['items'].at(0).patchValue({ name: 'Advance', percentage: '', amount: '' });
    expect(component['canSubmit']()).toBe(false);
    component['items'].at(0).patchValue({ percentage: '30', amount: '' });
    expect(component['canSubmit']()).toBe(true);
    component['items'].at(0).patchValue({ percentage: '30', amount: '100' });
    expect(component['canSubmit']()).toBe(false);
  });

  it('shows the server error when an order with an active plan is billed again', () => {
    const fixture = TestBed.createComponent(BillingPlansComponent);
    fixture.detectChanges();
    billingApi.invoiceBillingPlanItem.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Plan already billed' } })),
    );
    fixture.componentInstance['invoiceItem'](plan, plan.items![0]);
    expect(message.error).toHaveBeenCalledWith('Plan already billed');
  });

  it('offers only billable delivery notes for deferred invoicing and sends the selection', () => {
    const fixture = TestBed.createComponent(DeferredBillingComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component['billable']().map((n) => n.id)).toEqual(['d1']);

    component['toggle']('d1', true);
    billingApi.createDeferredInvoice.mockReturnValue(of({ success: true, message: 'ok', data: {} }));
    component['createDeferred']();
    expect(billingApi.createDeferredInvoice).toHaveBeenCalledWith({ delivery_note_ids: ['d1'], due_date: null });
  });

  it('runs the deferred billing up to a date', () => {
    const fixture = TestBed.createComponent(DeferredBillingComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['runUpTo'] = '2026-11-30';
    billingApi.runDeferredBilling.mockReturnValue(of({ success: true, message: 'ok', data: {} }));
    component['runDeferred']();
    expect(billingApi.runDeferredBilling).toHaveBeenCalledWith({
      up_to_date: '2026-11-30',
      contact_id: null,
      due_date: null,
    });
  });
});
