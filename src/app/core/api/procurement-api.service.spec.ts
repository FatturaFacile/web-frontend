import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  CreatePurchaseOrderPayload,
  ExecuteThreeWayMatchPayload,
  ProcessGoodsReceiptPayload,
  ProcurementApiService,
  PurchaseOrder,
} from '@core';

describe('ProcurementApiService', () => {
  let service: ProcurementApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/procurement`;
  const purchasesUrl = `${environment.apiBaseUrl}/purchases`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProcurementApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ProcurementApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('fetches purchase orders list with pagination and filters', () => {
    service.getPurchaseOrders({ page: 2, per_page: 15, status: 'approved' }).subscribe((res) => {
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });

    const req = httpTesting.expectOne((r) => r.url === `${baseUrl}/purchase-orders` && r.params.get('page') === '2');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('approved');
    req.flush({ success: true, message: 'OK', data: [{ id: 'po-1' }], meta: { current_page: 2, per_page: 15, total: 1 } });
  });

  it('creates purchase order successfully', () => {
    const payload: CreatePurchaseOrderPayload = {
      supplier_id: 'sup-1',
      supplier_name: 'Vendor SRL',
      currency: 'EUR',
      issue_date: '2026-11-09',
      items: [{ description: 'Raw materials', quantity: 10, unit_price: 50 }],
    };

    service.createPurchaseOrder(payload).subscribe((res) => {
      expect(res.data.id).toBe('po-created');
    });

    const req = httpTesting.expectOne(`${baseUrl}/purchase-orders`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, message: 'Created', data: { id: 'po-created', ...payload } as PurchaseOrder });
  });

  it('executes purchase order lifecycle actions (submit, approve, reject, send, cancel, close)', () => {
    service.submitApproval('po-1').subscribe();
    const reqSubmit = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/submit-approval`);
    expect(reqSubmit.request.method).toBe('POST');
    reqSubmit.flush({ success: true, message: 'Submitted', data: {} });

    service.approvePurchaseOrder('po-1').subscribe();
    const reqApprove = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/approve`);
    expect(reqApprove.request.method).toBe('POST');
    reqApprove.flush({ success: true, message: 'Approved', data: {} });

    service.rejectPurchaseOrder('po-1', 'Price too high').subscribe();
    const reqReject = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/reject`);
    expect(reqReject.request.body).toEqual({ reason: 'Price too high' });
    reqReject.flush({ success: true, message: 'Rejected', data: {} });

    service.sendPurchaseOrder('po-1').subscribe();
    const reqSend = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/send`);
    expect(reqSend.request.method).toBe('POST');
    reqSend.flush({ success: true, message: 'Sent', data: {} });

    service.cancelPurchaseOrder('po-1').subscribe();
    const reqCancel = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/cancel`);
    expect(reqCancel.request.method).toBe('POST');
    reqCancel.flush({ success: true, message: 'Cancelled', data: {} });

    service.closePurchaseOrder('po-1').subscribe();
    const reqClose = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/close`);
    expect(reqClose.request.method).toBe('POST');
    reqClose.flush({ success: true, message: 'Closed', data: {} });
  });

  it('processes goods receipt for a purchase order', () => {
    const payload: ProcessGoodsReceiptPayload = {
      supplier_delivery_note_ref: 'DDT-2026-999',
      received_date: '2026-11-09',
      inspection_required: true,
      inspection_status: 'passed',
      lines: [
        {
          purchase_order_line_id: 'line-1',
          quantity_received: 10,
          quantity_accepted: 10,
          lot_number: 'LOT-A1',
        },
      ],
    };

    service.processGoodsReceipt('po-1', payload).subscribe((res) => {
      expect(res.data.receipt_number).toBe('GRN-2026-001');
    });

    const req = httpTesting.expectOne(`${baseUrl}/purchase-orders/po-1/goods-receipt`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ success: true, message: 'Goods receipt processed', data: { id: 'grn-1', receipt_number: 'GRN-2026-001' } });
  });

  it('executes three-way match and variance approval', () => {
    const payload: ExecuteThreeWayMatchPayload = {
      purchase_order_id: 'po-1',
      purchase_receipt_id: 'grn-1',
      passive_invoice_id: 'inv-pass-1',
      invoice_total_amount: 500,
    };

    service.executeThreeWayMatch(payload).subscribe((res) => {
      expect(res.data.status).toBe('matched');
    });

    const reqMatch = httpTesting.expectOne(`${baseUrl}/three-way-match/execute`);
    expect(reqMatch.request.method).toBe('POST');
    expect(reqMatch.request.body).toEqual(payload);
    reqMatch.flush({ success: true, message: 'Matched', data: { id: 'twm-1', status: 'matched' } });

    service.approveThreeWayMatchVariance('twm-1', 'Variance tolerated within 1%').subscribe((res) => {
      expect(res.data.id).toBe('twm-1');
    });

    const reqVar = httpTesting.expectOne(`${baseUrl}/three-way-match/twm-1/approve-variance`);
    expect(reqVar.request.method).toBe('POST');
    expect(reqVar.request.body).toEqual({ notes: 'Variance tolerated within 1%' });
    reqVar.flush({ success: true, message: 'Variance approved', data: { id: 'twm-1' } });
  });

  it('manages supplier invoices and electronic imports', () => {
    service.getSupplierInvoices().subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });

    const reqList = httpTesting.expectOne(`${purchasesUrl}/supplier-invoices`);
    expect(reqList.request.method).toBe('GET');
    reqList.flush({ success: true, message: 'OK', data: [{ id: 'si-1', invoice_number: 'FAT-99' }], meta: { total: 1 } });

    service.markSupplierInvoicePaid('si-1').subscribe((res) => {
      expect(res.data.id).toBe('si-1');
    });

    const reqPaid = httpTesting.expectOne(`${purchasesUrl}/supplier-invoices/si-1/mark-paid`);
    expect(reqPaid.request.method).toBe('POST');
    reqPaid.flush({ success: true, message: 'Marked paid', data: { id: 'si-1' } });

    service.importPassiveInvoiceSdi('<xml/>').subscribe((res) => {
      expect(res.data.invoice_id).toBe('si-imported');
    });

    const reqSdi = httpTesting.expectOne(`${purchasesUrl}/passive-invoices/import-sdi`);
    expect(reqSdi.request.method).toBe('POST');
    reqSdi.flush({ success: true, message: 'Imported', data: { invoice_id: 'si-imported', message: 'Success' } });
  });
});
