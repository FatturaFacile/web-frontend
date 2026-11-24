import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '@core';
import {
  AtpCheckLine,
  AtpCheckResult,
  BackorderMonitorRow,
  BlanketAgreement,
  BlanketAgreementPayload,
  CallOffPayload,
  CreateDdtPayload,
  DataEnvelope,
  PagedEnvelope,
  WorkspaceOrder,
  WorkspaceOrderPayload,
} from './sales-workspace.models';

export interface WorkspaceOrderFilters {
  status?: string;
  order_type?: string;
  customer_id?: string;
  credit_blocked?: boolean;
  has_backorders?: boolean;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface BlanketAgreementFilters {
  contact_id?: string;
  status?: string;
  expiring_within_days?: number;
  page?: number;
  per_page?: number;
}

/** HTTP client of the sales orders workspace (`/sales-orders`) and of the blanket agreements (`/blanket-agreements`). */
@Service()
export class SalesWorkspaceApiService {
  private readonly http = inject(HttpClient);
  private readonly orders = `${environment.apiBaseUrl}/sales-orders`;
  private readonly agreements = `${environment.apiBaseUrl}/blanket-agreements`;

  listOrders(filters: WorkspaceOrderFilters = {}): Observable<PagedEnvelope<WorkspaceOrder>> {
    return this.http.get<PagedEnvelope<WorkspaceOrder>>(this.orders, {
      params: toHttpParams(toWire(filters)),
    });
  }

  getOrder(id: string): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.get<DataEnvelope<WorkspaceOrder>>(`${this.orders}/${id}`);
  }

  createOrder(payload: WorkspaceOrderPayload): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(this.orders, payload);
  }

  updateOrder(
    id: string,
    payload: WorkspaceOrderPayload,
  ): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.put<DataEnvelope<WorkspaceOrder>>(`${this.orders}/${id}`, payload);
  }

  deleteOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.orders}/${id}`);
  }

  atpCheck(
    lines: AtpCheckLine[],
    warehouseId?: string | null,
  ): Observable<DataEnvelope<AtpCheckResult[]>> {
    return this.http.post<DataEnvelope<AtpCheckResult[]>>(`${this.orders}/atp-check`, {
      lines,
      warehouse_id: warehouseId ?? null,
    });
  }

  confirm(id: string, autoReplenish = true): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(`${this.orders}/${id}/confirm`, {
      auto_replenish: autoReplenish,
    });
  }

  creditRelease(id: string, notes: string): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(`${this.orders}/${id}/credit-release`, {
      notes,
    });
  }

  generateReplenishment(id: string): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(
      `${this.orders}/${id}/generate-replenishment`,
      {},
    );
  }

  reevaluateAtp(id: string): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(`${this.orders}/${id}/reevaluate-atp`, {});
  }

  createDdt(id: string, payload: CreateDdtPayload): Observable<DataEnvelope<{ id: string }>> {
    return this.http.post<DataEnvelope<{ id: string }>>(`${this.orders}/${id}/create-ddt`, payload);
  }

  cancel(id: string, reason: string): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(`${this.orders}/${id}/cancel`, { reason });
  }

  backorders(perPage = 50): Observable<PagedEnvelope<BackorderMonitorRow>> {
    return this.http.get<PagedEnvelope<BackorderMonitorRow>>(`${this.orders}/backorders`, {
      params: toHttpParams({ per_page: perPage }),
    });
  }

  listAgreements(
    filters: BlanketAgreementFilters = {},
  ): Observable<PagedEnvelope<BlanketAgreement>> {
    return this.http.get<PagedEnvelope<BlanketAgreement>>(this.agreements, {
      params: toHttpParams(filters),
    });
  }

  getAgreement(id: string): Observable<DataEnvelope<BlanketAgreement>> {
    return this.http.get<DataEnvelope<BlanketAgreement>>(`${this.agreements}/${id}`);
  }

  createAgreement(payload: BlanketAgreementPayload): Observable<DataEnvelope<BlanketAgreement>> {
    return this.http.post<DataEnvelope<BlanketAgreement>>(this.agreements, payload);
  }

  activateAgreement(id: string): Observable<DataEnvelope<BlanketAgreement>> {
    return this.http.post<DataEnvelope<BlanketAgreement>>(`${this.agreements}/${id}/activate`, {});
  }

  suspendAgreement(id: string): Observable<DataEnvelope<BlanketAgreement>> {
    return this.http.post<DataEnvelope<BlanketAgreement>>(`${this.agreements}/${id}/suspend`, {});
  }

  closeAgreement(id: string): Observable<DataEnvelope<BlanketAgreement>> {
    return this.http.post<DataEnvelope<BlanketAgreement>>(`${this.agreements}/${id}/close`, {});
  }

  renewAgreement(id: string): Observable<DataEnvelope<BlanketAgreement>> {
    return this.http.post<DataEnvelope<BlanketAgreement>>(`${this.agreements}/${id}/renew`, {});
  }

  callOff(id: string, payload: CallOffPayload): Observable<DataEnvelope<WorkspaceOrder>> {
    return this.http.post<DataEnvelope<WorkspaceOrder>>(
      `${this.agreements}/${id}/call-off`,
      payload,
    );
  }
}

/** Booleans travel as 1 (the API reads them with `boolean()`); false filters are left out. */
function toWire(filters: object): Record<string, string | number> {
  const wire: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === true) {
      wire[key] = 1;
    } else if (typeof value === 'string' || typeof value === 'number') {
      wire[key] = value;
    }
  }
  return wire;
}
