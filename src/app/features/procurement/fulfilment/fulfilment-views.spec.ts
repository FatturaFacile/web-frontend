import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PurchaseOrder } from '@core/models';
import { I18nService } from '@core/i18n';
import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { overdueSeverityColor } from './overdue-orders-page.component';
import { differsFromOrdered, PoConfirmationDrawerComponent } from './po-confirmation-drawer.component';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

describe('overdueSeverityColor', () => {
  it('escalates the tag colour with the days overdue', () => {
    expect(overdueSeverityColor(2)).toBe('gold');
    expect(overdueSeverityColor(7)).toBe('warning');
    expect(overdueSeverityColor(14)).toBe('error');
  });
});

describe('differsFromOrdered', () => {
  it('ignores an empty or equal value and flags a different one', () => {
    expect(differsFromOrdered(null, '10.0000')).toBe(false);
    expect(differsFromOrdered(10, '10.0000')).toBe(false);
    expect(differsFromOrdered(8, '10.0000')).toBe(true);
  });
});

/** Protected members of the drawer that the spec drives. */
interface DrawerHarness {
  lines: { at(i: number): { patchValue(v: unknown): void }; length: number };
  lineDiffers(group: unknown): boolean;
  buildPayload: PoConfirmationDrawerComponent['buildPayload'];
}

describe('PoConfirmationDrawerComponent', () => {
  const order = {
    id: 'po-1',
    po_number: 'PO-1',
    lines: [
      { id: 'l-1', line_number: 1, description: 'Bolts', quantity_ordered: '10.0000', unit_price: '5.0000' },
      { id: 'l-2', line_number: 2, description: 'Nuts', quantity_ordered: '4.0000', unit_price: '1.0000' },
    ],
  } as unknown as PurchaseOrder;

  const store = {
    busy: signal(false),
    confirmations: signal([]),
    loadConfirmations: vi.fn(),
    recordConfirmation: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      imports: [PoConfirmationDrawerComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: PurchaseOrderFulfilmentStore, useValue: store },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { currentLanguage: signal<'en'>('en'), translate: vi.fn((key: string) => key) } },
      ],
    });
  });

  function open() {
    const fixture = TestBed.createComponent(PoConfirmationDrawerComponent);
    fixture.componentRef.setInput('order', order);
    fixture.componentRef.setInput('visible', true);
    store.loadConfirmations.mockReturnValue({ subscribe: vi.fn() });
    fixture.detectChanges();
    return fixture.componentInstance as unknown as DrawerHarness;
  }

  it('prefills one form line per order line with the ordered values', () => {
    const component = open();
    expect(component.lines.length).toBe(2);
    const payload = component.buildPayload();
    expect(payload.lines.map((l) => [l.purchase_order_line_id, l.confirmed_quantity, l.confirmed_unit_price])).toEqual([
      ['l-1', 10, 5],
      ['l-2', 4, 1],
    ]);
  });

  it('highlights a line when the supplier changes quantity or price', () => {
    const component = open();
    const first = component.lines.at(0);
    expect(component.lineDiffers(first)).toBe(false);
    first.patchValue({ confirmed_quantity: 8 });
    expect(component.lineDiffers(first)).toBe(true);
  });
});
