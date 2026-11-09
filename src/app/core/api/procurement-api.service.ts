import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ApproveThreeWayVariancePayload,
  CreatePurchaseOrderPayload,
  CreateRequisitionPayload,
  ExecuteThreeWayMatchPayload,
  GoodsReceipt,
  InspectGoodsReceiptPayload,
  PaginatedResponse,
  ProcessGoodsReceiptPayload,
  ProcurementSupplier,
  PurchaseOrder,
  PurchaseOrderFilterParams,
  ReceivedPassiveInvoice,
  Requisition,
  RequisitionFilterParams,
  SupplierInvoice,
  SupplierInvoiceApproval,
  ThreeWayMatchLog,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class ProcurementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/procurement`;
  private readonly purchasesUrl = `${environment.apiBaseUrl}/purchases`;

  // --- Suppliers ---

  getSuppliers(filters?: { category_id?: string; sort?: string; page?: number; per_page?: number }): Observable<PaginatedResponse<ProcurementSupplier>> {
    return this.http.get<PaginatedResponse<ProcurementSupplier>>(`${this.baseUrl}/suppliers`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  // --- Purchase Orders ---

  getPurchaseOrders(filters?: PurchaseOrderFilterParams): Observable<PaginatedResponse<PurchaseOrder>> {
    return this.http.get<PaginatedResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getPurchaseOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.get<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}`);
  }

  createPurchaseOrder(payload: CreatePurchaseOrderPayload): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders`, payload);
  }

  submitApproval(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/submit-approval`, {});
  }

  approvePurchaseOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/approve`, {});
  }

  rejectPurchaseOrder(id: string, reason?: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/reject`, { reason });
  }

  sendPurchaseOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/send`, {});
  }

  cancelPurchaseOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/cancel`, {});
  }

  closePurchaseOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/close`, {});
  }

  reopenPurchaseOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.baseUrl}/purchase-orders/${id}/reopen`, {});
  }

  // --- Goods Receipt & Inspection ---

  getGoodsReceipts(filters?: { page?: number; per_page?: number; purchase_order_id?: string }): Observable<PaginatedResponse<GoodsReceipt>> {
    return this.http.get<PaginatedResponse<GoodsReceipt>>(`${this.baseUrl}/goods-receipts`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getGoodsReceipt(id: string): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.get<ApiResponse<GoodsReceipt>>(`${this.baseUrl}/goods-receipts/${id}`);
  }

  processGoodsReceipt(orderId: string, payload: ProcessGoodsReceiptPayload): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.post<ApiResponse<GoodsReceipt>>(`${this.baseUrl}/purchase-orders/${orderId}/goods-receipt`, payload);
  }

  /** Records the quantity released to stock for each line of a receipt that needs inspection. */
  inspectGoodsReceipt(id: string, payload: InspectGoodsReceiptPayload): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.post<ApiResponse<GoodsReceipt>>(`${this.baseUrl}/goods-receipts/${id}/inspection`, payload);
  }

  // --- Three-Way Matching ---

  getThreeWayMatches(filters?: { page?: number; per_page?: number; match_status?: string }): Observable<PaginatedResponse<ThreeWayMatchLog>> {
    return this.http.get<PaginatedResponse<ThreeWayMatchLog>>(`${this.baseUrl}/three-way-match`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  executeThreeWayMatch(payload: ExecuteThreeWayMatchPayload): Observable<ApiResponse<ThreeWayMatchLog>> {
    return this.http.post<ApiResponse<ThreeWayMatchLog>>(`${this.baseUrl}/three-way-match/execute`, payload);
  }

  approveThreeWayMatchVariance(id: string, payload: ApproveThreeWayVariancePayload): Observable<ApiResponse<ThreeWayMatchLog>> {
    return this.http.post<ApiResponse<ThreeWayMatchLog>>(`${this.baseUrl}/three-way-match/${id}/approve-variance`, payload);
  }

  // --- AP Supplier Invoices ---

  getSupplierInvoices(filters?: {
    page?: number;
    per_page?: number;
    supplier_id?: string;
    document_type?: string;
    payment_status?: string;
  }): Observable<PaginatedResponse<SupplierInvoice>> {
    return this.http.get<PaginatedResponse<SupplierInvoice>>(`${this.purchasesUrl}/supplier-invoices`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  markSupplierInvoicePaid(id: string): Observable<ApiResponse<SupplierInvoice>> {
    return this.http.post<ApiResponse<SupplierInvoice>>(`${this.purchasesUrl}/supplier-invoices/${id}/mark-paid`, {});
  }

  /** Uploads a FatturaPA XML received from SDI (multipart, field `file`, max 10 MB) and registers its documents. */
  receivePassiveInvoiceXml(file: File): Observable<ApiResponse<ReceivedPassiveInvoice[]>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ApiResponse<ReceivedPassiveInvoice[]>>(`${this.purchasesUrl}/passive-invoices/receive-xml`, body);
  }

  /** Submits a received invoice to the approval workflow (the cost center is optional). */
  submitSupplierInvoiceApproval(id: string, costCenterId?: string): Observable<ApiResponse<SupplierInvoiceApproval>> {
    return this.http.post<ApiResponse<SupplierInvoiceApproval>>(
      `${this.baseUrl}/supplier-invoices/${id}/submit-approval`,
      costCenterId ? { cost_center_id: costCenterId } : {},
    );
  }

  getSupplierInvoiceApproval(id: string): Observable<ApiResponse<SupplierInvoiceApproval>> {
    return this.http.get<ApiResponse<SupplierInvoiceApproval>>(`${this.baseUrl}/supplier-invoices/${id}/approval`);
  }

  scanPassiveInvoiceQrBill(payload: { qr_text: string }): Observable<ApiResponse<SupplierInvoice>> {
    return this.http.post<ApiResponse<SupplierInvoice>>(`${this.purchasesUrl}/passive-invoices/scan-qr-bill`, payload);
  }

  // --- Requisitions ---

  getRequisitions(filters?: RequisitionFilterParams): Observable<PaginatedResponse<Requisition>> {
    return this.http.get<PaginatedResponse<Requisition>>(`${this.baseUrl}/requisitions`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  createRequisition(payload: CreateRequisitionPayload): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/requisitions`, payload);
  }

  submitRequisitionApproval(id: string): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/requisitions/${id}/submit-approval`, {});
  }

  approveRequisition(id: string): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/requisitions/${id}/approve`, {});
  }

  rejectRequisition(id: string, reason?: string): Observable<ApiResponse<Requisition>> {
    return this.http.post<ApiResponse<Requisition>>(`${this.baseUrl}/requisitions/${id}/reject`, { reason });
  }
}
