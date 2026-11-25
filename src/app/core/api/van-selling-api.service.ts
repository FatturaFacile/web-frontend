import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CustomerFieldDossier,
  FieldRoutePlan,
  Gs1ParseResult,
  OfflineSyncBatchResult,
  ReplenishmentSuggestion,
  ThermalPrintJob,
  VanEodSettlement,
  VanEodSettlementPreview,
  VanLoadManifest,
  VanSectionalBatchReservation,
  VanSellingConfig,
  VanSellingResponse,
  VanVisitOutcome,
  VanVisitOutcomeCreatePayload,
  VanWarehouse,
  VanWarehouseCreatePayload,
} from '../models/van-selling.model';

/** API client for Mod 233: Van Selling (Tentata Vendita) & Offline Field Sales. */
@Injectable({ providedIn: 'root' })
export class VanSellingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/van-selling`;

  getConfig(): Observable<VanSellingResponse<VanSellingConfig>> {
    return this.http.get<VanSellingResponse<VanSellingConfig>>(`${this.base}/config`);
  }

  getVans(): Observable<VanSellingResponse<VanWarehouse[]>> {
    return this.http.get<VanSellingResponse<VanWarehouse[]>>(`${this.base}/vans`);
  }

  createVan(payload: VanWarehouseCreatePayload): Observable<VanSellingResponse<VanWarehouse>> {
    return this.http.post<VanSellingResponse<VanWarehouse>>(`${this.base}/vans`, payload);
  }

  recordTemperature(
    vanId: string,
    tempCelsius: number,
    notes?: string | null,
  ): Observable<VanSellingResponse<VanWarehouse>> {
    return this.http.post<VanSellingResponse<VanWarehouse>>(`${this.base}/vans/${vanId}/temperature`, {
      temp_celsius: tempCelsius,
      notes: notes ?? null,
    });
  }

  reserveSectionalBatch(
    vanId: string,
    documentType: string,
    count = 25,
  ): Observable<VanSellingResponse<VanSectionalBatchReservation>> {
    return this.http.post<VanSellingResponse<VanSectionalBatchReservation>>(
      `${this.base}/vans/${vanId}/reserve-sectional-batch`,
      { document_type: documentType, count },
    );
  }

  getLoadManifests(vanWarehouseId?: string): Observable<VanSellingResponse<VanLoadManifest[]>> {
    let params = new HttpParams();
    if (vanWarehouseId) {
      params = params.set('van_warehouse_id', vanWarehouseId);
    }
    return this.http.get<VanSellingResponse<VanLoadManifest[]>>(`${this.base}/load-manifests`, { params });
  }

  getReplenishmentSuggestions(
    vanWarehouseId: string,
    weekdayIso?: number,
    routeCode?: string,
  ): Observable<VanSellingResponse<ReplenishmentSuggestion[]>> {
    let params = new HttpParams().set('van_warehouse_id', vanWarehouseId);
    if (weekdayIso !== undefined) {
      params = params.set('weekday_iso', String(weekdayIso));
    }
    if (routeCode) {
      params = params.set('route_code', routeCode);
    }
    return this.http.get<VanSellingResponse<ReplenishmentSuggestion[]>>(
      `${this.base}/load-manifests/replenishment-suggestions`,
      { params },
    );
  }

  createLoadManifest(payload: {
    van_warehouse_id: string;
    load_date?: string;
    route_code?: string;
    departure_temp_celsius?: number | null;
    lines: { product_id: string; quantity: number; lot_number?: string | null; is_variable_weight?: boolean }[];
  }): Observable<VanSellingResponse<VanLoadManifest>> {
    return this.http.post<VanSellingResponse<VanLoadManifest>>(`${this.base}/load-manifests`, payload);
  }

  issueGlobalDdt(manifestId: string): Observable<VanSellingResponse<VanLoadManifest>> {
    return this.http.post<VanSellingResponse<VanLoadManifest>>(
      `${this.base}/load-manifests/${manifestId}/issue-global-ddt`,
      {},
    );
  }

  getRoutePlans(vanWarehouseId?: string): Observable<VanSellingResponse<FieldRoutePlan[]>> {
    let params = new HttpParams();
    if (vanWarehouseId) {
      params = params.set('van_warehouse_id', vanWarehouseId);
    }
    return this.http.get<VanSellingResponse<FieldRoutePlan[]>>(`${this.base}/route-plans`, { params });
  }

  getCustomerFieldDossier(contactId: string, proposedAmount = 0): Observable<VanSellingResponse<CustomerFieldDossier>> {
    const params = new HttpParams().set('proposed_amount', String(proposedAmount));
    return this.http.get<VanSellingResponse<CustomerFieldDossier>>(
      `${this.base}/customers/${contactId}/field-dossier`,
      { params },
    );
  }

  unblockCustomerCredit(
    contactId: string,
    payload: { invoice_id: string; amount: number; payment_method: string; reference?: string },
  ): Observable<VanSellingResponse<{ payment_id: string; unblocked: boolean; credit: CustomerFieldDossier['credit'] }>> {
    return this.http.post<VanSellingResponse<{ payment_id: string; unblocked: boolean; credit: CustomerFieldDossier['credit'] }>>(
      `${this.base}/customers/${contactId}/unblock-credit`,
      payload,
    );
  }

  parseGs1Barcode(barcode: string): Observable<VanSellingResponse<Gs1ParseResult>> {
    return this.http.post<VanSellingResponse<Gs1ParseResult>>(`${this.base}/gs1-parse`, { barcode });
  }

  getVisits(vanWarehouseId?: string): Observable<VanSellingResponse<VanVisitOutcome[]>> {
    let params = new HttpParams();
    if (vanWarehouseId) {
      params = params.set('van_warehouse_id', vanWarehouseId);
    }
    return this.http.get<VanSellingResponse<VanVisitOutcome[]>>(`${this.base}/visits`, { params });
  }

  recordVisit(payload: VanVisitOutcomeCreatePayload): Observable<VanSellingResponse<VanVisitOutcome>> {
    return this.http.post<VanSellingResponse<VanVisitOutcome>>(`${this.base}/visits`, payload);
  }

  getThermalPrint(visitId: string): Observable<VanSellingResponse<ThermalPrintJob>> {
    return this.http.get<VanSellingResponse<ThermalPrintJob>>(`${this.base}/visits/${visitId}/thermal-print`);
  }

  syncOfflineBatch(payload: {
    van_warehouse_id: string;
    client_sync_version: number;
    visits: VanVisitOutcomeCreatePayload[];
    temperature_logs?: { temp_celsius: number; recorded_at?: string }[];
  }): Observable<VanSellingResponse<OfflineSyncBatchResult>> {
    return this.http.post<VanSellingResponse<OfflineSyncBatchResult>>(`${this.base}/offline-sync`, payload);
  }

  getSettlements(vanWarehouseId?: string): Observable<VanSellingResponse<VanEodSettlement[]>> {
    let params = new HttpParams();
    if (vanWarehouseId) {
      params = params.set('van_warehouse_id', vanWarehouseId);
    }
    return this.http.get<VanSellingResponse<VanEodSettlement[]>>(`${this.base}/settlements`, { params });
  }

  previewSettlement(payload: {
    van_warehouse_id: string;
    van_load_manifest_id?: string | null;
    settlement_date?: string;
  }): Observable<VanSellingResponse<VanEodSettlementPreview>> {
    return this.http.post<VanSellingResponse<VanEodSettlementPreview>>(`${this.base}/settlements/preview`, payload);
  }

  completeSettlement(payload: {
    van_warehouse_id: string;
    van_load_manifest_id?: string | null;
    settlement_date?: string;
    stock_reconciliation_lines?: VanEodSettlementPreview['stock_reconciliation_lines'];
    opening_cash_float?: number;
    counted_cash_remittance?: number;
    notes?: string | null;
  }): Observable<VanSellingResponse<VanEodSettlement>> {
    return this.http.post<VanSellingResponse<VanEodSettlement>>(`${this.base}/settlements`, payload);
  }
}
