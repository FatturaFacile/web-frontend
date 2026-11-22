import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  MfgCapacityDay,
  MfgCockpit,
  MfgCockpitMachines,
  MfgPlannedOrderResource,
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
import { handleErrorsLocally } from '../http/error-handling.context';
import { toHttpParams } from '../http/laravel-http.utils';
import { parseSse } from '../http/sse.utils';

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

  /**
   * Moves the planned dates of an order. The API checks the finite capacity of the work centres and answers 422 on
   * `planned_start_date` when the window is overloaded, unless `allowOverload` is set. The 422 is handled by the caller.
   */
  rescheduleOrder(
    orderId: string,
    plannedStartDate: string,
    plannedEndDate: string,
    allowOverload = false,
  ): Observable<ApiResponse<MfgProductionOrderResource>> {
    return this.http.post<ApiResponse<MfgProductionOrderResource>>(
      `${this.base}/production-orders/${orderId}/reschedule`,
      {
        planned_start_date: plannedStartDate,
        planned_end_date: plannedEndDate,
        ...(allowOverload ? { allow_overload: true } : {}),
      },
      { context: handleErrorsLocally(422) },
    );
  }

  /** Moves the dates of an MRP planned order that is not converted yet. */
  reschedulePlannedOrder(
    plannedOrderId: string,
    startDate: string,
    dueDate: string,
  ): Observable<ApiResponse<MfgPlannedOrderResource>> {
    return this.http.post<ApiResponse<MfgPlannedOrderResource>>(
      `${this.base}/mrp/planned-orders/${plannedOrderId}/reschedule`,
      { start_date: startDate, due_date: dueDate },
      { context: handleErrorsLocally(422) },
    );
  }

  /**
   * The machine states as server-sent events (`GET /machines/stream`): emits right away and on every change until the
   * server ends the stream at its deadline (then it completes: the caller reconnects).
   */
  streamMachineStates(): Observable<MfgCockpitMachines> {
    return new Observable<MfgCockpitMachines>((subscriber) => {
      let seen = 0;
      const emit = (text: string): void => {
        const { messages, consumed } = parseSse(text.slice(seen));
        seen += consumed;
        for (const message of messages) {
          if (message.event === 'machines') {
            try {
              subscriber.next(JSON.parse(message.data) as MfgCockpitMachines);
            } catch {
              // A damaged event is skipped: the next one carries the full state again.
            }
          }
        }
      };

      const subscription = this.http
        .get(`${this.base}/machines/stream`, { observe: 'events', responseType: 'text', reportProgress: true })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.DownloadProgress && 'partialText' in event && typeof event.partialText === 'string') {
              emit(event.partialText);
            } else if (event.type === HttpEventType.Response && typeof event.body === 'string') {
              emit(event.body);
            }
          },
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });

      return () => subscription.unsubscribe();
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
