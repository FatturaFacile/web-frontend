import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  FsmAdvanceStatusPayload,
  FsmBoard,
  FsmBoardParams,
  FsmDispatchPayload,
  FsmEnvelope,
  FsmEquipment,
  FsmEquipmentHistory,
  FsmInvoicePayload,
  FsmInvoiceResult,
  FsmMaintenanceContract,
  FsmMaintenanceContractPayload,
  FsmMeterPayload,
  FsmMeterResult,
  FsmPreventiveRunResult,
  FsmRecordPartPayload,
  FsmRecordedPart,
  FsmServiceReport,
  FsmSignReportPayload,
  FsmWorkOrder,
  FsmWorkOrderDetail,
  FsmWorkOrderListParams,
  FsmWorkOrderPayload,
} from '../models';

/** Field Service Management endpoints (`/api/v1/fsm`): dispatcher board, work orders, reports, equipment, contracts. */
@Service()
export class FsmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/fsm`;

  // --- Dispatcher board ---
  getBoard(params?: FsmBoardParams): Observable<FsmEnvelope<FsmBoard>> {
    return this.http.get<FsmEnvelope<FsmBoard>>(`${this.base}/board`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** Assigns or reschedules a work order. A 422 carries every blocker (`schedule`, `skills`, `van_stock`, ...). */
  dispatch(workOrderId: string, payload: FsmDispatchPayload): Observable<FsmEnvelope<FsmWorkOrder>> {
    return this.http.post<FsmEnvelope<FsmWorkOrder>>(`${this.base}/work-orders/${workOrderId}/dispatch`, payload);
  }

  // --- Work orders ---
  listWorkOrders(params?: FsmWorkOrderListParams): Observable<FsmEnvelope<FsmWorkOrder[]>> {
    return this.http.get<FsmEnvelope<FsmWorkOrder[]>>(`${this.base}/work-orders`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getWorkOrder(id: string): Observable<FsmEnvelope<FsmWorkOrderDetail>> {
    return this.http.get<FsmEnvelope<FsmWorkOrderDetail>>(`${this.base}/work-orders/${id}`);
  }

  createWorkOrder(payload: FsmWorkOrderPayload): Observable<FsmEnvelope<FsmWorkOrder>> {
    return this.http.post<FsmEnvelope<FsmWorkOrder>>(`${this.base}/work-orders`, payload);
  }

  advanceStatus(id: string, payload: FsmAdvanceStatusPayload): Observable<FsmEnvelope<FsmWorkOrder>> {
    return this.http.post<FsmEnvelope<FsmWorkOrder>>(`${this.base}/work-orders/${id}/status`, payload);
  }

  recordPart(id: string, payload: FsmRecordPartPayload): Observable<FsmEnvelope<FsmRecordedPart>> {
    return this.http.post<FsmEnvelope<FsmRecordedPart>>(`${this.base}/work-orders/${id}/parts`, payload);
  }

  // --- Service reports ---
  /** Signs and closes the service report of an on-site work order (201 on create, 200 on an idempotent replay). */
  signReport(workOrderId: string, payload: FsmSignReportPayload): Observable<FsmEnvelope<FsmServiceReport>> {
    return this.http.post<FsmEnvelope<FsmServiceReport>>(`${this.base}/work-orders/${workOrderId}/service-report`, payload);
  }

  downloadReportPdf(reportId: string): Observable<Blob> {
    return this.http.get(`${this.base}/service-reports/${reportId}/pdf`, { responseType: 'blob' });
  }

  /** Converts the billable lines of a signed report into an invoice (covered lines are excluded). */
  invoiceReport(reportId: string, payload: FsmInvoicePayload): Observable<FsmEnvelope<FsmInvoiceResult>> {
    return this.http.post<FsmEnvelope<FsmInvoiceResult>>(`${this.base}/service-reports/${reportId}/invoice`, payload);
  }

  // --- Equipment ---
  listEquipment(): Observable<FsmEnvelope<FsmEquipment[]>> {
    return this.http.get<FsmEnvelope<FsmEquipment[]>>(`${this.base}/equipment`);
  }

  getEquipmentHistory(id: string): Observable<FsmEnvelope<FsmEquipmentHistory>> {
    return this.http.get<FsmEnvelope<FsmEquipmentHistory>>(`${this.base}/equipment/${id}/service-history`);
  }

  updateMeters(id: string, payload: FsmMeterPayload): Observable<FsmEnvelope<FsmMeterResult>> {
    return this.http.patch<FsmEnvelope<FsmMeterResult>>(`${this.base}/equipment/${id}/meters`, payload);
  }

  // --- Maintenance contracts and preventive engine ---
  listContracts(): Observable<FsmEnvelope<FsmMaintenanceContract[]>> {
    return this.http.get<FsmEnvelope<FsmMaintenanceContract[]>>(`${this.base}/maintenance-contracts`);
  }

  createContract(payload: FsmMaintenanceContractPayload): Observable<FsmEnvelope<FsmMaintenanceContract>> {
    return this.http.post<FsmEnvelope<FsmMaintenanceContract>>(`${this.base}/maintenance-contracts`, payload);
  }

  updateContract(
    id: string,
    payload: Partial<FsmMaintenanceContractPayload>,
  ): Observable<FsmEnvelope<FsmMaintenanceContract>> {
    return this.http.patch<FsmEnvelope<FsmMaintenanceContract>>(`${this.base}/maintenance-contracts/${id}`, payload);
  }

  /** Generates the due preventive work orders of every active contract (GH-197); idempotent per cycle. */
  runPreventive(): Observable<FsmEnvelope<FsmPreventiveRunResult>> {
    return this.http.post<FsmEnvelope<FsmPreventiveRunResult>>(`${this.base}/preventive-maintenance/run`, {});
  }
}
