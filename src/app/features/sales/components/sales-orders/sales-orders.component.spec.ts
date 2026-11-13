import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import {
  AuthStore,
  ClientApiService,
  DeliveryNoteResource,
  I18nService,
  InventoryApiService,
  SalesApiService,
  SalesOrderResource,
  SalesQuoteResource,
  TranslateService,
} from '@core';
import { SalesOrdersComponent } from './sales-orders.component';

describe('SalesOrdersComponent', () => {
  let fixture: ComponentFixture<SalesOrdersComponent>;
  let component: SalesOrdersComponent;

  const mockQuotes: SalesQuoteResource[] = [
    {
      id: 'q-1',
      quote_number: 'QUO-2026-001',
      contact_id: 'c-1',
      contact: { id: 'c-1', name: 'Acme Corp' },
      date: '2026-11-09',
      valid_until: '2026-12-09',
      currency: 'EUR',
      subtotal: 1000,
      total_net: 1000,
      total_tax: 220,
      total_gross: 1220,
      status: 'pending_approval',
    },
  ];

  const mockOrders: SalesOrderResource[] = [
    {
      id: 'ord-1',
      order_number: 'ORD-2026-001',
      contact_id: 'c-1',
      contact: { id: 'c-1', name: 'Acme Corp' },
      date: '2026-11-09',
      currency: 'EUR',
      total_net: 1000,
      total_tax: 220,
      total_gross: 1220,
      status: 'confirmed',
      is_stock_reserved: false,
    },
  ];

  const mockDeliveryNotes: DeliveryNoteResource[] = [
    {
      id: 'ddt-1',
      ddt_number: 'DDT-2026-001',
      contact_id: 'c-1',
      contact: { id: 'c-1', name: 'Acme Corp' },
      date: '2026-11-09',
      transport_reason: 'Vendita',
      packages_count: 2,
      gross_weight_kg: 12,
      carrier_name: 'DHL',
      status: 'draft',
    },
  ];

  const mockSalesApi = {
    getQuotes: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockQuotes,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createQuote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockQuotes[0],
      }),
    ),
    submitQuoteForApproval: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockQuotes[0], status: 'pending_approval' },
      }),
    ),
    approveQuote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockQuotes[0], status: 'approved' },
      }),
    ),
    rejectQuote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockQuotes[0], status: 'rejected' },
      }),
    ),
    acceptQuote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockQuotes[0], status: 'accepted' },
      }),
    ),
    convertQuoteToOrder: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockOrders[0],
      }),
    ),
    getOrders: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockOrders,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createOrder: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockOrders[0],
      }),
    ),
    approveOrder: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockOrders[0], status: 'approved' },
      }),
    ),
    reserveOrderStock: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockOrders[0], is_stock_reserved: true },
      }),
    ),
    invoiceOrder: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { invoice_id: 'inv-100' },
      }),
    ),
    cancelOrder: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockOrders[0], status: 'cancelled' },
      }),
    ),
    getDeliveryNotes: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockDeliveryNotes,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
      }),
    ),
    createDeliveryNote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: mockDeliveryNotes[0],
      }),
    ),
    dispatchDeliveryNote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockDeliveryNotes[0], status: 'dispatched' },
      }),
    ),
    confirmDeliveryNote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { ...mockDeliveryNotes[0], status: 'confirmed' },
      }),
    ),
    invoiceDeliveryNote: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { invoice_id: 'inv-101' },
      }),
    ),
  };

  const mockClientApi = {
    list: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [{ id: 'c-1', company_name: 'Acme Corp', type: 'client', country: 'IT' }],
      }),
    ),
  };

  const mockInventoryApi = {
    getProducts: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [{ id: 'p-1', name: 'Widget' }],
      }),
    ),
    getWarehouses: vi.fn().mockReturnValue(
      of({
        success: true,
        data: [{ id: 'w-1', name: 'Milano Hub', code: 'MI' }],
      }),
    ),
  };

  const mockTranslate = {
    instant: vi.fn((k: string) => k),
    translate: vi.fn((k: string) => k),
    currentLanguage: signal('it'),
  };

  /** The grids load through a debounced stream: lets the first request of every tab settle. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  const mockAuthStore = {
    activeJurisdiction: vi.fn().mockReturnValue('IT'),
    activeCurrency: vi.fn().mockReturnValue('EUR'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [SalesOrdersComponent],
      providers: [
        provideNzIcons(icons),
        { provide: SalesApiService, useValue: mockSalesApi },
        { provide: ClientApiService, useValue: mockClientApi },
        { provide: InventoryApiService, useValue: mockInventoryApi },
        { provide: AuthStore, useValue: mockAuthStore },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SalesOrdersComponent);
    component = fixture.componentInstance;
  });

  it('loads quotes and lookups on initialization', async () => {
    fixture.detectChanges();
    await settle();
    expect(component).toBeTruthy();
    expect(mockClientApi.list).toHaveBeenCalled();
    expect(mockInventoryApi.getProducts).toHaveBeenCalled();
    expect(mockSalesApi.getQuotes).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 10 }));
    expect(component.quotes()).toEqual(mockQuotes);
  });

  it('submits quote creation and handles approval/convert workflow', async () => {
    fixture.detectChanges();
    await settle();
    component.openQuoteModal();
    expect(component.quoteModalVisible()).toBe(true);

    component.quoteForm.patchValue({
      contact_id: 'c-1',
      date: '2026-11-09',
      valid_until: '2026-12-09',
      currency: 'EUR',
    });
    component.quoteItems.at(0).patchValue({
      description: 'Consulting',
      quantity: 5,
      unit_price: 100,
      tax_rate: 22,
    });

    component.submitQuote();
    expect(mockSalesApi.createQuote).toHaveBeenCalled();
    expect(component.quoteModalVisible()).toBe(false);

    component.approveQuote('q-1');
    expect(mockSalesApi.approveQuote).toHaveBeenCalledWith('q-1');

    component.acceptQuote('q-1');
    expect(mockSalesApi.acceptQuote).toHaveBeenCalledWith('q-1');

    component.convertQuote('q-1');
    expect(mockSalesApi.convertQuoteToOrder).toHaveBeenCalledWith('q-1');
  });

  it('loads orders and handles order actions (approve, reserve, invoice)', async () => {
    fixture.detectChanges();
    component.onTabChange(1);
    await settle();
    expect(component.selectedTabIndex()).toBe(1);
    expect(mockSalesApi.getOrders).toHaveBeenCalled();
    expect(component.orders().length).toBe(1);

    component.approveOrder('ord-1');
    expect(mockSalesApi.approveOrder).toHaveBeenCalledWith('ord-1');

    component.reserveStock('ord-1');
    expect(mockSalesApi.reserveOrderStock).toHaveBeenCalledWith('ord-1');

    component.invoiceOrder('ord-1');
    expect(mockSalesApi.invoiceOrder).toHaveBeenCalledWith('ord-1');
  });

  it('loads delivery notes and handles dispatch, confirm, invoice', async () => {
    fixture.detectChanges();
    component.onTabChange(2);
    await settle();
    expect(component.selectedTabIndex()).toBe(2);
    expect(mockSalesApi.getDeliveryNotes).toHaveBeenCalled();
    expect(component.deliveryNotes().length).toBe(1);

    component.dispatchDdt('ddt-1');
    expect(mockSalesApi.dispatchDeliveryNote).toHaveBeenCalledWith('ddt-1');

    component.confirmDdt('ddt-1');
    expect(mockSalesApi.confirmDeliveryNote).toHaveBeenCalledWith('ddt-1');

    component.invoiceDdt('ddt-1');
    expect(mockSalesApi.invoiceDeliveryNote).toHaveBeenCalledWith('ddt-1');
  });

  it('submits delivery note creation', async () => {
    fixture.detectChanges();
    await settle();
    component.openDdtModal('ord-1');
    expect(component.ddtModalVisible()).toBe(true);

    component.ddtForm.patchValue({
      sales_order_id: 'ord-1',
      date: '2026-11-09',
      transport_reason: 'Vendita',
      packages_count: 3,
      gross_weight_kg: 25,
      carrier_name: 'DHL',
    });

    component.submitDdt();
    expect(mockSalesApi.createDeliveryNote).toHaveBeenCalled();
    expect(component.ddtModalVisible()).toBe(false);
  });

  it('does not call the API when the quote, order or delivery note forms are submitted empty', async () => {
    fixture.detectChanges();
    await settle();
    mockSalesApi.createQuote.mockClear();
    mockSalesApi.createOrder.mockClear();
    mockSalesApi.createDeliveryNote.mockClear();
    component.openQuoteModal();
    component.openOrderModal();
    component.openDdtModal();

    component.submitQuote();
    component.submitOrder();
    component.submitDdt();

    expect(mockSalesApi.createQuote).not.toHaveBeenCalled();
    expect(mockSalesApi.createOrder).not.toHaveBeenCalled();
    expect(mockSalesApi.createDeliveryNote).not.toHaveBeenCalled();
    expect(component.quoteForm.controls.contact_id.touched).toBe(true);
  });

  it('filters the quotes by status on the server and names the server key of every calculated column', async () => {
    fixture.detectChanges();
    await settle();

    component.quoteGrid.setFilter({ status: 'approved' });
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mockSalesApi.getQuotes).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'approved', page: 1 }));

    const clientColumn = component['quoteColumns']().find((column) => column.key === 'contact');
    expect(clientColumn?.serverKey).toBe('customer.name');
    const stockColumn = component['orderColumns']().find((column) => column.key === 'inventory_status');
    expect(stockColumn?.valueLabel?.('reserved')).toBe('SC.STATUS.reserved');
    const statusColumn = component['quoteColumns']().find((column) => column.key === 'status');
    expect(statusColumn?.valueLabel?.('pending_approval')).toBe('SALES.LBL_IN_APPROVAZIONE');
  });
});
