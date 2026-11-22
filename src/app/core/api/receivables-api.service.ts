import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ArAging,
  ArAllocatePayload,
  ArAllocateResult,
  ArAllocation,
  ArCreditCheckParams,
  ArCreditDecision,
  ArCreditLimit,
  ArCreditLimitPayload,
  ArCreditLimitUpdate,
  ArCreditPosition,
  ArDashboard,
  ArDisputePayload,
  ArDso,
  ArEnvelope,
  ArItem,
  ArItemFilters,
  ArLedger,
  ArLedgerFilters,
  ArOverride,
  ArOverridePayload,
  ArPage,
  ArProvision,
  ArProvisionRates,
  ArRisk,
  ArStatement,
  ArStatementPeriod,
  ArStatementSendPayload,
  ArStatementSendResult,
  ArUnreconciledPayment,
} from '../models';

/** Accounts receivable and credit management endpoints of the invoicing module (Mod 013). */
@Service()
export class ReceivablesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/invoicing/receivables`;

  // --- Dashboard, aging, DSO, provision ---

  getDashboard(currency?: string): Observable<ArEnvelope<ArDashboard>> {
    return this.http.get<ArEnvelope<ArDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams({ currency }),
    });
  }

  getAging(customerId?: string, currency?: string): Observable<ArEnvelope<ArAging>> {
    return this.http.get<ArEnvelope<ArAging>>(`${this.base}/aging`, {
      params: toHttpParams({ customer_id: customerId, currency }),
    });
  }

  getDso(
    customerId?: string,
    periodDays?: number,
    currency?: string,
  ): Observable<ArEnvelope<ArDso>> {
    return this.http.get<ArEnvelope<ArDso>>(`${this.base}/dso`, {
      params: toHttpParams({ customer_id: customerId, period_days: periodDays, currency }),
    });
  }

  getProvision(customerId?: string, currency?: string): Observable<ArEnvelope<ArProvision>> {
    return this.http.get<ArEnvelope<ArProvision>>(`${this.base}/provision`, {
      params: toHttpParams({ customer_id: customerId, currency }),
    });
  }

  saveProvisionRates(rates: ArProvisionRates): Observable<ArEnvelope<ArProvisionRates>> {
    return this.http.put<ArEnvelope<ArProvisionRates>>(`${this.base}/provision/rates`, { rates });
  }

  // --- Open items ---

  listItems(filters: ArItemFilters): Observable<ArPage<ArItem>> {
    return this.http.get<ArPage<ArItem>>(`${this.base}/items`, {
      params: this.itemParams(filters),
    });
  }

  getItem(id: string): Observable<ArEnvelope<ArItem>> {
    return this.http.get<ArEnvelope<ArItem>>(`${this.base}/items/${id}`);
  }

  /** Marks (reason required) or clears the dispute of an item. */
  setDispute(id: string, payload: ArDisputePayload): Observable<ArEnvelope<ArItem>> {
    return this.http.post<ArEnvelope<ArItem>>(`${this.base}/items/${id}/dispute`, payload);
  }

  // --- Reconciliation ---

  allocate(payload: ArAllocatePayload): Observable<ArEnvelope<ArAllocateResult>> {
    return this.http.post<ArEnvelope<ArAllocateResult>>(`${this.base}/allocations`, payload);
  }

  reverseAllocation(id: string): Observable<ArEnvelope<ArAllocation>> {
    return this.http.post<ArEnvelope<ArAllocation>>(`${this.base}/allocations/${id}/reverse`, {});
  }

  // --- Customer ledger ---

  getLedger(customerId: string, filters: ArLedgerFilters = {}): Observable<ArEnvelope<ArLedger>> {
    return this.http.get<ArEnvelope<ArLedger>>(`${this.base}/customers/${customerId}/ledger`, {
      params: toHttpParams(filters),
    });
  }

  getUnreconciledPayments(customerId: string): Observable<ArEnvelope<ArUnreconciledPayment[]>> {
    return this.http.get<ArEnvelope<ArUnreconciledPayment[]>>(
      `${this.base}/customers/${customerId}/unreconciled-payments`,
    );
  }

  // --- Credit position, risk, limits, overrides ---

  getCredit(customerId: string): Observable<ArEnvelope<ArCreditPosition>> {
    return this.http.get<ArEnvelope<ArCreditPosition>>(
      `${this.base}/customers/${customerId}/credit`,
    );
  }

  getRisk(customerId: string): Observable<ArEnvelope<ArRisk>> {
    return this.http.get<ArEnvelope<ArRisk>>(`${this.base}/customers/${customerId}/risk`);
  }

  getCreditLimits(customerId: string): Observable<ArEnvelope<ArCreditLimit[]>> {
    return this.http.get<ArEnvelope<ArCreditLimit[]>>(
      `${this.base}/customers/${customerId}/credit-limits`,
    );
  }

  createCreditLimit(payload: ArCreditLimitPayload): Observable<ArEnvelope<ArCreditLimit>> {
    return this.http.post<ArEnvelope<ArCreditLimit>>(`${this.base}/credit-limits`, payload);
  }

  updateCreditLimit(
    id: string,
    payload: ArCreditLimitUpdate,
  ): Observable<ArEnvelope<ArCreditLimit>> {
    return this.http.put<ArEnvelope<ArCreditLimit>>(`${this.base}/credit-limits/${id}`, payload);
  }

  deleteCreditLimit(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/credit-limits/${id}`);
  }

  grantOverride(
    customerId: string,
    payload: ArOverridePayload,
  ): Observable<ArEnvelope<ArOverride>> {
    return this.http.post<ArEnvelope<ArOverride>>(
      `${this.base}/customers/${customerId}/overrides`,
      payload,
    );
  }

  revokeOverride(id: string, reason?: string): Observable<ArEnvelope<ArOverride>> {
    return this.http.post<ArEnvelope<ArOverride>>(
      `${this.base}/overrides/${id}/revoke`,
      reason ? { reason } : {},
    );
  }

  checkCredit(params: ArCreditCheckParams): Observable<ArEnvelope<ArCreditDecision>> {
    return this.http.get<ArEnvelope<ArCreditDecision>>(`${this.base}/credit-check`, {
      params: toHttpParams(params),
    });
  }

  // --- Customer statement ---

  getStatement(customerId: string, period: ArStatementPeriod): Observable<ArEnvelope<ArStatement>> {
    return this.http.get<ArEnvelope<ArStatement>>(
      `${this.base}/customers/${customerId}/statement`,
      { params: toHttpParams(period) },
    );
  }

  downloadStatementPdf(customerId: string, period: ArStatementPeriod): Observable<Blob> {
    return this.http.get(`${this.base}/customers/${customerId}/statement/pdf`, {
      params: toHttpParams(period),
      responseType: 'blob',
    });
  }

  downloadStatementXlsx(customerId: string, period: ArStatementPeriod): Observable<Blob> {
    return this.http.get(`${this.base}/customers/${customerId}/statement/xlsx`, {
      params: toHttpParams(period),
      responseType: 'blob',
    });
  }

  sendStatement(
    customerId: string,
    payload: ArStatementSendPayload,
  ): Observable<ArEnvelope<ArStatementSendResult>> {
    return this.http.post<ArEnvelope<ArStatementSendResult>>(
      `${this.base}/customers/${customerId}/statement/send`,
      payload,
    );
  }

  /** Query string of the items list: the booleans travel as `1` / `0`, empty values are dropped. */
  private itemParams(filters: ArItemFilters): HttpParams {
    const { open_only: openOnly, ...rest } = filters;
    let params = toHttpParams(rest);
    if (openOnly !== undefined) {
      params = params.set('open_only', openOnly ? '1' : '0');
    }
    return params;
  }
}
