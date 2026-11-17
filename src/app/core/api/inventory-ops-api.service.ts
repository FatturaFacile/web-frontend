import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models';
import { InventoryListParams, InventoryRow } from './inventory-extra-api.service';

export interface PickListPayload {
  warehouse_id: string;
  assigned_picker_user_id?: string | null;
  origin_document_type?: string | null;
  origin_document_id?: string | null;
  items: { stock_item_id: string; quantity: number; lot_id?: string | null }[];
}

export interface CarrierPayload {
  code: string;
  name: string;
  driver: string;
  contract_number?: string | null;
  credentials?: Record<string, unknown> | null;
  tracking_url_template?: string | null;
  [key: string]: unknown;
}

export type TerminalAction = 'receipt' | 'pick' | 'transfer' | 'count';

export type TransferOrderAction = 'approve' | 'close' | 'ship' | 'receive' | 'cancel';

/**
 * Operational inventory API: pick lists, packing, waves, shipping, warehouse terminal,
 * transfer orders, safety data sheets, weighbridge, repair orders, warehouse structure.
 * Customer-portal token endpoints (/portal/...) are intentionally not exposed here.
 */
@Service()
export class InventoryOpsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/inventory`;

  private params(p?: object): HttpParams | undefined {
    return p ? toHttpParams(p) : undefined;
  }

  // Pick lists
  getPickLists(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/pick-lists`, { params: this.params(filters) });
  }

  createPickList(payload: PickListPayload): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/pick-lists`, payload);
  }

  getPickList(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/pick-lists/${id}`);
  }

  getPickListNextStop(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/pick-lists/${id}/next-stop`);
  }

  confirmPickListLine(id: string, lineId: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/pick-lists/${id}/lines/${lineId}/confirm`, payload);
  }

  cancelPickList(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/pick-lists/${id}/cancel`, {});
  }

  shipPickList(id: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/pick-lists/${id}/ship`, payload);
  }

  createPackingList(pickListId: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/pick-lists/${pickListId}/packing-list`, payload);
  }

  calculatePacking(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/packing/calculate`, payload);
  }

  getPackingList(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/packing-lists/${id}`);
  }

  // Waves
  getWaves(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/waves`, { params: this.params(filters) });
  }

  releaseWave(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/waves`, payload);
  }

  getWave(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/waves/${id}`);
  }

  cancelWave(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/waves/${id}/cancel`, {});
  }

  // Warehouse terminal (RF scanner)
  terminalAction(action: TerminalAction, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/terminal/${action}`, payload);
  }

  // Warehouse structure
  createWarehouseLocation(warehouseId: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/warehouses/${warehouseId}/locations`, payload);
  }

  getWarehouseZones(warehouseId: string): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/warehouses/${warehouseId}/zones`);
  }

  updateZone(id: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.patch<ApiResponse<InventoryRow>>(`${this.base}/zones/${id}`, payload);
  }

  updateBin(id: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.patch<ApiResponse<InventoryRow>>(`${this.base}/bins/${id}`, payload);
  }

  // Transfer orders
  getTransferOrders(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/transfer-orders`, { params: this.params(filters) });
  }

  createTransferOrder(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/transfer-orders`, payload);
  }

  getTransferOrder(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/transfer-orders/${id}`);
  }

  /** Workflow transitions of a transfer order. */
  transitionTransferOrder(
    id: string,
    action: TransferOrderAction,
    payload: Record<string, unknown> = {},
  ): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/transfer-orders/${id}/${action}`, payload);
  }

  // Shipping
  getCarriers(): Observable<{ data: InventoryRow[] }> {
    return this.http.get<{ data: InventoryRow[] }>(`${this.base}/carriers`);
  }

  createCarrier(payload: CarrierPayload): Observable<InventoryRow> {
    return this.http.post<InventoryRow>(`${this.base}/carriers`, payload);
  }

  bookShipment(payload: Record<string, unknown>): Observable<InventoryRow> {
    return this.http.post<InventoryRow>(`${this.base}/shipments`, payload);
  }

  getShipment(id: string): Observable<InventoryRow> {
    return this.http.get<InventoryRow>(`${this.base}/shipments/${id}`);
  }

  getShipmentLabel(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/shipments/${id}/label`, { responseType: 'blob' });
  }

  addShipmentTrackingEvent(id: string, payload: Record<string, unknown>): Observable<InventoryRow> {
    return this.http.post<InventoryRow>(`${this.base}/shipments/${id}/tracking`, payload);
  }

  refreshShipment(id: string): Observable<InventoryRow> {
    return this.http.post<InventoryRow>(`${this.base}/shipments/${id}/refresh`, {});
  }

  // Safety data sheets
  getSafetySheets(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/safety-sheets`, { params: this.params(filters) });
  }

  createSafetySheet(payload: FormData | Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/safety-sheets`, payload);
  }

  getSafetySheetVersions(id: string): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/safety-sheets/${id}/versions`);
  }

  addSafetySheetVersion(id: string, payload: FormData | Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/safety-sheets/${id}/versions`, payload);
  }

  downloadSafetySheetVersion(versionId: string): Observable<Blob> {
    return this.http.get(`${this.base}/safety-sheets/versions/${versionId}/file`, { responseType: 'blob' });
  }

  getSafetySheetDeliveries(deliveryNoteId: string): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/safety-sheets/deliveries/${deliveryNoteId}`);
  }

  sendSafetySheets(deliveryNoteId: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/safety-sheets/deliveries/${deliveryNoteId}/send`, payload);
  }

  // Weighbridge
  getWeighbridgeVehicles(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow[]>> {
    return this.http.get<ApiResponse<InventoryRow[]>>(`${this.base}/weighbridge/vehicles`, { params: this.params(filters) });
  }

  createWeighbridgeVehicle(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/weighbridge/vehicles`, payload);
  }

  recordWeighbridgeReading(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/weighbridge/readings`, payload);
  }

  getLatestWeighbridgeReading(filters?: InventoryListParams): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/weighbridge/readings/latest`, { params: this.params(filters) });
  }

  getWeighbridgeTickets(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/weighbridge/tickets`, { params: this.params(filters) });
  }

  openWeighbridgeTicket(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/weighbridge/tickets`, payload);
  }

  recordSecondWeighing(id: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/weighbridge/tickets/${id}/second-weighing`, payload);
  }

  billWeighbridgeTicket(id: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/weighbridge/tickets/${id}/bill`, payload);
  }

  // Customer portal movement requests (back-office review)
  getPortalRequests(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/portal-requests`, { params: this.params(filters) });
  }

  approvePortalRequest(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/portal-requests/${id}/approve`, {});
  }

  rejectPortalRequest(id: string, payload: { reason?: string } = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/portal-requests/${id}/reject`, payload);
  }

  // Warranty & repair orders
  lookupWarranty(filters: InventoryListParams): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/warranties/lookup`, { params: this.params(filters) });
  }

  recordSerialWarranty(serialId: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.put<ApiResponse<InventoryRow>>(`${this.base}/serials/${serialId}/warranty`, payload);
  }

  getRepairOrders(filters?: InventoryListParams): Observable<PaginatedResponse<InventoryRow>> {
    return this.http.get<PaginatedResponse<InventoryRow>>(`${this.base}/repair-orders`, { params: this.params(filters) });
  }

  createRepairOrder(payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/repair-orders`, payload);
  }

  getRepairOrder(id: string): Observable<ApiResponse<InventoryRow>> {
    return this.http.get<ApiResponse<InventoryRow>>(`${this.base}/repair-orders/${id}`);
  }

  advanceRepairOrder(id: string, payload: { status: string; [key: string]: unknown }): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/repair-orders/${id}/status`, payload);
  }

  addRepairOrderPart(id: string, payload: Record<string, unknown>): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/repair-orders/${id}/parts`, payload);
  }

  invoiceRepairOrder(id: string, payload: Record<string, unknown> = {}): Observable<ApiResponse<InventoryRow>> {
    return this.http.post<ApiResponse<InventoryRow>>(`${this.base}/repair-orders/${id}/invoice`, payload);
  }
}
