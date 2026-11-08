import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ConsentHistoryItem,
  ConsentResponse,
  ContactMergeRecord,
  ContactResource,
  ContactStatistics,
  ContactStatement,
  ContactType,
  CreateContactPayload,
  CrmDuplicateMatch,
  LeadResource,
  MergeContactsPayload,
  OpportunityResource,
  PaginatedResponse,
  PipelineStageResource,
  QueryFilterParams,
  StoreConsentPayload,
  StoreLeadPayload,
  StoreOpportunityPayload,
  UpdateContactPayload,
  UpdateLeadPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface CrmContactFilterParams extends QueryFilterParams {
  type?: ContactType | string;
  country?: string;
  search?: string;
}

export interface CrmLeadFilterParams extends QueryFilterParams {
  status?: string;
  rating?: string;
  country?: string;
  search?: string;
}

export interface CrmOpportunityFilterParams extends QueryFilterParams {
  stage_code?: string;
  forecast_category?: string;
  search?: string;
}

@Service()
export class CrmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm`;

  // --- Contacts / Clients / Suppliers ---
  getContacts(filters?: CrmContactFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http.get<PaginatedResponse<ContactResource>>(`${this.base}/contacts`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getClients(params?: QueryFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http.get<PaginatedResponse<ContactResource>>(`${this.base}/clients`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSuppliers(params?: QueryFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http.get<PaginatedResponse<ContactResource>>(`${this.base}/suppliers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getContactById(id: string): Observable<ApiResponse<ContactResource>> {
    return this.http.get<ApiResponse<ContactResource>>(`${this.base}/contacts/${id}`);
  }

  createContact(payload: CreateContactPayload): Observable<ApiResponse<ContactResource>> {
    return this.http.post<ApiResponse<ContactResource>>(`${this.base}/contacts`, payload);
  }

  updateContact(id: string, payload: UpdateContactPayload): Observable<ApiResponse<ContactResource>> {
    return this.http.put<ApiResponse<ContactResource>>(`${this.base}/contacts/${id}`, payload);
  }

  deleteContact(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/contacts/${id}`);
  }

  getContactStatistics(id: string): Observable<ApiResponse<ContactStatistics>> {
    return this.http.get<ApiResponse<ContactStatistics>>(`${this.base}/contacts/${id}/statistics`);
  }

  getContactStatement(id: string, asOf?: string): Observable<ApiResponse<ContactStatement>> {
    return this.http.get<ApiResponse<ContactStatement>>(`${this.base}/contacts/${id}/statement`, {
      params: asOf ? toHttpParams({ as_of: asOf }) : undefined,
    });
  }

  emailContactStatement(id: string, payload: { email: string; note?: string }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/contacts/${id}/statement/email`, payload);
  }

  // --- Leads ---
  getLeads(params?: CrmLeadFilterParams): Observable<PaginatedResponse<LeadResource>> {
    return this.http.get<PaginatedResponse<LeadResource>>(`${this.base}/leads`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getLeadById(id: string): Observable<ApiResponse<LeadResource>> {
    return this.http.get<ApiResponse<LeadResource>>(`${this.base}/leads/${id}`);
  }

  createLead(payload: StoreLeadPayload): Observable<ApiResponse<LeadResource>> {
    return this.http.post<ApiResponse<LeadResource>>(`${this.base}/leads`, payload);
  }

  updateLead(id: string, payload: UpdateLeadPayload): Observable<ApiResponse<LeadResource>> {
    return this.http.put<ApiResponse<LeadResource>>(`${this.base}/leads/${id}`, payload);
  }

  deleteLead(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/leads/${id}`);
  }

  qualifyLead(id: string): Observable<ApiResponse<LeadResource>> {
    return this.http.post<ApiResponse<LeadResource>>(`${this.base}/leads/${id}/qualify`, {});
  }

  disqualifyLead(id: string, payload?: { reason?: string }): Observable<ApiResponse<LeadResource>> {
    return this.http.post<ApiResponse<LeadResource>>(`${this.base}/leads/${id}/disqualify`, payload ?? {});
  }

  convertLead(id: string, payload?: { create_opportunity?: boolean; opportunity_name?: string }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/leads/${id}/convert`, payload ?? {});
  }

  scoreLead(id: string): Observable<ApiResponse<LeadResource>> {
    return this.http.post<ApiResponse<LeadResource>>(`${this.base}/leads/${id}/score`, {});
  }

  getLeadDuplicates(id?: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.base}/leads/duplicates`, {
      params: id ? toHttpParams({ id }) : undefined,
    });
  }

  // --- Opportunities & Pipeline ---
  getOpportunities(params?: CrmOpportunityFilterParams): Observable<PaginatedResponse<OpportunityResource>> {
    return this.http.get<PaginatedResponse<OpportunityResource>>(`${this.base}/opportunities`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getOpportunityById(id: string): Observable<ApiResponse<OpportunityResource>> {
    return this.http.get<ApiResponse<OpportunityResource>>(`${this.base}/opportunities/${id}`);
  }

  createOpportunity(payload: StoreOpportunityPayload): Observable<ApiResponse<OpportunityResource>> {
    return this.http.post<ApiResponse<OpportunityResource>>(`${this.base}/opportunities`, payload);
  }

  updateOpportunity(id: string, payload: Partial<StoreOpportunityPayload>): Observable<ApiResponse<OpportunityResource>> {
    return this.http.put<ApiResponse<OpportunityResource>>(`${this.base}/opportunities/${id}`, payload);
  }

  deleteOpportunity(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/opportunities/${id}`);
  }

  updateOpportunityStage(id: string, stageCode: string): Observable<ApiResponse<OpportunityResource>> {
    return this.http.put<ApiResponse<OpportunityResource>>(`${this.base}/opportunities/${id}/stage`, {
      stage_code: stageCode,
    });
  }

  getPipelineStages(): Observable<ApiResponse<PipelineStageResource[]>> {
    return this.http.get<ApiResponse<PipelineStageResource[]>>(`${this.base}/pipeline-stages`);
  }

  // --- Duplicates & Merges ---
  getDuplicates(params?: {
    entity?: 'contacts' | 'leads';
    vat_number?: string;
    fiscal_code?: string;
    email?: string;
    phone?: string;
  }): Observable<ApiResponse<CrmDuplicateMatch>> {
    return this.http.get<ApiResponse<CrmDuplicateMatch>>(`${this.base}/duplicates`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getContactMerges(params?: QueryFilterParams): Observable<PaginatedResponse<ContactMergeRecord>> {
    return this.http.get<PaginatedResponse<ContactMergeRecord>>(`${this.base}/contact-merges`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  mergeContacts(payload: MergeContactsPayload): Observable<ApiResponse<ContactMergeRecord>> {
    return this.http.post<ApiResponse<ContactMergeRecord>>(`${this.base}/contact-merges`, payload);
  }

  // --- Consents ---
  getConsents(params?: { contact_id?: string; lead_id?: string }): Observable<ApiResponse<ConsentResponse>> {
    return this.http.get<ApiResponse<ConsentResponse>>(`${this.base}/consents`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  storeConsent(payload: StoreConsentPayload): Observable<ApiResponse<ConsentHistoryItem>> {
    return this.http.post<ApiResponse<ConsentHistoryItem>>(`${this.base}/consents`, payload);
  }
}
