import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { InventoryApiService, RetailApiService, RetailTicketPreview } from '@core';
import { CashierComponent } from './cashier.page';

const preview: RetailTicketPreview = {
  items: [],
  promotions: [{ code: 'P10', name: 'Ten percent', discount_net: '1.00' }],
  discount_total: '1.00',
  total_net: '9.00',
  total_tax: '1.98',
  total_gross: '10.98',
};

function setup() {
  const api = {
    getPosSessions: vi.fn(() => of({ data: { data: [{ id: 'session-1', status: 'open' }] } })),
    previewTicket: vi.fn(() => of({ data: preview })),
    createTicket: vi.fn(() => of({ data: { id: 'sale-1', receipt_number: 'R-1', items: [] } })),
    getTicket: vi.fn(() => of({ data: { id: 'sale-1', items: [{ id: 'item-1', description: 'Shirt', returnable_quantity: '2.0000' }] } })),
    createReturn: vi.fn(() => of({ data: { id: 'ret-1' } })),
    refundSale: vi.fn(() => of({ data: { id: 'ret-2' } })),
  };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RetailApiService, useValue: api },
      { provide: InventoryApiService, useValue: { getProducts: vi.fn(() => of({ data: [] })) } },
    ],
  });

  const fixture = TestBed.createComponent(CashierComponent);
  fixture.detectChanges();

  return { api, component: fixture.componentInstance };
}

describe('CashierComponent', () => {
  it('loads the open session and prices the ticket with the server promotions', () => {
    const { api, component } = setup();

    component.freeDescription.set('Bread');
    component.freePrice.set(10);
    component.addFreeLine();

    expect(component.session()?.id).toBe('session-1');
    expect(api.previewTicket).toHaveBeenCalledWith([{ description: 'Bread', quantity: 1, unit_price: 10, tax_rate: 22 }]);
    expect(component.preview()?.promotions[0].code).toBe('P10');
  });

  it('allows the charge only when the payments cover the total and computes the change', () => {
    const { api, component } = setup();

    component.freeDescription.set('Bread');
    component.addFreeLine();
    expect(component.canCharge()).toBe(false);

    component.paymentMethod.set('card');
    component.paymentAmount.set(5);
    component.addPayment();
    component.paymentMethod.set('cash');
    component.paymentAmount.set(10);
    component.addPayment();

    expect(component.remaining()).toBe(0);
    expect(component.change()).toBe(4.02);
    expect(component.canCharge()).toBe(true);

    component.charge();

    expect(api.createTicket).toHaveBeenCalledWith(expect.objectContaining({ pos_session_id: 'session-1', payments: [{ method: 'card', amount: 5 }, { method: 'cash', amount: 10 }] }));
    expect(component.lines()).toEqual([]);
    expect(component.lastTicket()?.receipt_number).toBe('R-1');
  });

  it('returns the chosen lines and refunds the whole sale', () => {
    const { api, component } = setup();

    component.saleId.set('sale-1');
    component.loadSale();
    component.setReturnQuantity('item-1', 1);
    component.returnSelected();

    expect(api.createReturn).toHaveBeenCalledWith('sale-1', { pos_session_id: 'session-1', lines: [{ pos_sale_item_id: 'item-1', quantity: 1 }], refund_method: 'cash', reason: null });

    component.refundWhole();

    expect(api.refundSale).toHaveBeenCalledWith('sale-1', { pos_session_id: 'session-1', refund_method: 'cash', reason: null });
  });
});
