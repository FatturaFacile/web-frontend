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
  ContactStatement,
  ContactStatistics,
  ContactType,
  CreateContactPayload,
  CrmAccount,
  CrmAccountFilterParams,
  CrmAccountHealth,
  CrmAccountPayload,
  CrmActivity,
  CrmActivityFilterParams,
  CrmActivityPayload,
  CrmActivityTimelineParams,
  CrmActivityUpdatePayload,
  CrmCampaign,
  CrmCampaignMember,
  CrmCampaignMemberPayload,
  CrmCampaignPayload,
  CrmCampaignRoi,
  CrmDuplicateMatch,
  CrmForecast,
  CrmForecastGeneratePayload,
  CrmPartyLink,
  CrmReport,
  CrmReportParams,
  CrmSegment,
  CrmSegmentPayload,
  LeadResource,
  LeadScoringRule,
  LeadScoringRulePayload,
  MergeContactsPayload,
  OpportunityResource,
  PaginatedResponse,
  PipelineStageResource,
  PipelineStageUpdatePayload,
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

  // --- Accounts ---
  getAccounts(params?: CrmAccountFilterParams): Observable<PaginatedResponse<CrmAccount>> {
    return this.http.get<PaginatedResponse<CrmAccount>>(`${this.base}/accounts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAccountPartyLinks(outcome?: string): Observable<PaginatedResponse<CrmPartyLink>> {
    return this.http.get<PaginatedResponse<CrmPartyLink>>(`${this.base}/accounts/party-links`, {
      params: outcome ? toHttpParams({ outcome }) : undefined,
    });
  }

  getAccountById(id: string): Observable<ApiResponse<CrmAccount>> {
    return this.http.get<ApiResponse<CrmAccount>>(`${this.base}/accounts/${id}`);
  }

  getAccountHealth(id: string): Observable<ApiResponse<CrmAccountHealth>> {
    return this.http.get<ApiResponse<CrmAccountHealth>>(`${this.base}/accounts/${id}/health`);
  }

  createAccount(payload: CrmAccountPayload): Observable<ApiResponse<CrmAccount>> {
    return this.http.post<ApiResponse<CrmAccount>>(`${this.base}/accounts`, payload);
  }

  updateAccount(id: string, payload: CrmAccountPayload): Observable<ApiResponse<CrmAccount>> {
    return this.http.put<ApiResponse<CrmAccount>>(`${this.base}/accounts/${id}`, payload);
  }

  deleteAccount(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/accounts/${id}`);
  }

  // --- Activities ---
  getActivities(params?: CrmActivityFilterParams): Observable<PaginatedResponse<CrmActivity>> {
    return this.http.get<PaginatedResponse<CrmActivity>>(`${this.base}/activities`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getActivityTimeline(params: CrmActivityTimelineParams): Observable<ApiResponse<CrmActivity[]>> {
    return this.http.get<ApiResponse<CrmActivity[]>>(`${this.base}/activities/timeline`, {
      params: toHttpParams(params),
    });
  }

  getActivityById(id: string): Observable<ApiResponse<CrmActivity>> {
    return this.http.get<ApiResponse<CrmActivity>>(`${this.base}/activities/${id}`);
  }

  createActivity(payload: CrmActivityPayload): Observable<ApiResponse<CrmActivity>> {
    return this.http.post<ApiResponse<CrmActivity>>(`${this.base}/activities`, payload);
  }

  updateActivity(id: string, payload: CrmActivityUpdatePayload): Observable<ApiResponse<CrmActivity>> {
    return this.http.put<ApiResponse<CrmActivity>>(`${this.base}/activities/${id}`, payload);
  }

  completeActivity(id: string, outcome?: string): Observable<ApiResponse<CrmActivity>> {
    return this.http.post<ApiResponse<CrmActivity>>(
      `${this.base}/activities/${id}/complete`,
      outcome ? { outcome } : {},
    );
  }

  // --- Segments ---
  getSegments(): Observable<ApiResponse<CrmSegment[]>> {
    return this.http.get<ApiResponse<CrmSegment[]>>(`${this.base}/segments`);
  }

  getSegmentById(id: string): Observable<ApiResponse<CrmSegment>> {
    return this.http.get<ApiResponse<CrmSegment>>(`${this.base}/segments/${id}`);
  }

  getSegmentMembers(id: string): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.base}/segments/${id}/members`);
  }

  createSegment(payload: CrmSegmentPayload): Observable<ApiResponse<CrmSegment>> {
    return this.http.post<ApiResponse<CrmSegment>>(`${this.base}/segments`, payload);
  }

  updateSegment(id: string, payload: CrmSegmentPayload): Observable<ApiResponse<CrmSegment>> {
    return this.http.put<ApiResponse<CrmSegment>>(`${this.base}/segments/${id}`, payload);
  }

  deleteSegment(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/segments/${id}`);
  }

  // --- Lead scoring rules ---
  getLeadScoringRules(): Observable<ApiResponse<LeadScoringRule[]>> {
    return this.http.get<ApiResponse<LeadScoringRule[]>>(`${this.base}/lead-scoring-rules`);
  }

  createLeadScoringRule(payload: LeadScoringRulePayload): Observable<ApiResponse<LeadScoringRule>> {
    return this.http.post<ApiResponse<LeadScoringRule>>(`${this.base}/lead-scoring-rules`, payload);
  }

  updateLeadScoringRule(id: string, payload: LeadScoringRulePayload): Observable<ApiResponse<LeadScoringRule>> {
    return this.http.put<ApiResponse<LeadScoringRule>>(`${this.base}/lead-scoring-rules/${id}`, payload);
  }

  deleteLeadScoringRule(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/lead-scoring-rules/${id}`);
  }

  recalculateLeadScores(leadId?: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${this.base}/lead-scoring-rules/recalculate`,
      leadId ? { lead_id: leadId } : {},
    );
  }

  // --- Campaigns ---
  getCampaigns(params?: { page?: number; per_page?: number; search?: string }): Observable<PaginatedResponse<CrmCampaign>> {
    return this.http.get<PaginatedResponse<CrmCampaign>>(`${this.base}/campaigns`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCampaignById(id: string): Observable<ApiResponse<CrmCampaign>> {
    return this.http.get<ApiResponse<CrmCampaign>>(`${this.base}/campaigns/${id}`);
  }

  createCampaign(payload: CrmCampaignPayload): Observable<ApiResponse<CrmCampaign>> {
    return this.http.post<ApiResponse<CrmCampaign>>(`${this.base}/campaigns`, payload);
  }

  getCampaignRoi(id: string): Observable<ApiResponse<CrmCampaignRoi>> {
    return this.http.get<ApiResponse<CrmCampaignRoi>>(`${this.base}/campaigns/${id}/roi`);
  }

  getCampaignMembers(id: string, status?: string): Observable<ApiResponse<CrmCampaignMember[]>> {
    return this.http.get<ApiResponse<CrmCampaignMember[]>>(`${this.base}/campaigns/${id}/members`, {
      params: status ? toHttpParams({ status }) : undefined,
    });
  }

  addCampaignMembers(id: string, payload: CrmCampaignMemberPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/campaigns/${id}/members`, payload);
  }

  removeCampaignMember(id: string, memberId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/campaigns/${id}/members/${memberId}`);
  }

  sendCampaign(id: string, payload: { subject: string; body: string }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/campaigns/${id}/send`, payload);
  }

  // --- Reports and forecasts ---
  getPipelineReport(params?: CrmReportParams): Observable<ApiResponse<CrmReport>> {
    return this.http.get<ApiResponse<CrmReport>>(`${this.base}/reports/pipeline`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getConversionReport(params?: CrmReportParams): Observable<ApiResponse<CrmReport>> {
    return this.http.get<ApiResponse<CrmReport>>(`${this.base}/reports/conversion`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getActivitiesReport(params?: CrmReportParams): Observable<ApiResponse<CrmReport>> {
    return this.http.get<ApiResponse<CrmReport>>(`${this.base}/reports/activities`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getForecasts(params?: { period?: string; page?: number; per_page?: number }): Observable<PaginatedResponse<CrmForecast>> {
    return this.http.get<PaginatedResponse<CrmForecast>>(`${this.base}/forecasts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  generateForecast(payload: CrmForecastGeneratePayload): Observable<ApiResponse<CrmForecast>> {
    return this.http.post<ApiResponse<CrmForecast>>(`${this.base}/forecasts/generate`, payload);
  }

  lockForecast(id: string): Observable<ApiResponse<CrmForecast>> {
    return this.http.post<ApiResponse<CrmForecast>>(`${this.base}/forecasts/${id}/lock`, {});
  }

  // --- Pipeline stage maintenance and opportunity conversions ---
  installDefaultPipelineStages(): Observable<ApiResponse<PipelineStageResource[]>> {
    return this.http.post<ApiResponse<PipelineStageResource[]>>(`${this.base}/pipeline-stages/defaults`, {});
  }

  updatePipelineStage(id: string, payload: PipelineStageUpdatePayload): Observable<ApiResponse<PipelineStageResource>> {
    return this.http.put<ApiResponse<PipelineStageResource>>(`${this.base}/pipeline-stages/${id}`, payload);
  }

  deletePipelineStage(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/pipeline-stages/${id}`);
  }

  createQuoteFromOpportunity(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/opportunities/${id}/quote`, {});
  }

  createProjectFromOpportunity(id: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/opportunities/${id}/project`, {});
  }}
