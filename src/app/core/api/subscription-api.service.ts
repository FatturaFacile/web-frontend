import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreatePlanPayload,
  CreateSubscriptionPayload,
  DunningPolicyResource,
  PaginatedResponse,
  QueryFilterParams,
  SubscriptionContractResource,
  SubscriptionMetrics,
  SubscriptionPlanResource,
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

  deletePlan(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.plansUrl}/${id}`);
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
}
