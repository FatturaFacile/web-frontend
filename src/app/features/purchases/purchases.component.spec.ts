import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
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
    order_number: 'PO-2026-0001',
    supplier_id: 'sup-1',
    supplier_name: 'Acme Supplies',
    channel: 'Standard',
    status: 'draft',
    issue_date: '2026-11-09',
    currency: 'EUR',
    subtotal: 1000,
    tax_amount: 220,
    total: 1220,
    items: [
      {
        id: 'line-1',
        description: 'Material X',
        quantity: 10,
        unit_price: 100,
        tax_rate: 22,
        total: 1000,
      },
    ],
  };

  const mockReceipt: GoodsReceipt = {
    id: 'grn-1',
    receipt_number: 'GRN-2026-0001',
    purchase_order_id: 'po-1',
    supplier_delivery_note_ref: 'DDT-991',
    received_date: '2026-11-09',
    inspection_status: 'passed',
    inspection_required: true,
    lines: [
      {
        purchase_order_line_id: 'line-1',
        quantity_received: 10,
        quantity_accepted: 10,
      },
    ],
  };

  const mockMatch: ThreeWayMatchLog = {
    id: 'twm-1',
    purchase_order_id: 'po-1',
    supplier_id: 'sup-1',
    status: 'discrepancy',
    price_variance: 50,
    quantity_variance: 0,
  };

  const mockInvoice: SupplierInvoice = {
    id: 'si-1',
    invoice_number: 'FAT-2026-88',
    supplier_id: 'sup-1',
    supplier_name: 'Acme Supplies',
    issue_date: '2026-11-09',
    due_date: '2026-12-09',
    currency: 'EUR',
    subtotal: 1050,
    tax_amount: 231,
    total: 1281,
    status: 'pending_approval',
  };

  beforeEach(() => {
    procurementApiMock = {
      getPurchaseOrders: vi.fn().mockReturnValue(of({ data: [mockOrder], meta: { total: 1 } })),
      createPurchaseOrder: vi.fn().mockReturnValue(of({ data: mockOrder })),
      submitApproval: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'pending_approval' } })),
      approvePurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'approved' } })),
      rejectPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'rejected' } })),
      sendPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'sent' } })),
      cancelPurchaseOrder: vi.fn().mockReturnValue(of({ data: { ...mockOrder, status: 'cancelled' } })),
      getGoodsReceipts: vi.fn().mockReturnValue(of({ data: [mockReceipt], meta: { total: 1 } })),
      processGoodsReceipt: vi.fn().mockReturnValue(of({ data: mockReceipt })),
      inspectGoodsReceipt: vi.fn().mockReturnValue(of({ data: mockReceipt })),
      getThreeWayMatches: vi.fn().mockReturnValue(of({ data: [mockMatch], meta: { total: 1 } })),
      executeThreeWayMatch: vi.fn().mockReturnValue(of({ data: mockMatch })),
      approveThreeWayMatchVariance: vi.fn().mockReturnValue(of({ data: { ...mockMatch, status: 'matched' } })),
      getSupplierInvoices: vi.fn().mockReturnValue(of({ data: [mockInvoice], meta: { total: 1 } })),
      markSupplierInvoicePaid: vi.fn().mockReturnValue(of({ data: { ...mockInvoice, status: 'paid' } })),
      importPassiveInvoiceSdi: vi.fn().mockReturnValue(of({ data: { invoice_id: 'si-1', message: 'Import OK' } })),
    };

    messageMock = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
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
    vi.spyOn((component as any).modal, 'confirm').mockImplementation((config: any) => {
      config.nzOnOk?.();
      return {} as any;
    });
    fixture.detectChanges();
  });

  it('creates the component and loads initial procurement data', () => {
    expect(component).toBeTruthy();
    expect(procurementApiMock.getPurchaseOrders).toHaveBeenCalled();
    expect(procurementApiMock.getGoodsReceipts).toHaveBeenCalled();
    expect(procurementApiMock.getThreeWayMatches).toHaveBeenCalled();
    expect(procurementApiMock.getSupplierInvoices).toHaveBeenCalled();
    expect(component.orders()).toHaveLength(1);
    expect(component.goodsReceipts()).toHaveLength(1);
  });

  it('submits purchase order for approval', () => {
    component.submitApproval(mockOrder);
    expect(procurementApiMock.submitApproval).toHaveBeenCalledWith('po-1');
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('approves and rejects purchase order', () => {
    component.approve(mockOrder);
    expect(procurementApiMock.approvePurchaseOrder).toHaveBeenCalledWith('po-1');

    component.reject(mockOrder);
    expect(procurementApiMock.rejectPurchaseOrder).toHaveBeenCalledWith('po-1', expect.any(String));
  });

  it('sends order to supplier and cancels order', () => {
    component.sendToSupplier(mockOrder);
    expect(procurementApiMock.sendPurchaseOrder).toHaveBeenCalledWith('po-1');

    component.cancelOrder(mockOrder);
    expect(procurementApiMock.cancelPurchaseOrder).toHaveBeenCalledWith('po-1');
  });

  it('creates a new purchase order through modal form', () => {
    component.openCreateModal();
    expect(component.createModalVisible()).toBe(true);

    component.orderForm.patchValue({
      supplier_name: 'Test Vendor',
      channel: 'Standard',
      currency: 'EUR',
      item_description: 'Widget A',
      quantity: 5,
      unit_price: 20,
      tax_rate: 22,
    });

    component.submitCreateOrder();
    expect(procurementApiMock.createPurchaseOrder).toHaveBeenCalled();
    expect(component.createModalVisible()).toBe(false);
  });

  it('registers goods receipt for an approved purchase order', () => {
    component.openGoodsReceiptModal(mockOrder);
    expect(component.goodsReceiptModalVisible()).toBe(true);
    expect(component.selectedOrderForReceipt()).toEqual(mockOrder);

    component.receiptForm.patchValue({
      supplier_delivery_note_ref: 'DDT-1234',
      quantity_received: 10,
    });

    component.submitGoodsReceipt();
    expect(procurementApiMock.processGoodsReceipt).toHaveBeenCalledWith('po-1', expect.objectContaining({
      supplier_delivery_note_ref: 'DDT-1234',
    }));
    expect(component.goodsReceiptModalVisible()).toBe(false);
  });

  it('updates inspection status for a goods receipt', () => {
    component.openInspectModal(mockReceipt);
    expect(component.inspectModalVisible()).toBe(true);

    component.inspectForm.patchValue({
      inspection_status: 'passed',
      notes: 'Passed all lab checks',
    });

    component.submitInspection();
    expect(procurementApiMock.inspectGoodsReceipt).toHaveBeenCalledWith('grn-1', 'passed', 'Passed all lab checks');
    expect(component.inspectModalVisible()).toBe(false);
  });

  it('executes 3-way match and approves variance', () => {
    component.openExecuteMatchModal();
    expect(component.executeMatchModalVisible()).toBe(true);

    component.matchForm.patchValue({
      purchase_order_id: 'po-1',
      purchase_receipt_id: 'grn-1',
      passive_invoice_id: 'si-1',
      invoice_total_amount: 1220,
    });

    component.submitExecuteMatch();
    expect(procurementApiMock.executeThreeWayMatch).toHaveBeenCalled();
    expect(component.executeMatchModalVisible()).toBe(false);

    component.approveVariance(mockMatch);
    expect(procurementApiMock.approveThreeWayMatchVariance).toHaveBeenCalledWith('twm-1', expect.any(String));
  });

  it('marks supplier invoice as paid and imports passive SDI xml', () => {
    component.markInvoicePaid(mockInvoice);
    expect(procurementApiMock.markSupplierInvoicePaid).toHaveBeenCalledWith('si-1');

    component.openImportSdiModal();
    expect(component.importSdiModalVisible()).toBe(true);

    component.sdiImportForm.patchValue({
      xml_content: '<FatturaElettronica></FatturaElettronica>',
    });

    component.submitImportSdi();
    expect(procurementApiMock.importPassiveInvoiceSdi).toHaveBeenCalledWith('<FatturaElettronica></FatturaElettronica>');
    expect(component.importSdiModalVisible()).toBe(false);
  });
});
