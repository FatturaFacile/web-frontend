import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, LaravelPaginationMeta } from '../models';

type Filters = Record<string, string | number | boolean | null | undefined | string[]>;
/** Request body: field names mirror the Laravel FormRequest of the route. */
type Payload = Record<string, unknown>;
/** Generic resource returned by the API. */
type Row = Record<string, unknown>;
type ListResponse<T> = ApiResponse<T[]> & { meta?: LaravelPaginationMeta };

/** Additional endpoints of the wms API not covered by the dedicated typed services. */
@Service()
export class WmsExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /wms/dock-doors */
  listDockDoors(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/dock-doors`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/dock-doors */
  createDockDoor(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/dock-doors`, payload);
  }

  /** GET /wms/dock-doors/{} */
  getDockDoor(dockDoorId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/dock-doors/${dockDoorId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /wms/dock-doors/{} */
  updateDockDoor(dockDoorId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/wms/dock-doors/${dockDoorId}`, payload);
  }

  /** DELETE /wms/dock-doors/{} */
  deleteDockDoor(dockDoorId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wms/dock-doors/${dockDoorId}`);
  }

  /** GET /wms/wave-rules */
  listWaveRules(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/wave-rules`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/wave-rules */
  createWaveRule(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/wave-rules`, payload);
  }

  /** GET /wms/wave-rules/{} */
  getWaveRule(waveRuleId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/wave-rules/${waveRuleId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /wms/wave-rules/{} */
  updateWaveRule(waveRuleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/wms/wave-rules/${waveRuleId}`, payload);
  }

  /** DELETE /wms/wave-rules/{} */
  deleteWaveRule(waveRuleId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wms/wave-rules/${waveRuleId}`);
  }

  /** GET /wms/waves */
  listWaves(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/waves`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /wms/waves/{} */
  getWave(waveId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/waves/${waveId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/waves/plan */
  planWave(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/waves/plan`, payload);
  }

  /** POST /wms/waves/{}/release */
  releaseWave(waveId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/waves/${waveId}/release`, payload);
  }

  /** POST /wms/waves/{}/complete */
  completeWave(waveId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/waves/${waveId}/complete`, payload);
  }

  /** POST /wms/waves/{}/cancel */
  cancelWave(waveId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/waves/${waveId}/cancel`, payload);
  }

  /** GET /wms/tasks */
  listTasks(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/tasks`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/tasks */
  createTask(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks`, payload);
  }

  /** GET /wms/tasks/{} */
  getTask(taskId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /wms/tasks/{} */
  updateTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}`, payload);
  }

  /** DELETE /wms/tasks/{} */
  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wms/tasks/${taskId}`);
  }

  /** POST /wms/tasks/claim-next */
  claimNextTask(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/claim-next`, payload);
  }

  /** POST /wms/tasks/{}/assign */
  assignTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}/assign`, payload);
  }

  /** POST /wms/tasks/{}/start */
  startTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}/start`, payload);
  }

  /** POST /wms/tasks/{}/confirm */
  confirmTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}/confirm`, payload);
  }

  /** POST /wms/tasks/{}/short */
  shortTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}/short`, payload);
  }

  /** POST /wms/tasks/{}/skip */
  skipTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}/skip`, payload);
  }

  /** POST /wms/tasks/{}/cancel */
  cancelTask(taskId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/tasks/${taskId}/cancel`, payload);
  }

  /** GET /wms/slotting-rules */
  listSlottingRules(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/slotting-rules`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/slotting-rules */
  createSlottingRule(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/slotting-rules`, payload);
  }

  /** GET /wms/slotting-rules/{} */
  getSlottingRule(slottingRuleId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/slotting-rules/${slottingRuleId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /wms/slotting-rules/{} */
  updateSlottingRule(slottingRuleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/wms/slotting-rules/${slottingRuleId}`, payload);
  }

  /** DELETE /wms/slotting-rules/{} */
  deleteSlottingRule(slottingRuleId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wms/slotting-rules/${slottingRuleId}`);
  }

  /** GET /wms/slotting-recommendations */
  listSlottingRecommendations(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/slotting-recommendations`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /wms/slotting-recommendations/{} */
  getSlottingRecommendation(slottingRecommendationId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/slotting-recommendations/${slottingRecommendationId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/slotting-recommendations/generate */
  generateSlottingRecommendation(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/slotting-recommendations/generate`, payload);
  }

  /** POST /wms/slotting-recommendations/{}/accept */
  acceptSlottingRecommendation(slottingRecommendationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/slotting-recommendations/${slottingRecommendationId}/accept`, payload);
  }

  /** POST /wms/slotting-recommendations/{}/reject */
  rejectSlottingRecommendation(slottingRecommendationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/slotting-recommendations/${slottingRecommendationId}/reject`, payload);
  }

  /** GET /wms/dock-appointments */
  listDockAppointments(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/dock-appointments`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/dock-appointments */
  createDockAppointment(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/dock-appointments`, payload);
  }

  /** GET /wms/dock-appointments/{} */
  getDockAppointment(dockAppointmentId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/dock-appointments/${dockAppointmentId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /wms/dock-appointments/{} */
  updateDockAppointment(dockAppointmentId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/wms/dock-appointments/${dockAppointmentId}`, payload);
  }

  /** DELETE /wms/dock-appointments/{} */
  deleteDockAppointment(dockAppointmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wms/dock-appointments/${dockAppointmentId}`);
  }

  /** POST /wms/dock-appointments/{}/check-in */
  checkInDockAppointment(dockAppointmentId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/dock-appointments/${dockAppointmentId}/check-in`, payload);
  }

  /** POST /wms/dock-appointments/{}/complete */
  completeDockAppointment(dockAppointmentId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/dock-appointments/${dockAppointmentId}/complete`, payload);
  }

  /** POST /wms/dock-appointments/{}/cancel */
  cancelDockAppointment(dockAppointmentId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/dock-appointments/${dockAppointmentId}/cancel`, payload);
  }

  /** POST /wms/dock-appointments/{}/no-show */
  noShowDockAppointment(dockAppointmentId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/dock-appointments/${dockAppointmentId}/no-show`, payload);
  }

  /** GET /wms/cross-dock-orders */
  listCrossDockOrders(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/wms/cross-dock-orders`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /wms/cross-dock-orders */
  createCrossDockOrder(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders`, payload);
  }

  /** GET /wms/cross-dock-orders/{} */
  getCrossDockOrder(crossDockOrderId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /wms/cross-dock-orders/{} */
  updateCrossDockOrder(crossDockOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}`, payload);
  }

  /** DELETE /wms/cross-dock-orders/{} */
  deleteCrossDockOrder(crossDockOrderId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}`);
  }

  /** POST /wms/cross-dock-orders/{}/receive */
  receiveCrossDockOrder(crossDockOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}/receive`, payload);
  }

  /** POST /wms/cross-dock-orders/{}/allocate */
  allocateCrossDockOrder(crossDockOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}/allocate`, payload);
  }

  /** POST /wms/cross-dock-orders/{}/ship */
  shipCrossDockOrder(crossDockOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}/ship`, payload);
  }

  /** POST /wms/cross-dock-orders/{}/cancel */
  cancelCrossDockOrder(crossDockOrderId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/wms/cross-dock-orders/${crossDockOrderId}/cancel`, payload);
  }
}
