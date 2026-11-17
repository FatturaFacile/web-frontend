import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CrmAutomationEnrollment,
  CrmAutomationEnrollRequest,
  CrmAutomationSequence,
  CrmAutomationSequenceRequest,
  CrmAutomationStepLog,
  CrmDealRegistration,
  CrmDealRegistrationRequest,
  CrmDiscountThreshold,
  CrmDiscountThresholdRequest,
  CrmExtensionResponse,
  CrmMdfClaim,
  CrmMdfClaimRequest,
  CrmMdfFund,
  CrmMdfFundRequest,
  CrmPartner,
  CrmPartnerRequest,
  CrmPartnerTier,
  CrmPartnerTierRequest,
  CrmPricingRule,
  CrmPricingRuleRequest,
  CrmQuoteConfiguration,
  CrmQuoteConfigurationRequest,
  CrmQuotePreview,
  CrmSalesQuota,
  CrmSalesQuotaRequest,
  CrmTerritory,
  CrmTerritoryAssignmentResult,
  CrmTerritoryRequest,
} from '../models';

/** Territories and quotas, partners (PRM), CPQ and marketing automation of the CRM module. */
@Service()
export class CrmExtensionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm`;

  // Territories and quotas
  getTerritories(): Observable<CrmExtensionResponse<CrmTerritory[]>> {
    return this.http.get<CrmExtensionResponse<CrmTerritory[]>>(`${this.base}/territories`);
  }

  createTerritory(payload: CrmTerritoryRequest): Observable<CrmExtensionResponse<CrmTerritory>> {
    return this.http.post<CrmExtensionResponse<CrmTerritory>>(`${this.base}/territories`, payload);
  }

  updateTerritory(id: string, payload: Partial<CrmTerritoryRequest>): Observable<CrmExtensionResponse<CrmTerritory>> {
    return this.http.put<CrmExtensionResponse<CrmTerritory>>(`${this.base}/territories/${id}`, payload);
  }

  deleteTerritory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/territories/${id}`);
  }

  assignTerritories(): Observable<CrmExtensionResponse<CrmTerritoryAssignmentResult>> {
    return this.http.post<CrmExtensionResponse<CrmTerritoryAssignmentResult>>(`${this.base}/territories/assign`, {});
  }

  getSalesQuotas(userId?: string): Observable<CrmExtensionResponse<CrmSalesQuota[]>> {
    return this.http.get<CrmExtensionResponse<CrmSalesQuota[]>>(`${this.base}/sales-quotas`, { params: this.params({ assignee_id: userId }) });
  }

  createSalesQuota(payload: CrmSalesQuotaRequest): Observable<CrmExtensionResponse<CrmSalesQuota>> {
    return this.http.post<CrmExtensionResponse<CrmSalesQuota>>(`${this.base}/sales-quotas`, payload);
  }

  deleteSalesQuota(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/sales-quotas/${id}`);
  }

  // Partners
  getPartnerTiers(): Observable<CrmExtensionResponse<CrmPartnerTier[]>> {
    return this.http.get<CrmExtensionResponse<CrmPartnerTier[]>>(`${this.base}/partner-tiers`);
  }

  createPartnerTier(payload: CrmPartnerTierRequest): Observable<CrmExtensionResponse<CrmPartnerTier>> {
    return this.http.post<CrmExtensionResponse<CrmPartnerTier>>(`${this.base}/partner-tiers`, payload);
  }

  getPartners(status?: string): Observable<CrmExtensionResponse<CrmPartner[]>> {
    return this.http.get<CrmExtensionResponse<CrmPartner[]>>(`${this.base}/partners`, { params: this.params({ status }) });
  }

  createPartner(payload: CrmPartnerRequest): Observable<CrmExtensionResponse<CrmPartner>> {
    return this.http.post<CrmExtensionResponse<CrmPartner>>(`${this.base}/partners`, payload);
  }

  deletePartner(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/partners/${id}`);
  }

  evaluatePartnerTiers(): Observable<CrmExtensionResponse<{ changed: number }>> {
    return this.http.post<CrmExtensionResponse<{ changed: number }>>(`${this.base}/partners/evaluate-tiers`, {});
  }

  getDealRegistrations(status?: string): Observable<CrmExtensionResponse<CrmDealRegistration[]>> {
    return this.http.get<CrmExtensionResponse<CrmDealRegistration[]>>(`${this.base}/deal-registrations`, { params: this.params({ status }) });
  }

  createDealRegistration(payload: CrmDealRegistrationRequest): Observable<CrmExtensionResponse<CrmDealRegistration>> {
    return this.http.post<CrmExtensionResponse<CrmDealRegistration>>(`${this.base}/deal-registrations`, payload);
  }

  approveDealRegistration(id: string): Observable<CrmExtensionResponse<CrmDealRegistration>> {
    return this.http.post<CrmExtensionResponse<CrmDealRegistration>>(`${this.base}/deal-registrations/${id}/approve`, {});
  }

  rejectDealRegistration(id: string, reason: string): Observable<CrmExtensionResponse<CrmDealRegistration>> {
    return this.http.post<CrmExtensionResponse<CrmDealRegistration>>(`${this.base}/deal-registrations/${id}/reject`, { reason });
  }

  markDealRegistrationWon(id: string): Observable<CrmExtensionResponse<CrmDealRegistration>> {
    return this.http.post<CrmExtensionResponse<CrmDealRegistration>>(`${this.base}/deal-registrations/${id}/won`, {});
  }

  expireDealRegistrations(): Observable<CrmExtensionResponse<{ expired: number }>> {
    return this.http.post<CrmExtensionResponse<{ expired: number }>>(`${this.base}/deal-registrations/expire`, {});
  }

  getMdfFunds(): Observable<CrmExtensionResponse<CrmMdfFund[]>> {
    return this.http.get<CrmExtensionResponse<CrmMdfFund[]>>(`${this.base}/mdf-funds`);
  }

  createMdfFund(payload: CrmMdfFundRequest): Observable<CrmExtensionResponse<CrmMdfFund>> {
    return this.http.post<CrmExtensionResponse<CrmMdfFund>>(`${this.base}/mdf-funds`, payload);
  }

  getMdfClaims(status?: string): Observable<CrmExtensionResponse<CrmMdfClaim[]>> {
    return this.http.get<CrmExtensionResponse<CrmMdfClaim[]>>(`${this.base}/mdf-claims`, { params: this.params({ status }) });
  }

  submitMdfClaim(fundId: string, payload: CrmMdfClaimRequest): Observable<CrmExtensionResponse<CrmMdfClaim>> {
    return this.http.post<CrmExtensionResponse<CrmMdfClaim>>(`${this.base}/mdf-funds/${fundId}/claims`, payload);
  }

  approveMdfClaim(id: string): Observable<CrmExtensionResponse<CrmMdfClaim>> {
    return this.http.post<CrmExtensionResponse<CrmMdfClaim>>(`${this.base}/mdf-claims/${id}/approve`, {});
  }

  rejectMdfClaim(id: string, reason: string): Observable<CrmExtensionResponse<CrmMdfClaim>> {
    return this.http.post<CrmExtensionResponse<CrmMdfClaim>>(`${this.base}/mdf-claims/${id}/reject`, { reason });
  }

  payMdfClaim(id: string): Observable<CrmExtensionResponse<CrmMdfClaim>> {
    return this.http.post<CrmExtensionResponse<CrmMdfClaim>>(`${this.base}/mdf-claims/${id}/pay`, {});
  }

  // CPQ
  getPricingRules(): Observable<CrmExtensionResponse<CrmPricingRule[]>> {
    return this.http.get<CrmExtensionResponse<CrmPricingRule[]>>(`${this.base}/pricing-rules`);
  }

  createPricingRule(payload: CrmPricingRuleRequest): Observable<CrmExtensionResponse<CrmPricingRule>> {
    return this.http.post<CrmExtensionResponse<CrmPricingRule>>(`${this.base}/pricing-rules`, payload);
  }

  deletePricingRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/pricing-rules/${id}`);
  }

  getDiscountThresholds(): Observable<CrmExtensionResponse<CrmDiscountThreshold[]>> {
    return this.http.get<CrmExtensionResponse<CrmDiscountThreshold[]>>(`${this.base}/discount-thresholds`);
  }

  createDiscountThreshold(payload: CrmDiscountThresholdRequest): Observable<CrmExtensionResponse<CrmDiscountThreshold>> {
    return this.http.post<CrmExtensionResponse<CrmDiscountThreshold>>(`${this.base}/discount-thresholds`, payload);
  }

  deleteDiscountThreshold(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/discount-thresholds/${id}`);
  }

  getQuoteConfigurations(status?: string): Observable<CrmExtensionResponse<CrmQuoteConfiguration[]>> {
    return this.http.get<CrmExtensionResponse<CrmQuoteConfiguration[]>>(`${this.base}/quote-configurations`, { params: this.params({ status }) });
  }

  createQuoteConfiguration(payload: CrmQuoteConfigurationRequest): Observable<CrmExtensionResponse<CrmQuoteConfiguration>> {
    return this.http.post<CrmExtensionResponse<CrmQuoteConfiguration>>(`${this.base}/quote-configurations`, payload);
  }

  previewQuoteConfiguration(payload: CrmQuoteConfigurationRequest): Observable<CrmExtensionResponse<CrmQuotePreview>> {
    return this.http.post<CrmExtensionResponse<CrmQuotePreview>>(`${this.base}/quote-configurations/preview`, payload);
  }

  submitQuoteConfiguration(id: string): Observable<CrmExtensionResponse<CrmQuoteConfiguration>> {
    return this.http.post<CrmExtensionResponse<CrmQuoteConfiguration>>(`${this.base}/quote-configurations/${id}/submit`, {});
  }

  approveQuoteConfiguration(id: string): Observable<CrmExtensionResponse<CrmQuoteConfiguration>> {
    return this.http.post<CrmExtensionResponse<CrmQuoteConfiguration>>(`${this.base}/quote-configurations/${id}/approve`, {});
  }

  rejectQuoteConfiguration(id: string, reason: string): Observable<CrmExtensionResponse<CrmQuoteConfiguration>> {
    return this.http.post<CrmExtensionResponse<CrmQuoteConfiguration>>(`${this.base}/quote-configurations/${id}/reject`, { reason });
  }

  deleteQuoteConfiguration(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/quote-configurations/${id}`);
  }

  // Marketing automation
  getAutomationSequences(): Observable<CrmExtensionResponse<CrmAutomationSequence[]>> {
    return this.http.get<CrmExtensionResponse<CrmAutomationSequence[]>>(`${this.base}/automation-sequences`);
  }

  createAutomationSequence(payload: CrmAutomationSequenceRequest): Observable<CrmExtensionResponse<CrmAutomationSequence>> {
    return this.http.post<CrmExtensionResponse<CrmAutomationSequence>>(`${this.base}/automation-sequences`, payload);
  }

  updateAutomationSequence(id: string, payload: Partial<CrmAutomationSequenceRequest>): Observable<CrmExtensionResponse<CrmAutomationSequence>> {
    return this.http.put<CrmExtensionResponse<CrmAutomationSequence>>(`${this.base}/automation-sequences/${id}`, payload);
  }

  deleteAutomationSequence(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/automation-sequences/${id}`);
  }

  enrollInAutomation(id: string, payload: CrmAutomationEnrollRequest): Observable<CrmExtensionResponse<CrmAutomationEnrollment>> {
    return this.http.post<CrmExtensionResponse<CrmAutomationEnrollment>>(`${this.base}/automation-sequences/${id}/enroll`, payload);
  }

  getAutomationEnrollments(id: string, status?: string): Observable<CrmExtensionResponse<CrmAutomationEnrollment[]>> {
    return this.http.get<CrmExtensionResponse<CrmAutomationEnrollment[]>>(`${this.base}/automation-sequences/${id}/enrollments`, { params: this.params({ status }) });
  }

  exitAutomationEnrollment(id: string): Observable<CrmExtensionResponse<CrmAutomationEnrollment>> {
    return this.http.post<CrmExtensionResponse<CrmAutomationEnrollment>>(`${this.base}/automation-enrollments/${id}/exit`, {});
  }

  getAutomationStepLogs(enrollmentId: string): Observable<CrmExtensionResponse<CrmAutomationStepLog[]>> {
    return this.http.get<CrmExtensionResponse<CrmAutomationStepLog[]>>(`${this.base}/automation-enrollments/${enrollmentId}/logs`);
  }

  runAutomation(): Observable<CrmExtensionResponse<{ handled: number }>> {
    return this.http.post<CrmExtensionResponse<{ handled: number }>>(`${this.base}/automation-sequences/run`, {});
  }

  // Single-record endpoints (show / update / delete) and territory helpers
  getTerritory(id: string): Observable<CrmExtensionResponse<CrmTerritory>> {
    return this.http.get<CrmExtensionResponse<CrmTerritory>>(`${this.base}/territories/${id}`);
  }

  /** Accounts currently assigned to a territory. */
  getTerritoryAccounts(id: string): Observable<CrmExtensionResponse<unknown[]>> {
    return this.http.get<CrmExtensionResponse<unknown[]>>(`${this.base}/territories/${id}/accounts`);
  }

  /** Manually assigns an account to a territory. */
  assignAccountToTerritory(accountId: string, territoryId: string | null): Observable<CrmExtensionResponse<unknown>> {
    return this.http.post<CrmExtensionResponse<unknown>>(`${this.base}/accounts/${accountId}/territory`, { territory_id: territoryId });
  }

  getSalesQuota(id: string): Observable<CrmExtensionResponse<CrmSalesQuota>> {
    return this.http.get<CrmExtensionResponse<CrmSalesQuota>>(`${this.base}/sales-quotas/${id}`);
  }

  updateSalesQuota(id: string, payload: Partial<CrmSalesQuotaRequest>): Observable<CrmExtensionResponse<CrmSalesQuota>> {
    return this.http.put<CrmExtensionResponse<CrmSalesQuota>>(`${this.base}/sales-quotas/${id}`, payload);
  }

  getPartnerTier(id: string): Observable<CrmExtensionResponse<CrmPartnerTier>> {
    return this.http.get<CrmExtensionResponse<CrmPartnerTier>>(`${this.base}/partner-tiers/${id}`);
  }

  updatePartnerTier(id: string, payload: Partial<CrmPartnerTierRequest>): Observable<CrmExtensionResponse<CrmPartnerTier>> {
    return this.http.put<CrmExtensionResponse<CrmPartnerTier>>(`${this.base}/partner-tiers/${id}`, payload);
  }

  deletePartnerTier(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/partner-tiers/${id}`);
  }

  getPartner(id: string): Observable<CrmExtensionResponse<CrmPartner>> {
    return this.http.get<CrmExtensionResponse<CrmPartner>>(`${this.base}/partners/${id}`);
  }

  updatePartner(id: string, payload: Partial<CrmPartnerRequest>): Observable<CrmExtensionResponse<CrmPartner>> {
    return this.http.put<CrmExtensionResponse<CrmPartner>>(`${this.base}/partners/${id}`, payload);
  }

  /** Re-evaluates the tier of a single partner. */
  evaluatePartnerTier(id: string): Observable<CrmExtensionResponse<CrmPartner>> {
    return this.http.post<CrmExtensionResponse<CrmPartner>>(`${this.base}/partners/${id}/evaluate-tier`, {});
  }

  getDealRegistration(id: string): Observable<CrmExtensionResponse<CrmDealRegistration>> {
    return this.http.get<CrmExtensionResponse<CrmDealRegistration>>(`${this.base}/deal-registrations/${id}`);
  }

  getMdfFund(id: string): Observable<CrmExtensionResponse<CrmMdfFund>> {
    return this.http.get<CrmExtensionResponse<CrmMdfFund>>(`${this.base}/mdf-funds/${id}`);
  }

  deleteMdfFund(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/mdf-funds/${id}`);
  }

  getMdfFundClaims(id: string): Observable<CrmExtensionResponse<CrmMdfClaim[]>> {
    return this.http.get<CrmExtensionResponse<CrmMdfClaim[]>>(`${this.base}/mdf-funds/${id}/claims`);
  }

  getPricingRule(id: string): Observable<CrmExtensionResponse<CrmPricingRule>> {
    return this.http.get<CrmExtensionResponse<CrmPricingRule>>(`${this.base}/pricing-rules/${id}`);
  }

  updatePricingRule(id: string, payload: Partial<CrmPricingRuleRequest>): Observable<CrmExtensionResponse<CrmPricingRule>> {
    return this.http.put<CrmExtensionResponse<CrmPricingRule>>(`${this.base}/pricing-rules/${id}`, payload);
  }

  getDiscountThreshold(id: string): Observable<CrmExtensionResponse<CrmDiscountThreshold>> {
    return this.http.get<CrmExtensionResponse<CrmDiscountThreshold>>(`${this.base}/discount-thresholds/${id}`);
  }

  updateDiscountThreshold(id: string, payload: Partial<CrmDiscountThresholdRequest>): Observable<CrmExtensionResponse<CrmDiscountThreshold>> {
    return this.http.put<CrmExtensionResponse<CrmDiscountThreshold>>(`${this.base}/discount-thresholds/${id}`, payload);
  }

  getQuoteConfiguration(id: string): Observable<CrmExtensionResponse<CrmQuoteConfiguration>> {
    return this.http.get<CrmExtensionResponse<CrmQuoteConfiguration>>(`${this.base}/quote-configurations/${id}`);
  }

  updateQuoteConfiguration(id: string, payload: Partial<CrmQuoteConfigurationRequest>): Observable<CrmExtensionResponse<CrmQuoteConfiguration>> {
    return this.http.put<CrmExtensionResponse<CrmQuoteConfiguration>>(`${this.base}/quote-configurations/${id}`, payload);
  }

  getAutomationSequence(id: string): Observable<CrmExtensionResponse<CrmAutomationSequence>> {
    return this.http.get<CrmExtensionResponse<CrmAutomationSequence>>(`${this.base}/automation-sequences/${id}`);
  }

  private params(values?: Record<string, string | number | boolean | undefined | null>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return params;
  }
}
