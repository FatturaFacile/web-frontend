import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreatePurchaseOrderPayload,
  CreateRequisitionPayload,
  PaginatedResponse,
  PurchaseOrder,
  PurchaseOrderFilterParams,
  Requisition,
  RequisitionFilterParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class ProcurementApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/procurement`;

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
