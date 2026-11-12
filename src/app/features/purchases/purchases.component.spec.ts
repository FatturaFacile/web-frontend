import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  AuthStore,
  GoodsReceipt,
  ProcurementApiService,
  PurchaseOrder,
  SupplierInvoice,
  ThreeWayMatchLog,
} from '@core';
import { PurchasesComponent } from './purchases.component';

describe('PurchasesComponent', () => {
  let fixture: ComponentFixture<PurchasesComponent>;
  let component: PurchasesComponent;
  let procurementApiMock: Partial<ProcurementApiService>;
  let messageMock: Partial<NzMessageService>;
  let authStoreMock: Partial<AuthStore>;

  const mockOrder: PurchaseOrder = {
    id: 'po-1',
    po_number: 'PO-2026-0001',
    supplier_id: 'sup-1',
    status: 'sent',
    order_type: 'standard',
    order_date: '2026-11-09',
    expected_delivery_date: '2026-11-30',
    currency: 'EUR',
    exchange_rate: '1.000000',
    net_amount: '1000.00',
    tax_amount: '220.00',
    total_amount: '1220.00',
    is_budget_encumbered: false,
    budget_committed_amount: '0.00',
    is_locked: false,
    supplier: { id: 'sup-1', supplier_code: 'SUP-1', company_name: 'Acme Supplies' },
    lines: [
      {
        id: 'line-1',
        line_number: 1,
        description: 'Material X',
        quantity_ordered: '10.0000',
        quantity_received: '0.0000',
        quantity_returned: '0.0000',
        quantity_invoiced: '0.0000',
        uom: 'PZ',
        unit_price: '100.0000',
        tax_rate: '22.00',
        line_net_amount: '1000.00',
        line_tax_amount: '220.00',
        line_total_amount: '1220.00',
        is_closed: false,
      },
    ],
  };

  const mockReceipt: GoodsReceipt = {
    id: 'grn-1',
    receipt_number: 'GRN-2026-0001',
    purchase_order_id: 'po-1',
    supplier_delivery_note_ref: 'DDT-991',
    received_date: '2026-11-09',
    inspection_status: 'pending',
    inspection_required: true,
    lines: [
      {
        id: 'grn-line-1',
        purchase_order_line_id: 'line-1',
        quantity_received: '10.0000',
        quantity_accepted: '10.0000',
        quantity_rejected: '0.0000',
        quantity_released: '0.0000',
        quantity_returned: '0.0000',
        inspection_status: 'pending',
      },
    ],
  };

  const mockMatch: ThreeWayMatchLog = {
    id: 'twm-1',
    purchase_order_id: 'po-1',
    purchase_receipt_id: 'grn-1',
    passive_invoice_id: 'si-1',
    match_status: 'price_variance',
    po_total_amount: 1220,
    grn_total_amount: 1220,
    invoice_total_amount: 1270,
    variance_amount: 50,
    variance_percentage: 4.1,
    evaluated_at: '2026-11-09T10:00:00Z',
  };

  const mockInvoice: SupplierInvoice = {
    id: 'si-1',
    invoice_number: 'FAT-2026-88',
    supplier_id: 'sup-1',
    date: '2026-11-09',
    due_date: '2026-12-09',
    currency: 'EUR',
    total_amount: '1281.00',
    payment_status: 'unpaid',
    approval_status: 'not_required',
  };

  beforeEach(() => {
    procurementApiMock = {
      getSuppliers: vi
        .fn()
        .mockReturnValue(of({ data: [{ id: 'sup-1', supplier_code: 'SUP-1', company_name: 'Acme Supplies' }] })),
      getPurchaseOrders: vi.fn().mockReturnValue(of({ data: [mockOrder], meta: { total: 1 } })),
      getPurchaseOrder: vi.fn().mockReturnValue(of({ data: mockOrder })),
      createPurchaseOrder: vi.fn().mockReturnValue(of({ data: mockOrder })),
      submitApproval: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'pending_approval' } })),
      approvePurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'approved' } })),
      rejectPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'rejected' } })),
      sendPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'sent' } })),
      cancelPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'cancelled' } })),
      closePurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'closed' } })),
      reopenPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'received' } })),
      getGoodsReceipts: vi.fn().mockReturnValue(of({ data: [mockReceipt], meta: { total: 1 } })),
      getGoodsReceipt: vi.fn().mockReturnValue(of({ data: mockReceipt })),
      processGoodsReceipt: vi.fn().mockReturnValue(of({ data: mockReceipt })),
      inspectGoodsReceipt: vi.fn().mockReturnValue(of({ data: mockReceipt })),
      getThreeWayMatches: vi.fn().mockReturnValue(of({ data: [mockMatch], meta: { total: 1 } })),
      executeThreeWayMatch: vi.fn().mockReturnValue(of({ data: mockMatch })),
      approveThreeWayMatchVariance: vi.fn().mockReturnValue(of({ data: { ...mockMatch, match_status: 'matched' } })),
      getSupplierInvoices: vi.fn().mockReturnValue(of({ data: [mockInvoice], meta: { total: 1 } })),
      markSupplierInvoicePaid: vi.fn().mockReturnValue(of({ data: { ...mockInvoice, payment_status: 'paid' } })),
      submitSupplierInvoiceApproval: vi.fn().mockReturnValue(of({ data: { invoice_id: 'si-1', approval_status: 'pending' } })),
      receivePassiveInvoiceXml: vi
        .fn()
        .mockReturnValue(of({ data: [{ duplicate: false, invoice: mockInvoice }, { duplicate: true, invoice: mockInvoice }] })),
    };

    messageMock = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    };

    authStoreMock = {
      activeJurisdiction: vi.fn().mockReturnValue('IT'),
      activeCurrency: vi.fn().mockReturnValue('EUR'),
    };

    TestBed.configureTestingModule({
      imports: [PurchasesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: ProcurementApiService, useValue: procurementApiMock },
        { provide: NzMessageService, useValue: messageMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    });

    fixture = TestBed.createComponent(PurchasesComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      config.nzOnOk?.();
      return {} as NzModalRef;
    });
    fixture.detectChanges();
  });

  it('creates the component and loads initial procurement data', () => {
    expect(component).toBeTruthy();
    expect(procurementApiMock.getSuppliers).toHaveBeenCalled();
    expect(procurementApiMock.getPurchaseOrders).toHaveBeenCalled();
    expect(procurementApiMock.getGoodsReceipts).toHaveBeenCalled();
    expect(procurementApiMock.getThreeWayMatches).toHaveBeenCalled();
    expect(procurementApiMock.getSupplierInvoices).toHaveBeenCalled();
    expect(component.orders()).toHaveLength(1);
    expect(component.goodsReceipts()).toHaveLength(1);
    expect(component.supplierName(mockOrder)).toBe('Acme Supplies');
  });

  it('filters orders by the current statuses and supplier', () => {
    component.onStatusChange('partially_received');
    component.onSupplierChange('sup-1');
    expect(procurementApiMock.getPurchaseOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'partially_received', supplier_id: 'sup-1' }),
    );
    expect(component['orderStatuses']).toContain('sent');
    expect(component['orderStatuses']).not.toContain('ordered' as never);
  });

  it('offers the actions that match the order status', () => {
    expect(component.canReceive({ ...mockOrder, status: 'sent' })).toBe(true);
    expect(component.canReceive({ ...mockOrder, status: 'partially_received' })).toBe(true);
    expect(component.canReceive({ ...mockOrder, status: 'approved' })).toBe(false);
    expect(component.canReceive({ ...mockOrder, status: 'received' })).toBe(false);
    expect(component.canCancel({ ...mockOrder, status: 'received' })).toBe(false);
  });

  it('submits purchase order for approval', () => {
    component.submitApproval(mockOrder);
    expect(procurementApiMock.submitApproval).toHaveBeenCalledWith('po-1');
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('approves a purchase order and rejects it only with a reason', () => {
    component.approve(mockOrder);
    expect(procurementApiMock.approvePurchaseOrder).toHaveBeenCalledWith('po-1');

    component.reject(mockOrder);
    component.confirmReason();
    expect(procurementApiMock.rejectPurchaseOrder).not.toHaveBeenCalled();

    component.reasonText.set('Price above budget');
    component.confirmReason();
    expect(procurementApiMock.rejectPurchaseOrder).toHaveBeenCalledWith('po-1', 'Price above budget');
    expect(component.reasonRequest()).toBeNull();
  });

  it('sends, cancels, closes and reopens an order', () => {
    component.sendToSupplier(mockOrder);
    expect(procurementApiMock.sendPurchaseOrder).toHaveBeenCalledWith('po-1');

    component.cancelOrder(mockOrder);
    expect(procurementApiMock.cancelPurchaseOrder).toHaveBeenCalledWith('po-1');

    component.closeOrder({ ...mockOrder, status: 'received' });
    expect(procurementApiMock.closePurchaseOrder).toHaveBeenCalledWith('po-1');

    component.reopenOrder({ ...mockOrder, status: 'closed' });
    expect(procurementApiMock.reopenPurchaseOrder).toHaveBeenCalledWith('po-1');
  });

  it('creates a purchase order for a supplier of the catalog', () => {
    component.openCreateModal();
    expect(component.createModalVisible()).toBe(true);

    component.orderForm.patchValue({
      supplier_id: 'sup-1',
      currency: 'EUR',
      expected_delivery_date: new Date(2026, 11, 15),
      item_description: 'Widget A',
      quantity: 5,
      unit_price: 20,
      tax_rate: 22,
    });

    component.submitCreateOrder();
    expect(procurementApiMock.createPurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier_id: 'sup-1',
        expected_delivery_date: '2026-12-15',
        lines: [{ description: 'Widget A', quantity_ordered: 5, unit_price: 20, tax_rate: 22 }],
      }),
    );
    expect(component.createModalVisible()).toBe(false);
  });

  it('does not create a purchase order from an empty form', () => {
    component.openCreateModal();
    component.orderForm.reset({ currency: 'EUR', quantity: 1, unit_price: 0, tax_rate: 22 });

    component.submitCreateOrder();

    expect(procurementApiMock.createPurchaseOrder).not.toHaveBeenCalled();
    expect(component.tip(component.orderForm.controls.supplier_id)).not.toBe('');
  });

  it('registers a goods receipt line by line for a sent purchase order', () => {
    component.openGoodsReceiptModal(mockOrder);
    expect(procurementApiMock.getPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(component.goodsReceiptModalVisible()).toBe(true);
    expect(component.receiptLines.length).toBe(1);

    component.receiptForm.patchValue({ supplier_delivery_note_ref: 'DDT-1234' });
    component.submitGoodsReceipt();
    expect(procurementApiMock.processGoodsReceipt).not.toHaveBeenCalled();
    expect(messageMock.warning).toHaveBeenCalled();

    component.receiptLines.at(0).patchValue({ quantity_received: 10, lot_number: 'L1' });
    component.submitGoodsReceipt();
    expect(procurementApiMock.processGoodsReceipt).toHaveBeenCalledWith(
      'po-1',
      expect.objectContaining({
        supplier_delivery_note_ref: 'DDT-1234',
        lines: [{ purchase_order_line_id: 'line-1', quantity_received: 10, lot_number: 'L1' }],
      }),
    );
    expect(component.goodsReceiptModalVisible()).toBe(false);
  });

  it('records the released quantity of each receipt line', () => {
    component.openInspectModal(mockReceipt);
    expect(component.inspectModalVisible()).toBe(true);
    expect(component.inspectLines.at(0).value.quantity_released).toBe(10);

    component.inspectLines.at(0).patchValue({ quantity_released: 8, notes: 'Two units damaged' });
    component.submitInspection();
    expect(procurementApiMock.inspectGoodsReceipt).toHaveBeenCalledWith('grn-1', {
      results: [{ purchase_receipt_line_id: 'grn-line-1', quantity_released: 8, notes: 'Two units damaged' }],
    });
    expect(component.inspectModalVisible()).toBe(false);
  });

  it('executes 3-way match and approves the variance with a reason', () => {
    component.openExecuteMatchModal();
    component.matchForm.patchValue({
      purchase_order_id: 'po-1',
      purchase_receipt_id: 'grn-1',
      passive_invoice_id: 'si-1',
      invoice_total_amount: 1220,
    });

    component.submitExecuteMatch();
    expect(procurementApiMock.executeThreeWayMatch).toHaveBeenCalled();
    expect(component.executeMatchModalVisible()).toBe(false);

    expect(component.hasOpenVariance(mockMatch)).toBe(true);
    component.approveVariance(mockMatch);
    component.reasonText.set('Within agreed tolerance');
    component.confirmReason();
    expect(procurementApiMock.approveThreeWayMatchVariance).toHaveBeenCalledWith('twm-1', {
      reason: 'Within agreed tolerance',
    });
  });

  it('keeps the payment of a blocked supplier invoice closed and offers the approval flow', () => {
    const blocked: SupplierInvoice = { ...mockInvoice, approval_status: 'match_blocked' };
    expect(component.isPaymentBlocked(blocked)).toBe(true);
    expect(component.canSubmitInvoiceApproval(blocked)).toBe(false);
    expect(component.isPaymentBlocked(mockInvoice)).toBe(false);
    expect(component.canSubmitInvoiceApproval(mockInvoice)).toBe(true);

    component.submitInvoiceApproval(mockInvoice);
    expect(procurementApiMock.submitSupplierInvoiceApproval).toHaveBeenCalledWith('si-1');
  });

  it('marks supplier invoice as paid and uploads a received XML file', () => {
    component.markInvoicePaid(mockInvoice);
    expect(procurementApiMock.markSupplierInvoicePaid).toHaveBeenCalledWith('si-1');

    component.openImportSdiModal();
    expect(component.importSdiModalVisible()).toBe(true);

    const file = new File(['<FatturaElettronica></FatturaElettronica>'], 'IT123.xml', { type: 'text/xml' });
    component.selectedXmlFile.set(file);
    component.submitImportSdi();
    expect(procurementApiMock.receivePassiveInvoiceXml).toHaveBeenCalledWith(file);
    expect(component.importSdiModalVisible()).toBe(false);
  });
});
