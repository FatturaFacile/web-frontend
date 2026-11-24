import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toHttpParams } from '@core/http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '@core/models';
import {
  CreateDropshipPayload,
  DispatchPurchaseOrderPayload,
  Dropshipment,
  DropshipFilters,
  IssueDdtPayload,
  OverdueOrderRow,
  PricingPreview,
  PricingPreviewPayload,
  PurchaseOrderConfirmation,
  PurchaseOrderDispatch,
  PurchaseOrderReminder,
  RecordDeliveryPayload,
  StoreConfirmationPayload,
} from '@domain/procurement/purchase-order-fulfilment.models';
import { environment } from '@env';
import { map, Observable } from 'rxjs';

/**
 * Typed HTTP gateway for Mod 046: purchase order dispatch, supplier confirmations, overdue reminders,
 * pricing preview and the dropshipment (triangulation) flow. Single resources are returned unwrapped by the API,
 * collections arrive in a `data` envelope.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseOrderFulfilmentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/procurement`;

  // --- Dispatch ---

  dispatch(orderId: string, payload: DispatchPurchaseOrderPayload): Observable<PurchaseOrderDispatch> {
    return this.http.post<PurchaseOrderDispatch>(`${this.base}/purchase-orders/${orderId}/dispatch`, payload);
  }

  listDispatches(orderId: string): Observable<PurchaseOrderDispatch[]> {
    return this.http
      .get<ApiResponse<PurchaseOrderDispatch[]>>(`${this.base}/purchase-orders/${orderId}/dispatches`)
      .pipe(map((res) => res.data ?? []));
  }

  // --- Supplier confirmations ---

  recordConfirmation(orderId: string, payload: StoreConfirmationPayload): Observable<PurchaseOrderConfirmation> {
    return this.http.post<PurchaseOrderConfirmation>(`${this.base}/purchase-orders/${orderId}/confirmations`, payload);
  }

  listConfirmations(orderId: string): Observable<PurchaseOrderConfirmation[]> {
    return this.http
      .get<ApiResponse<PurchaseOrderConfirmation[]>>(`${this.base}/purchase-orders/${orderId}/confirmations`)
      .pipe(map((res) => res.data ?? []));
  }

  // --- Overdue orders and reminders ---

  listOverdue(): Observable<OverdueOrderRow[]> {
    return this.http.get<ApiResponse<OverdueOrderRow[]>>(`${this.base}/purchase-orders/overdue`).pipe(map((res) => res.data ?? []));
  }

  sendReminder(orderId: string): Observable<PurchaseOrderReminder> {
    return this.http.post<PurchaseOrderReminder>(`${this.base}/purchase-orders/${orderId}/reminders`, {});
  }

  listReminders(orderId: string): Observable<PurchaseOrderReminder[]> {
    return this.http
      .get<ApiResponse<PurchaseOrderReminder[]>>(`${this.base}/purchase-orders/${orderId}/reminders`)
      .pipe(map((res) => res.data ?? []));
  }

  /** Sends every reminder that is currently due; resolves the number of reminders sent. */
  runReminders(): Observable<number> {
    return this.http.post<{ sent: number }>(`${this.base}/purchase-orders/reminders/run`, {}).pipe(map((res) => res.sent ?? 0));
  }

  // --- Pricing ---

  pricingPreview(payload: PricingPreviewPayload): Observable<PricingPreview> {
    return this.http.post<ApiResponse<PricingPreview>>(`${this.base}/purchase-orders/pricing-preview`, payload).pipe(map((res) => res.data));
  }

  // --- Dropshipment ---

  listDropshipments(filters?: DropshipFilters): Observable<PaginatedResponse<Dropshipment>> {
    return this.http.get<PaginatedResponse<Dropshipment>>(`${this.base}/dropshipments`, {
      params: filters ? toHttpParams({ ...filters }) : undefined,
    });
  }

  getDropshipment(id: string): Observable<Dropshipment> {
    return this.http.get<Dropshipment>(`${this.base}/dropshipments/${id}`);
  }

  createDropshipment(payload: CreateDropshipPayload): Observable<Dropshipment> {
    return this.http.post<Dropshipment>(`${this.base}/dropshipments`, payload);
  }

  issueDdt(id: string, payload: IssueDdtPayload): Observable<Dropshipment> {
    return this.http.post<Dropshipment>(`${this.base}/dropshipments/${id}/ddt`, payload);
  }

  recordDelivery(id: string, payload: RecordDeliveryPayload): Observable<Dropshipment> {
    return this.http.post<Dropshipment>(`${this.base}/dropshipments/${id}/deliveries`, payload);
  }
}
