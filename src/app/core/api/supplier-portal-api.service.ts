import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  SupplierBankChange,
  SupplierBankChangeDecisionRequest,
  SupplierBankChangeRequest,
  SupplierCheck,
  SupplierCheckRequest,
  SupplierDocument,
  SupplierDocumentRequirement,
  SupplierInviteRequest,
  SupplierOnboarding,
  SupplierOnboardingActionRequest,
  SupplierOnboardingDetail,
  SupplierPortalSummary,
  SupplierQualificationAssessment,
  SupplierQualificationAssessmentRequest,
  SupplierQualificationCriterion,
  SupplierQualificationCriterionRequest,
  SupplierQualificationScoreInput,
  SupplierRfqComparison,
  SupplierRfqSummary,
  SupplierRiskProfile,
} from '../models';

/** Query parameters sent as they are, empty values left out. */
function toParams(values: Record<string, string | number | boolean | undefined | null>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

@Service()
export class SupplierPortalApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/supplier-portal`;

  getSummary(): Observable<ApiResponse<SupplierPortalSummary>> {
    return this.http.get<ApiResponse<SupplierPortalSummary>>(`${this.base}/summary`);
  }

  // Onboarding workflow
  getOnboardings(params?: {
    status?: string;
    country?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Observable<ApiResponse<SupplierOnboarding[]>> {
    return this.http.get<ApiResponse<SupplierOnboarding[]>>(`${this.base}/onboardings`, { params: toParams(params ?? {}) });
  }

  getOnboarding(id: string): Observable<ApiResponse<SupplierOnboardingDetail>> {
    return this.http.get<ApiResponse<SupplierOnboardingDetail>>(`${this.base}/onboardings/${id}`);
  }

  inviteSupplier(payload: SupplierInviteRequest): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings`, payload);
  }

  sendPortalAccess(id: string): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings/${id}/portal-access`, {});
  }

  requestDocuments(id: string, payload: SupplierOnboardingActionRequest): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings/${id}/request-documents`, payload);
  }

  startReview(id: string): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings/${id}/start-review`, {});
  }

  approveOnboarding(id: string, payload: SupplierOnboardingActionRequest): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings/${id}/approve`, payload);
  }

  rejectOnboarding(id: string, payload: SupplierOnboardingActionRequest): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings/${id}/reject`, payload);
  }

  blockOnboarding(id: string, payload: SupplierOnboardingActionRequest): Observable<ApiResponse<SupplierOnboarding>> {
    return this.http.post<ApiResponse<SupplierOnboarding>>(`${this.base}/onboardings/${id}/block`, payload);
  }

  // Required documents and their submissions
  getDocumentRequirements(params?: { country?: string; active?: boolean }): Observable<ApiResponse<SupplierDocumentRequirement[]>> {
    return this.http.get<ApiResponse<SupplierDocumentRequirement[]>>(`${this.base}/document-requirements`, {
      params: toParams({ country: params?.country, active: params?.active ? 1 : undefined }),
    });
  }

  seedDocumentRequirements(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.base}/document-requirements/seed-defaults`, {});
  }

  getDocuments(params?: {
    supplier_id?: string;
    requirement_id?: string;
    status?: string;
    expiring_within_days?: number;
    page?: number;
    per_page?: number;
  }): Observable<ApiResponse<SupplierDocument[]>> {
    return this.http.get<ApiResponse<SupplierDocument[]>>(`${this.base}/documents`, { params: toParams(params ?? {}) });
  }

  acceptDocument(
    id: string,
    payload: { reference?: string | null; issued_at?: string | null; expires_at?: string | null },
  ): Observable<ApiResponse<SupplierDocument>> {
    return this.http.post<ApiResponse<SupplierDocument>>(`${this.base}/documents/${id}/accept`, payload);
  }

  rejectDocument(id: string, payload: { reason: string }): Observable<ApiResponse<SupplierDocument>> {
    return this.http.post<ApiResponse<SupplierDocument>>(`${this.base}/documents/${id}/reject`, payload);
  }

  downloadDocument(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/documents/${id}/download`, { responseType: 'blob' });
  }

  // Qualification
  getCriteria(active?: boolean): Observable<ApiResponse<SupplierQualificationCriterion[]>> {
    return this.http.get<ApiResponse<SupplierQualificationCriterion[]>>(`${this.base}/qualification-criteria`, {
      params: toParams({ active: active ? 1 : undefined }),
    });
  }

  createCriterion(payload: SupplierQualificationCriterionRequest): Observable<ApiResponse<SupplierQualificationCriterion>> {
    return this.http.post<ApiResponse<SupplierQualificationCriterion>>(`${this.base}/qualification-criteria`, payload);
  }

  updateCriterion(
    id: string,
    payload: Partial<SupplierQualificationCriterionRequest>,
  ): Observable<ApiResponse<SupplierQualificationCriterion>> {
    return this.http.put<ApiResponse<SupplierQualificationCriterion>>(`${this.base}/qualification-criteria/${id}`, payload);
  }

  getAssessments(params?: { supplier_id?: string; status?: string }): Observable<ApiResponse<SupplierQualificationAssessment[]>> {
    return this.http.get<ApiResponse<SupplierQualificationAssessment[]>>(`${this.base}/qualification-assessments`, {
      params: toParams(params ?? {}),
    });
  }

  createAssessment(payload: SupplierQualificationAssessmentRequest): Observable<ApiResponse<SupplierQualificationAssessment>> {
    return this.http.post<ApiResponse<SupplierQualificationAssessment>>(`${this.base}/qualification-assessments`, payload);
  }

  recordScores(
    id: string,
    payload: { notes?: string | null; scores: SupplierQualificationScoreInput[] },
  ): Observable<ApiResponse<SupplierQualificationAssessment>> {
    return this.http.put<ApiResponse<SupplierQualificationAssessment>>(`${this.base}/qualification-assessments/${id}/scores`, payload);
  }

  completeAssessment(id: string): Observable<ApiResponse<SupplierQualificationAssessment>> {
    return this.http.post<ApiResponse<SupplierQualificationAssessment>>(`${this.base}/qualification-assessments/${id}/complete`, {});
  }

  // Checks and risk
  getRiskProfiles(params?: { level?: string; min_level?: string }): Observable<ApiResponse<SupplierRiskProfile[]>> {
    return this.http.get<ApiResponse<SupplierRiskProfile[]>>(`${this.base}/risk`, { params: toParams(params ?? {}) });
  }

  getSupplierRisk(supplierId: string): Observable<ApiResponse<{ risk: SupplierRiskProfile; checks: SupplierCheck[] }>> {
    return this.http.get<ApiResponse<{ risk: SupplierRiskProfile; checks: SupplierCheck[] }>>(`${this.base}/suppliers/${supplierId}/risk`);
  }

  recalculateRisk(): Observable<{ evaluated: number }> {
    return this.http.post<{ evaluated: number }>(`${this.base}/risk/recalculate`, {});
  }

  recordCheck(payload: SupplierCheckRequest): Observable<ApiResponse<SupplierCheck>> {
    return this.http.post<ApiResponse<SupplierCheck>>(`${this.base}/checks`, payload);
  }

  // Bank detail changes
  getBankChanges(params?: { status?: string; supplier_id?: string }): Observable<ApiResponse<SupplierBankChange[]>> {
    return this.http.get<ApiResponse<SupplierBankChange[]>>(`${this.base}/bank-changes`, { params: toParams(params ?? {}) });
  }

  createBankChange(payload: SupplierBankChangeRequest): Observable<ApiResponse<SupplierBankChange>> {
    return this.http.post<ApiResponse<SupplierBankChange>>(`${this.base}/bank-changes`, payload);
  }

  verifyBankChangeCallback(id: string, payload: SupplierBankChangeDecisionRequest): Observable<ApiResponse<SupplierBankChange>> {
    return this.http.post<ApiResponse<SupplierBankChange>>(`${this.base}/bank-changes/${id}/verify-callback`, payload);
  }

  approveBankChange(id: string, payload: SupplierBankChangeDecisionRequest): Observable<ApiResponse<SupplierBankChange>> {
    return this.http.post<ApiResponse<SupplierBankChange>>(`${this.base}/bank-changes/${id}/approve`, payload);
  }

  rejectBankChange(id: string, payload: SupplierBankChangeDecisionRequest): Observable<ApiResponse<SupplierBankChange>> {
    return this.http.post<ApiResponse<SupplierBankChange>>(`${this.base}/bank-changes/${id}/reject`, payload);
  }

  cancelBankChange(id: string): Observable<ApiResponse<SupplierBankChange>> {
    return this.http.post<ApiResponse<SupplierBankChange>>(`${this.base}/bank-changes/${id}/cancel`, {});
  }

  // Requests for quotation: answers of the invited suppliers
  getRfqResponses(status?: string): Observable<ApiResponse<SupplierRfqSummary[]>> {
    return this.http.get<ApiResponse<SupplierRfqSummary[]>>(`${this.base}/rfq-responses`, { params: toParams({ status }) });
  }

  getRfqComparison(rfqId: string): Observable<ApiResponse<SupplierRfqComparison>> {
    return this.http.get<ApiResponse<SupplierRfqComparison>>(`${this.base}/rfq-responses/${rfqId}/comparison`);
  }
}
