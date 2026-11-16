import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogisticsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { DeliveryNoteEditorComponent } from './delivery-note-editor.component';

describe('DeliveryNoteEditorComponent', () => {
  const api = {
    partners: vi.fn(() => of({ success: true, message: '', data: [] })),
    products: vi.fn(() => of({ success: true, message: '', data: [] })),
    warehouses: vi.fn(() => of({ success: true, message: '', data: [] })),
    openOrders: vi.fn(() => of({ success: true, message: '', data: [] })),
    createDeliveryNote: vi.fn(() => of({ success: true, message: '', data: {} })),
    createDeliveryNoteFromOrders: vi.fn(() => of({ success: true, message: '', data: {} })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: LogisticsApiService, useValue: api },
      ],
    });
  });

  const create = () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DeliveryNoteEditorComponent);
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { fixture, c: fixture.componentInstance as any };
  };

  it('requires a customer for sale documents before leaving the first step', () => {
    const { c } = create();
    expect(c.stepValid()).toBe(false);

    c.header.controls.contact_id.setValue('customer-1');
    expect(c.stepValid()).toBe(true);
  });

  it('accepts a destination warehouse instead of a customer for internal transfers', () => {
    const { c } = create();
    c.header.controls.type.setValue('internal_transfer');
    expect(c.header.controls.transport_reason_code.value).toBe('internal_transfer');
    expect(c.stepValid()).toBe(false);

    c.header.controls.destination_warehouse_id.setValue('wh-2');
    expect(c.stepValid()).toBe(true);
  });

  it('suggests net/gross weight and package count from the lines until the user edits them', () => {
    const { c } = create();
    c.lines.at(0).patchValue({ description: 'A', quantity: 4, unit_weight_kg: 2.5 });
    c.addLine();
    c.lines.at(1).patchValue({ description: 'B', quantity: 2, unit_weight_kg: 1 });

    expect(c.logistics.controls.net_weight_kg.value).toBe(12);
    expect(c.logistics.controls.gross_weight_kg.value).toBe(12);
    expect(c.logistics.controls.packages_count.value).toBe(2);

    // once the user types the gross weight it is no longer overwritten
    c.logistics.controls.gross_weight_kg.setValue(15);
    c.logistics.controls.gross_weight_kg.markAsDirty();
    c.lines.at(1).patchValue({ quantity: 10 });
    expect(c.logistics.controls.net_weight_kg.value).toBe(20);
    expect(c.logistics.controls.gross_weight_kg.value).toBe(15);
  });

  it('validates line description and quantity on the lines step', () => {
    const { c } = create();
    c.step.set(1);
    expect(c.stepValid()).toBe(false);

    c.lines.at(0).patchValue({ description: 'Widget', quantity: 3 });
    expect(c.stepValid()).toBe(true);
    c.lines.at(0).patchValue({ quantity: 0 });
    expect(c.stepValid()).toBe(false);
  });

  it('creates a standalone DDT with the typed payload', () => {
    const { c } = create();
    c.header.controls.contact_id.setValue('customer-1');
    c.lines.at(0).patchValue({ description: 'Widget', quantity: 3, unit_price: 10, tax_rate: 22 });
    c.logistics.controls.incoterms.setValue('DAP');

    c.save();

    expect(api.createDeliveryNote).toHaveBeenCalledOnce();
    const payload = (api.createDeliveryNote.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(payload['type']).toBe('outbound_sale');
    expect(payload['contact_id']).toBe('customer-1');
    expect(payload['incoterms']).toBe('DAP');
    expect(payload['items']).toEqual([
      { product_id: null, description: 'Widget', quantity: 3, unit_price: 10, tax_rate: 22 },
    ]);
  });

  it('imports lines from open orders: only quantities above zero are sent, per order', () => {
    api.openOrders.mockReturnValueOnce(
      of({
        success: true,
        message: '',
        data: [
          {
            id: 'order-1',
            order_number: 'SO-1',
            contact_id: 'customer-1',
            currency: 'EUR',
            items: [
              {
                id: 'i1',
                product_id: 'p1',
                description: 'A',
                quantity: 10,
                quantity_delivered: 4,
                remaining: 6,
                unit_price: 5,
              },
              {
                id: 'i2',
                product_id: 'p2',
                description: 'B',
                quantity: 3,
                quantity_delivered: 0,
                remaining: 3,
                unit_price: 9,
              },
            ],
          },
        ],
      }),
    );
    const { c } = create();
    c.header.controls.contact_id.setValue('customer-1');
    c.setMode('from_orders');
    c.step.set(1);
    expect(c.stepValid()).toBe(false);

    c.setOrderQuantity('i1', 4);
    c.setOrderQuantity('i2', 0);
    expect(c.stepValid()).toBe(true);

    c.save();
    const payload = (api.createDeliveryNoteFromOrders.mock.calls[0] as unknown[])[0] as {
      orders: unknown[];
    };
    expect(payload.orders).toEqual([
      { sales_order_id: 'order-1', items: [{ sales_order_item_id: 'i1', quantity: 4 }] },
    ]);
  });

  it('can ship the whole remaining quantity of an order with one action', () => {
    const { c } = create();
    c.shipAllRemaining({
      id: 'o',
      order_number: 'SO',
      contact_id: 'c',
      currency: 'EUR',
      items: [
        { id: 'i1', remaining: 6 },
        { id: 'i2', remaining: 3 },
      ],
    });

    expect(c.orderQuantity('i1')).toBe(6);
    expect(c.orderQuantity('i2')).toBe(3);
  });
});
