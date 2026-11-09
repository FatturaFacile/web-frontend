import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResponse,
  WorkshopFolder,
  WorkshopFolderActionRequest,
  WorkshopFolderLine,
  WorkshopFolderLineRequest,
  WorkshopFolderParams,
  WorkshopFolderRequest,
  WorkshopRecurringService,
  WorkshopRecurringServiceRequest,
  WorkshopSellRequest,
  WorkshopStockParams,
  WorkshopStockUnitRequest,
  WorkshopTimeBillRequest,
  WorkshopTimeEntry,
  WorkshopTimeEntryRequest,
  WorkshopTimeStartRequest,
  WorkshopVehicleHistoryEntry,
  WorkshopVehicleStockUnit,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class WorkshopApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/workshop`;

  // --- WORKSHOP FOLDERS ---
  getFolders(params?: WorkshopFolderParams): Observable<PaginatedResponse<WorkshopFolder>> {
    return this.http.get<PaginatedResponse<WorkshopFolder>>(`${this.base}/folders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getFolder(id: string): Observable<ApiResponse<WorkshopFolder>> {
    return this.http.get<ApiResponse<WorkshopFolder>>(`${this.base}/folders/${id}`);
  }

  createFolder(payload: WorkshopFolderRequest): Observable<ApiResponse<WorkshopFolder>> {
    return this.http.post<ApiResponse<WorkshopFolder>>(`${this.base}/folders`, payload);
  }

  updateFolder(
    id: string,
    payload: Partial<WorkshopFolderRequest>,
  ): Observable<ApiResponse<WorkshopFolder>> {
    return this.http.put<ApiResponse<WorkshopFolder>>(`${this.base}/folders/${id}`, payload);
  }

  addLine(
    folderId: string,
    payload: WorkshopFolderLineRequest,
  ): Observable<ApiResponse<WorkshopFolderLine>> {
    return this.http.post<ApiResponse<WorkshopFolderLine>>(
      `${this.base}/folders/${folderId}/lines`,
      payload,
    );
  }

  deleteLine(folderId: string, lineId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/folders/${folderId}/lines/${lineId}`);
  }

  changeStatus(
    folderId: string,
    payload: WorkshopFolderActionRequest,
  ): Observable<ApiResponse<WorkshopFolder>> {
    return this.http.post<ApiResponse<WorkshopFolder>>(
      `${this.base}/folders/${folderId}/status`,
      payload,
    );
  }

  convertToQuote(
    folderId: string,
    payload?: { valid_until?: string },
  ): Observable<ApiResponse<{ quote_id: string }>> {
    return this.http.post<ApiResponse<{ quote_id: string }>>(
      `${this.base}/folders/${folderId}/quote`,
      payload || {},
    );
  }

  convertToDeliveryNote(
    folderId: string,
    payload?: { mileage_out?: number },
  ): Observable<ApiResponse<{ delivery_note_id: string }>> {
    return this.http.post<ApiResponse<{ delivery_note_id: string }>>(
      `${this.base}/folders/${folderId}/delivery-note`,
      payload || {},
    );
  }

  convertToInvoice(folderId: string): Observable<ApiResponse<{ invoice_id: string }>> {
    return this.http.post<ApiResponse<{ invoice_id: string }>>(
      `${this.base}/folders/${folderId}/invoice`,
      {},
    );
  }

  // --- TIME TRACKING / TIMBRATURE MECCANICI ---
  getTimeEntries(folderId: string): Observable<ApiResponse<WorkshopTimeEntry[]>> {
    return this.http.get<ApiResponse<WorkshopTimeEntry[]>>(
      `${this.base}/folders/${folderId}/time-entries`,
    );
  }

  createTimeEntry(
    folderId: string,
    payload: WorkshopTimeEntryRequest,
  ): Observable<ApiResponse<WorkshopTimeEntry>> {
    return this.http.post<ApiResponse<WorkshopTimeEntry>>(
      `${this.base}/folders/${folderId}/time-entries`,
      payload,
    );
  }

  startTimeEntry(
    folderId: string,
    payload?: WorkshopTimeStartRequest,
  ): Observable<ApiResponse<WorkshopTimeEntry>> {
    return this.http.post<ApiResponse<WorkshopTimeEntry>>(
      `${this.base}/folders/${folderId}/time-entries/start`,
      payload || {},
    );
  }

  stopTimeEntry(timeEntryId: string): Observable<ApiResponse<WorkshopTimeEntry>> {
    return this.http.post<ApiResponse<WorkshopTimeEntry>>(
      `${this.base}/time-entries/${timeEntryId}/stop`,
      {},
    );
  }

  billTimeEntries(
    folderId: string,
    payload: WorkshopTimeBillRequest,
  ): Observable<ApiResponse<{ line_id: string }>> {
    return this.http.post<ApiResponse<{ line_id: string }>>(
      `${this.base}/folders/${folderId}/time-entries/bill`,
      payload,
    );
  }

  // --- VEHICLE HISTORY ---
  getVehicleHistory(vehicleId: string): Observable<ApiResponse<WorkshopVehicleHistoryEntry[]>> {
    return this.http.get<ApiResponse<WorkshopVehicleHistoryEntry[]>>(
      `${this.base}/vehicles/${vehicleId}/history`,
    );
  }

  // --- RECURRING SERVICES (TAGLIANDI / REVISIONI) ---
  getRecurringServices(): Observable<ApiResponse<WorkshopRecurringService[]>> {
    return this.http.get<ApiResponse<WorkshopRecurringService[]>>(`${this.base}/recurring-services`);
  }

  createRecurringService(
    payload: WorkshopRecurringServiceRequest,
  ): Observable<ApiResponse<WorkshopRecurringService>> {
    return this.http.post<ApiResponse<WorkshopRecurringService>>(
      `${this.base}/recurring-services`,
      payload,
    );
  }

  stopRecurringService(id: string): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(
      `${this.base}/recurring-services/${id}/stop`,
      {},
    );
  }

  // --- VEHICLE STOCK (PARCO USATO / VENDITE) ---
  getVehicleStock(params?: WorkshopStockParams): Observable<PaginatedResponse<WorkshopVehicleStockUnit>> {
    return this.http.get<PaginatedResponse<WorkshopVehicleStockUnit>>(`${this.base}/vehicle-stock`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createVehicleStock(
    payload: WorkshopStockUnitRequest,
  ): Observable<ApiResponse<WorkshopVehicleStockUnit>> {
    return this.http.post<ApiResponse<WorkshopVehicleStockUnit>>(`${this.base}/vehicle-stock`, payload);
  }

  createVehicleStockUnit(
    payload: WorkshopStockUnitRequest,
  ): Observable<ApiResponse<WorkshopVehicleStockUnit>> {
    return this.createVehicleStock(payload);
  }

  updateVehicleStock(
    id: string,
    payload: Partial<WorkshopStockUnitRequest>,
  ): Observable<ApiResponse<WorkshopVehicleStockUnit>> {
    return this.http.put<ApiResponse<WorkshopVehicleStockUnit>>(
      `${this.base}/vehicle-stock/${id}`,
      payload,
    );
  }

  sellVehicleStock(
    id: string,
    payload: WorkshopSellRequest,
  ): Observable<ApiResponse<{ invoice_id?: string }>> {
    return this.http.post<ApiResponse<{ invoice_id?: string }>>(
      `${this.base}/vehicle-stock/${id}/sell`,
      payload,
    );
  }
}
