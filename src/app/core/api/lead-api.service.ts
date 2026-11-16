import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ConvertLeadPayload,
  ConvertLeadResponse,
  CreateLeadPayload,
  CreateLeadResponse,
  CreateWebhookPayload,
  LeadBehaviorEvent,
  LeadFilterParams,
  LeadListResponse,
  LeadResource,
  LeadRoutingRule,
  LeadWebhookEndpoint,
  SaveRoutingRulePayload,
  UpdateLeadPayload,
} from '../models/lead.model';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class LeadApiService {
  private readonly http = inject(HttpClient);
  private readonly crm = `${environment.apiBaseUrl}/crm`;
  private readonly base = `${this.crm}/leads`;

  list(filters?: LeadFilterParams): Observable<LeadListResponse> {
    return this.http.get<LeadListResponse>(this.base, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  create(payload: CreateLeadPayload): Observable<CreateLeadResponse> {
    return this.http.post<CreateLeadResponse>(this.base, payload);
  }

  qualify(id: string): Observable<LeadResource> {
    return this.http.post<LeadResource>(`${this.base}/${id}/qualify`, {});
  }

  disqualify(id: string, reason: string): Observable<LeadResource> {
    return this.http.post<LeadResource>(`${this.base}/${id}/disqualify`, { reason });
  }

  merge(id: string, duplicateId: string): Observable<LeadResource> {
    return this.http.post<LeadResource>(`${this.base}/${id}/merge`, { duplicate_id: duplicateId });
  }

  /** One-click conversion into Account + Contact + Opportunity. */
  convert(id: string, payload: ConvertLeadPayload = {}): Observable<ConvertLeadResponse> {
    return this.http.post<ConvertLeadResponse>(`${this.base}/${id}/convert`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  // --- Web-to-Lead endpoints -------------------------------------------------
  listWebhooks(): Observable<{ data: LeadWebhookEndpoint[] }> {
    return this.http.get<{ data: LeadWebhookEndpoint[] }>(`${this.crm}/lead-webhooks`);
  }

  createWebhook(payload: CreateWebhookPayload): Observable<LeadWebhookEndpoint> {
    return this.http.post<LeadWebhookEndpoint>(`${this.crm}/lead-webhooks`, payload);
  }

  rotateWebhookSecret(id: string): Observable<LeadWebhookEndpoint> {
    return this.http.post<LeadWebhookEndpoint>(`${this.crm}/lead-webhooks/${id}/rotate-secret`, {});
  }

  deleteWebhook(id: string): Observable<void> {
    return this.http.delete<void>(`${this.crm}/lead-webhooks/${id}`);
  }

  // --- Routing rules ---------------------------------------------------------
  listRoutingRules(): Observable<{ data: LeadRoutingRule[] }> {
    return this.http.get<{ data: LeadRoutingRule[] }>(`${this.crm}/lead-routing-rules`);
  }

  createRoutingRule(payload: SaveRoutingRulePayload): Observable<LeadRoutingRule> {
    return this.http.post<LeadRoutingRule>(`${this.crm}/lead-routing-rules`, payload);
  }

  deleteRoutingRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.crm}/lead-routing-rules/${id}`);
  }

  get(id: string): Observable<LeadResource> {
    return this.http.get<LeadResource>(`${this.base}/${id}`);
  }

  update(id: string, payload: UpdateLeadPayload): Observable<LeadResource> {
    return this.http.put<LeadResource>(`${this.base}/${id}`, payload);
  }

  /** Leads matching the given email / phone (E.164 normalised) / VAT number / company name. */
  detectDuplicates(params: {
    email?: string | null;
    phone?: string | null;
    company_name?: string | null;
    vat_number?: string | null;
  }): Observable<LeadResource[]> {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => !!v));
    return this.http.get<LeadResource[]>(`${this.base}/duplicates`, { params: toHttpParams(clean) });
  }

  /** Records an engagement event and re-scores the lead. */
  recordBehavior(id: string, event: LeadBehaviorEvent, count = 1): Observable<LeadResource> {
    return this.http.post<LeadResource>(`${this.base}/${id}/behavior`, { event, count });
  }

  updateRoutingRule(id: string, payload: Partial<SaveRoutingRulePayload>): Observable<LeadRoutingRule> {
    return this.http.put<LeadRoutingRule>(`${this.crm}/lead-routing-rules/${id}`, payload);
  }
}
