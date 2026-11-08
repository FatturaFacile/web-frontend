import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreatePurchaseOrderPayload,
  CreateRequisitionPayload,
  ExecuteThreeWayMatchPayload,
  GoodsReceipt,
  GoodsReceiptInspectionStatus,
  PaginatedResponse,
  ProcessGoodsReceiptPayload,
  PurchaseOrder,
  PurchaseOrderFilterParams,
  Requisition,
  RequisitionFilterParams,
  SupplierInvoice,
  ThreeWayMatchLog,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class ProcurementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/procurement`;
  private readonly purchasesUrl = `${environment.apiBaseUrl}/purchases`;

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

  getGoodsReceipts(filters?: { page?: number; per_page?: number; search?: string }): Observable<PaginatedResponse<GoodsReceipt>> {
    return this.http.get<PaginatedResponse<GoodsReceipt>>(`${this.baseUrl}/goods-receipts`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  processGoodsReceipt(orderId: string, payload: ProcessGoodsReceiptPayload): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.post<ApiResponse<GoodsReceipt>>(`${this.baseUrl}/purchase-orders/${orderId}/goods-receipt`, payload);
  }

  inspectGoodsReceipt(id: string, status: GoodsReceiptInspectionStatus, notes?: string): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.post<ApiResponse<GoodsReceipt>>(`${this.baseUrl}/goods-receipts/${id}/inspection`, {
      inspection_status: status,
      notes,
    });
  }

  // --- Three-Way Matching ---

  getThreeWayMatches(filters?: { page?: number; per_page?: number; status?: string }): Observable<PaginatedResponse<ThreeWayMatchLog>> {
    return this.http.get<PaginatedResponse<ThreeWayMatchLog>>(`${this.baseUrl}/three-way-match`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  executeThreeWayMatch(payload: ExecuteThreeWayMatchPayload): Observable<ApiResponse<ThreeWayMatchLog>> {
    return this.http.post<ApiResponse<ThreeWayMatchLog>>(`${this.baseUrl}/three-way-match/execute`, payload);
  }

  approveThreeWayMatchVariance(id: string, notes?: string): Observable<ApiResponse<ThreeWayMatchLog>> {
    return this.http.post<ApiResponse<ThreeWayMatchLog>>(`${this.baseUrl}/three-way-match/${id}/approve-variance`, { notes });
  }

  // --- AP Supplier Invoices ---

  getSupplierInvoices(filters?: { page?: number; per_page?: number; search?: string }): Observable<PaginatedResponse<SupplierInvoice>> {
    return this.http.get<PaginatedResponse<SupplierInvoice>>(`${this.purchasesUrl}/supplier-invoices`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  markSupplierInvoicePaid(id: string): Observable<ApiResponse<SupplierInvoice>> {
    return this.http.post<ApiResponse<SupplierInvoice>>(`${this.purchasesUrl}/supplier-invoices/${id}/mark-paid`, {});
  }

  importPassiveInvoiceSdi(xmlContent: string): Observable<ApiResponse<{ invoice_id: string; message: string }>> {
    return this.http.post<ApiResponse<{ invoice_id: string; message: string }>>(`${this.purchasesUrl}/passive-invoices/import-sdi`, {
      xml_content: xmlContent,
    });
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
