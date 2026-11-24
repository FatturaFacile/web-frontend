import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  GoodsReceipt,
  PaginatedResponse,
  PurchaseOrder,
  PurchaseOrderFilterParams,
  SupplierInvoice,
} from '../models';

export interface PurchaseOrderLinePayload {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export interface PurchaseOrderPayload {
  supplier_id: string;
  date: string;
  delivery_due_date?: string | null;
  currency: string;
  notes?: string | null;
  items: PurchaseOrderLinePayload[];
}

export interface PurchasesCostRule {
  id: string;
  supplier_id: string;
  keyword?: string | null;
  cost_account_id: string;
}

export interface PurchasesCostRulePayload {
  supplier_id: string;
  keyword?: string | null;
  cost_account_id: string;
}

export interface PurchasesCostAccountPayload {
  cost_account_id: string;
  line_ids?: string[];
}

export interface PurchasesSelfInvoicePayload {
  document_type: string;
  date: string;
  tax_rate: number;
  vat_nature?: string | null;
  description?: string | null;
  notes?: string | null;
}

export type PurchasesPain001Format = 'sepa_pain_001_it' | 'iso_pain_001_ch';

export interface PurchasesPain001Payload {
  invoice_ids: string[];
  format: PurchasesPain001Format;
  execution_date?: string | null;
  bank_account_id?: string | null;
}

export type PurchasesRecord = Record<string, unknown>;
type PurchasesQuery = Record<string, string | number | boolean>;

/** `/purchases/*` endpoints of the Procurement area: orders, goods receipts, passive invoices, cost rules, payment files. */
@Service()
export class PurchasesExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/purchases`;

  getRequests(params?: PurchasesQuery): Observable<PaginatedResponse<PurchasesRecord>> {
    return this.http.get<PaginatedResponse<PurchasesRecord>>(`${this.base}/requests`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // Purchase orders
  getOrders(filters?: PurchaseOrderFilterParams): Observable<PaginatedResponse<PurchaseOrder>> {
    return this.http.get<PaginatedResponse<PurchaseOrder>>(`${this.base}/orders`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.get<ApiResponse<PurchaseOrder>>(`${this.base}/orders/${id}`);
  }

  createOrder(payload: PurchaseOrderPayload): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.base}/orders`, payload);
  }

  updateOrder(id: string, payload: Partial<PurchaseOrderPayload>): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.put<ApiResponse<PurchaseOrder>>(`${this.base}/orders/${id}`, payload);
  }

  confirmOrder(id: string): Observable<ApiResponse<PurchaseOrder>> {
    return this.http.post<ApiResponse<PurchaseOrder>>(`${this.base}/orders/${id}/confirm`, {});
  }

  receiveOrder(id: string, payload: PurchasesRecord = {}): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.post<ApiResponse<GoodsReceipt>>(`${this.base}/orders/${id}/receive`, payload);
  }

  // Goods receipts
  getGoodsReceipts(params?: PurchasesQuery): Observable<PaginatedResponse<GoodsReceipt>> {
    return this.http.get<PaginatedResponse<GoodsReceipt>>(`${this.base}/goods-receipts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getGoodsReceipt(id: string): Observable<ApiResponse<GoodsReceipt>> {
    return this.http.get<ApiResponse<GoodsReceipt>>(`${this.base}/goods-receipts/${id}`);
  }

  // Passive invoices and supplier invoices
  getPassiveInvoices(params?: PurchasesQuery): Observable<PaginatedResponse<SupplierInvoice>> {
    return this.http.get<PaginatedResponse<SupplierInvoice>>(`${this.base}/passive-invoices`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSupplierInvoice(id: string): Observable<ApiResponse<SupplierInvoice>> {
    return this.http.get<ApiResponse<SupplierInvoice>>(`${this.base}/supplier-invoices/${id}`);
  }

  getSupplierInvoiceLines(id: string): Observable<ApiResponse<PurchasesRecord[]>> {
    return this.http.get<ApiResponse<PurchasesRecord[]>>(`${this.base}/supplier-invoices/${id}/lines`);
  }

  overrideCostAccount(id: string, payload: PurchasesCostAccountPayload): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.base}/supplier-invoices/${id}/cost-account`, payload);
  }

  updateLineCompetence(
    id: string,
    lineId: string,
    payload: { competence_start_date: string | null; competence_end_date: string | null },
  ): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(
      `${this.base}/supplier-invoices/${id}/lines/${lineId}/competence`,
      payload,
    );
  }

  selfInvoice(passiveInvoiceId: string, payload: PurchasesSelfInvoicePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/passive-invoices/${passiveInvoiceId}/self-invoice`, payload);
  }

  // Cost-account rules
  getCostRules(): Observable<ApiResponse<PurchasesCostRule[]>> {
    return this.http.get<ApiResponse<PurchasesCostRule[]>>(`${this.base}/cost-rules`);
  }

  createCostRule(payload: PurchasesCostRulePayload): Observable<ApiResponse<PurchasesCostRule>> {
    return this.http.post<ApiResponse<PurchasesCostRule>>(`${this.base}/cost-rules`, payload);
  }

  deleteCostRule(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/cost-rules/${id}`);
  }

  // Supplier payment file
  exportPain001(payload: PurchasesPain001Payload): Observable<ApiResponse<PurchasesRecord>> {
    return this.http.post<ApiResponse<PurchasesRecord>>(`${this.base}/export-pain001`, payload);
  }
}
