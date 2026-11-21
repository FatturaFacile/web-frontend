import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  MfgCapacityDay,
  MfgCockpit,
  MfgConfirmationResult,
  MfgConfirmOperationPayload,
  MfgCostReport,
  MfgEdgeGateway,
  MfgEdgeGatewayRegistration,
  MfgGenealogy,
  MfgOperationConfirmation,
  MfgProductionOrderResource,
  MfgShopFloorExecution,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Cockpit, genealogy, cost report, capacity, operation confirmation, shop-floor and edge endpoints of the manufacturing API. */
@Service()
export class ManufacturingCockpitApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/manufacturing`;

  getCockpit(windowDays = 30): Observable<ApiResponse<MfgCockpit>> {
    return this.http.get<ApiResponse<MfgCockpit>>(`${this.base}/cockpit`, {
      params: toHttpParams({ window_days: windowDays }),
    });
  }

  getGenealogy(orderId: string): Observable<ApiResponse<MfgGenealogy>> {
    return this.http.get<ApiResponse<MfgGenealogy>>(`${this.base}/production-orders/${orderId}/genealogy`);
  }

  getCostReport(orderId: string): Observable<ApiResponse<MfgCostReport>> {
    return this.http.get<ApiResponse<MfgCostReport>>(`${this.base}/production-orders/${orderId}/cost-rollup`);
  }

  getWorkCenterCapacity(workCenterId: string, from: string, to: string): Observable<ApiResponse<MfgCapacityDay[]>> {
    return this.http.get<ApiResponse<MfgCapacityDay[]>>(`${this.base}/work-centers/${workCenterId}/capacity`, {
      params: toHttpParams({ from, to }),
    });
  }

  rescheduleOrder(
    orderId: string,
    plannedStartDate: string,
    plannedEndDate: string,
  ): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(`${this.base}/production-orders/${orderId}/reschedule`, {
      planned_start_date: plannedStartDate,
      planned_end_date: plannedEndDate,
    });
  }

  /** Confirms an operation; 201 = booked, 200 = the `operation_posting_uuid` was already posted (replay). */
  confirmOperation(
    orderId: string,
    operationId: string,
    payload: MfgConfirmOperationPayload,
  ): Observable<MfgConfirmationResult> {
    return this.http
      .post<ApiResponse<MfgOperationConfirmation>>(
        `${this.base}/production-orders/${orderId}/operations/${operationId}/confirmations`,
        payload,
        { observe: 'response' },
      )
      .pipe(
        map((res: HttpResponse<ApiResponse<MfgOperationConfirmation>>) => ({
          confirmation: (res.body as ApiResponse<MfgOperationConfirmation>).data,
          replayed: res.status === 200,
        })),
      );
  }

  startExecution(operationId: string, operatorId?: string, machineId?: string): Observable<ApiResponse<MfgShopFloorExecution>> {
    return this.http.post<ApiResponse<MfgShopFloorExecution>>(`${this.base}/shop-floor/executions`, {
      production_order_operation_id: operationId,
      ...(operatorId ? { operator_id: operatorId } : {}),
      ...(machineId ? { machine_id: machineId } : {}),
    });
  }

  getEdgeGateways(): Observable<ApiResponse<MfgEdgeGateway[]>> {
    return this.http.get<ApiResponse<MfgEdgeGateway[]>>(`${this.base}/edge/gateways`);
  }

  registerEdgeGateway(name: string): Observable<ApiResponse<MfgEdgeGatewayRegistration>> {
    return this.http.post<ApiResponse<MfgEdgeGatewayRegistration>>(`${this.base}/edge/gateways`, { name });
  }
}
