import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CollectionFailurePayload,
  CreatePlanPayload,
  CreateSubscriptionPayload,
  DunningPolicyResource,
  PaginatedResponse,
  ProrationPreview,
  ProrationPreviewParams,
  QueryFilterParams,
  RevenueContract,
  SubscriptionBillingRun,
  SubscriptionBillingRunPayload,
  SubscriptionContractResource,
  SubscriptionDunningCase,
  SubscriptionMetrics,
  SubscriptionPlanChangePayload,
  SubscriptionPlanResource,
  SubscriptionQuantityPayload,
  SubscriptionRevenueForecast,
  SubscriptionSuspendPayload,
  UsageEvent,
  UsageEventPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface SubscriptionContractFilterParams extends QueryFilterParams {
  customer_id?: string;
  plan_id?: string;
  status?: string;
  search?: string;
}

@Service()
export class SubscriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly subscriptionsUrl = `${environment.apiBaseUrl}/subscriptions`;
  private readonly plansUrl = `${environment.apiBaseUrl}/subscriptions/plans`;
  private readonly contractsUrl = `${environment.apiBaseUrl}/sub/contracts`;
  private readonly metricsUrl = `${environment.apiBaseUrl}/subscriptions/metrics`;
  private readonly dunningUrl = `${environment.apiBaseUrl}/subscriptions/dunning`;

  // --- Subscription Plans ---
  getPlans(params?: { is_active?: boolean }): Observable<PaginatedResponse<SubscriptionPlanResource>> {
    return this.http.get<PaginatedResponse<SubscriptionPlanResource>>(this.plansUrl, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getPlanById(id: string): Observable<ApiResponse<SubscriptionPlanResource>> {
    return this.http.get<ApiResponse<SubscriptionPlanResource>>(`${this.plansUrl}/${id}`);
  }

  createPlan(payload: CreatePlanPayload): Observable<ApiResponse<SubscriptionPlanResource>> {
    return this.http.post<ApiResponse<SubscriptionPlanResource>>(this.plansUrl, payload);
  }

  updatePlan(id: string, payload: Partial<CreatePlanPayload>): Observable<ApiResponse<SubscriptionPlanResource>> {
    return this.http.put<ApiResponse<SubscriptionPlanResource>>(`${this.plansUrl}/${id}`, payload);
  }

  /** Plans cannot be deleted: the API only allows to deactivate them (`is_active = false`). */
  deactivatePlan(id: string): Observable<ApiResponse<SubscriptionPlanResource>> {
    return this.http.put<ApiResponse<SubscriptionPlanResource>>(`${this.plansUrl}/${id}`, { is_active: false });
  }

  // --- Contracts (using active /sub/contracts successor) ---
  getContracts(params?: SubscriptionContractFilterParams): Observable<PaginatedResponse<SubscriptionContractResource>> {
    return this.http.get<PaginatedResponse<SubscriptionContractResource>>(this.contractsUrl, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getContractById(id: string): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.get<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}`);
  }

  createContract(payload: CreateSubscriptionPayload): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(this.contractsUrl, payload);
  }

  activateContract(id: string): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/activate`, {});
  }

  pauseContract(id: string, payload?: { reason?: string; resume_at?: string }): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/pause`, payload ?? {});
  }

  reactivateContract(id: string): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/reactivate`, {});
  }

  cancelContract(id: string, payload?: { reason?: string; cancel_at_period_end?: boolean }): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/cancel`, payload ?? {});
  }

  billContract(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.contractsUrl}/${id}/bill`, {});
  }

  getContractInvoices(id: string): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.contractsUrl}/${id}/invoices`);
  }

  // --- SaaS Metrics & Dunning ---
  getMetrics(params?: { as_of?: string; window_days?: number }): Observable<ApiResponse<SubscriptionMetrics>> {
    return this.http.get<ApiResponse<SubscriptionMetrics>>(this.metricsUrl, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDunningPolicy(): Observable<ApiResponse<DunningPolicyResource>> {
    return this.http.get<ApiResponse<DunningPolicyResource>>(`${environment.apiBaseUrl}/subscriptions/dunning-policy`);
  }

  runDunning(): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.dunningUrl}/run`, {});
  }

  // --- Plan changes, suspension and dunning of a contract ---
  upgradeContract(id: string, payload: SubscriptionPlanChangePayload): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/upgrade`, payload);
  }

  downgradeContract(id: string, payload: SubscriptionPlanChangePayload): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/downgrade`, payload);
  }

  changeContractQuantity(id: string, payload: SubscriptionQuantityPayload): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/quantity`, payload);
  }

  getProrationPreview(id: string, params: ProrationPreviewParams): Observable<ApiResponse<ProrationPreview>> {
    return this.http.get<ApiResponse<ProrationPreview>>(`${this.contractsUrl}/${id}/proration-preview`, {
      params: toHttpParams(params),
    });
  }

  suspendContract(id: string, payload: SubscriptionSuspendPayload = {}): Observable<ApiResponse<SubscriptionContractResource>> {
    return this.http.post<ApiResponse<SubscriptionContractResource>>(`${this.contractsUrl}/${id}/suspend`, payload);
  }

  recordCollectionFailure(id: string, payload: CollectionFailurePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.contractsUrl}/${id}/collection-failures`, payload);
  }

  getContractDunning(id: string): Observable<ApiResponse<SubscriptionDunningCase[]>> {
    return this.http.get<ApiResponse<SubscriptionDunningCase[]>>(`${this.contractsUrl}/${id}/dunning`);
  }

  // --- Usage billing and billing runs ---
  recordUsage(payload: UsageEventPayload): Observable<ApiResponse<UsageEvent>> {
    return this.http.post<ApiResponse<UsageEvent>>(`${this.subscriptionsUrl}/usage`, payload);
  }

  getUsageEvents(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<UsageEvent>> {
    return this.http.get<PaginatedResponse<UsageEvent>>(`${this.subscriptionsUrl}/usage`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getBillingRuns(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<SubscriptionBillingRun>> {
    return this.http.get<PaginatedResponse<SubscriptionBillingRun>>(`${this.subscriptionsUrl}/billing-runs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getBillingRun(id: string): Observable<ApiResponse<SubscriptionBillingRun>> {
    return this.http.get<ApiResponse<SubscriptionBillingRun>>(`${this.subscriptionsUrl}/billing-runs/${id}`);
  }

  runBilling(payload: SubscriptionBillingRunPayload = {}): Observable<ApiResponse<SubscriptionBillingRun>> {
    return this.http.post<ApiResponse<SubscriptionBillingRun>>(`${this.subscriptionsUrl}/billing-runs`, payload);
  }

  // --- Revenue recognition and forecast ---
  getRevenueContracts(params?: { page?: number; per_page?: number }): Observable<PaginatedResponse<RevenueContract>> {
    return this.http.get<PaginatedResponse<RevenueContract>>(`${this.subscriptionsUrl}/revenue-contracts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getRevenueContract(id: string): Observable<ApiResponse<RevenueContract>> {
    return this.http.get<ApiResponse<RevenueContract>>(`${this.subscriptionsUrl}/revenue-contracts/${id}`);
  }

  recognizeRevenue(periodDate?: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.subscriptionsUrl}/revenue-recognition/recognize`,
      periodDate ? { period_date: periodDate } : {},
    );
  }

  getSubscriptionForecast(months?: number): Observable<ApiResponse<SubscriptionRevenueForecast>> {
    return this.http.get<ApiResponse<SubscriptionRevenueForecast>>(`${this.subscriptionsUrl}/forecast`, {
      params: months ? toHttpParams({ months }) : undefined,
    });
  }}
