import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  SctCrossBorder,
  SctDashboard,
  SctDashboardFilters,
  SctDeliveryPayload,
  SctEnvelope,
  SctExportFormat,
  SctLookups,
  SctMovementPayload,
  SctOrder,
  SctOrderFilters,
  SctOrderPayload,
  SctProductionPayload,
  SctReceiptPayload,
  SctReceiptPlan,
  SctRegisterFilters,
  SctRegisterLine,
} from '../models';

type Envelope<T> = Observable<SctEnvelope<T>>;

/** Endpoints of the subcontracting module (Mod 065): conto lavoro passivo and attivo, stock at partners, statutory register. */
@Service()
export class SubcontractingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/subcontracting`;

  getLookups(): Envelope<SctLookups> {
    return this.http.get<SctEnvelope<SctLookups>>(`${this.base}/lookups`);
  }

  // --- Dashboard, register, cross-border ---

  getDashboard(filters: SctDashboardFilters = {}): Envelope<SctDashboard> {
    return this.http.get<SctEnvelope<SctDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams(filters),
    });
  }

  getRegister(filters: SctRegisterFilters = {}): Envelope<SctRegisterLine[]> {
    return this.http.get<SctEnvelope<SctRegisterLine[]>>(`${this.base}/register`, {
      params: toHttpParams(filters),
    });
  }

  exportRegister(
    format: SctExportFormat,
    filters: Omit<SctRegisterFilters, 'per_page' | 'page'> = {},
  ): Observable<Blob> {
    return this.http.get(`${this.base}/register/export/${format}`, {
      params: toHttpParams(filters),
      responseType: 'blob',
    });
  }

  getCrossBorder(customsRegime?: string): Envelope<SctCrossBorder> {
    return this.http.get<SctEnvelope<SctCrossBorder>>(`${this.base}/cross-border`, {
      params: toHttpParams({ customs_regime: customsRegime }),
    });
  }

  // --- Orders ---

  listOrders(filters: SctOrderFilters = {}): Envelope<SctOrder[]> {
    return this.http.get<SctEnvelope<SctOrder[]>>(`${this.base}/orders`, {
      params: toHttpParams(filters),
    });
  }

  getOrder(id: string): Envelope<SctOrder> {
    return this.http.get<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}`);
  }

  createOrder(payload: SctOrderPayload): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders`, payload);
  }

  confirmOrder(id: string): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/confirm`, {});
  }

  cancelOrder(id: string): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/cancel`, {});
  }

  // --- Passive flow ---

  dispatchMaterials(id: string, payload: SctMovementPayload = {}): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/dispatch`, payload);
  }

  previewReceipt(id: string, payload: SctReceiptPayload): Envelope<SctReceiptPlan> {
    return this.http.post<SctEnvelope<SctReceiptPlan>>(
      `${this.base}/orders/${id}/receive-preview`,
      payload,
    );
  }

  receiveGoods(id: string, payload: SctReceiptPayload): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/receive`, payload);
  }

  returnUnused(id: string, payload: SctMovementPayload = {}): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/return-unused`, payload);
  }

  // --- Active flow ---

  receiveCustomerMaterials(id: string, payload: SctMovementPayload = {}): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(
      `${this.base}/orders/${id}/receive-customer-materials`,
      payload,
    );
  }

  recordProduction(id: string, payload: SctProductionPayload): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/production`, payload);
  }

  deliverGoods(id: string, payload: SctDeliveryPayload = {}): Envelope<SctOrder> {
    return this.http.post<SctEnvelope<SctOrder>>(`${this.base}/orders/${id}/deliver`, payload);
  }
}
