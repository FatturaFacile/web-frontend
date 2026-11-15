import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CollectionAction,
  CollectionActionRequest,
  CollectionCase,
  CollectionCaseCloseRequest,
  CollectionCaseRequest,
  CollectionCaseUpdateRequest,
  CollectionPromise,
  CollectionPromiseRequest,
  CollectionPromiseResolveRequest,
  CreditAging,
  CreditCaseFilters,
  CreditDashboard,
  CreditDispute,
  CreditDisputeFilters,
  CreditDisputeRequest,
  CreditDisputeResolveRequest,
  CreditExposure,
  CreditInsuranceCover,
  CreditInsuranceCoverRequest,
  CreditInsurancePolicy,
  CreditInsurancePolicyRequest,
  CreditLimitApprovalRequest,
  CreditLimitProposal,
  CreditLimitRejectionRequest,
  CreditLimitRequest,
  CreditLimitRequestPayload,
  CreditMarkedPromises,
  CreditPromiseFilters,
  CreditRatingBand,
  CreditRatingBandRequest,
  CreditResponse,
  CreditScore,
  CreditScorecardFactor,
  CreditScorecardFactorRequest,
  CreditScoreRequest,
  CreditWorklistFilters,
  CreditWorklistRow,
  DunningStrategy,
  DunningStrategyRequest,
} from '../models';

@Service()
export class CreditManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/credit-management`;

  getDashboard(): Observable<CreditResponse<CreditDashboard>> {
    return this.http.get<CreditResponse<CreditDashboard>>(`${this.base}/dashboard`);
  }

  getWorklist(filters?: CreditWorklistFilters): Observable<CreditResponse<CreditWorklistRow[]>> {
    return this.http.get<CreditResponse<CreditWorklistRow[]>>(`${this.base}/worklist`, { params: this.params(filters) });
  }

  getAging(customerId?: string): Observable<CreditResponse<CreditAging>> {
    return this.http.get<CreditResponse<CreditAging>>(`${this.base}/aging`, { params: this.params({ customer_id: customerId }) });
  }

  // Scorecard
  getFactors(): Observable<CreditResponse<CreditScorecardFactor[]>> {
    return this.http.get<CreditResponse<CreditScorecardFactor[]>>(`${this.base}/scorecard/factors`);
  }

  createFactor(payload: CreditScorecardFactorRequest): Observable<CreditResponse<CreditScorecardFactor>> {
    return this.http.post<CreditResponse<CreditScorecardFactor>>(`${this.base}/scorecard/factors`, payload);
  }

  updateFactor(id: string, payload: CreditScorecardFactorRequest): Observable<CreditResponse<CreditScorecardFactor>> {
    return this.http.put<CreditResponse<CreditScorecardFactor>>(`${this.base}/scorecard/factors/${id}`, payload);
  }

  deleteFactor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/scorecard/factors/${id}`);
  }

  getRatingBands(): Observable<CreditResponse<CreditRatingBand[]>> {
    return this.http.get<CreditResponse<CreditRatingBand[]>>(`${this.base}/scorecard/bands`);
  }

  createRatingBand(payload: CreditRatingBandRequest): Observable<CreditResponse<CreditRatingBand>> {
    return this.http.post<CreditResponse<CreditRatingBand>>(`${this.base}/scorecard/bands`, payload);
  }

  updateRatingBand(id: string, payload: CreditRatingBandRequest): Observable<CreditResponse<CreditRatingBand>> {
    return this.http.put<CreditResponse<CreditRatingBand>>(`${this.base}/scorecard/bands/${id}`, payload);
  }

  deleteRatingBand(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/scorecard/bands/${id}`);
  }

  seedScorecardDefaults(): Observable<CreditResponse<unknown>> {
    return this.http.post<CreditResponse<unknown>>(`${this.base}/scorecard/defaults`, {});
  }

  // Scores
  getScores(customerId?: string): Observable<CreditResponse<CreditScore[]>> {
    return this.http.get<CreditResponse<CreditScore[]>>(`${this.base}/scores`, { params: this.params({ customer_id: customerId, per_page: 100 }) });
  }

  createScore(payload: CreditScoreRequest): Observable<CreditResponse<CreditScore>> {
    return this.http.post<CreditResponse<CreditScore>>(`${this.base}/scores`, payload);
  }

  getLimitProposal(customerId: string): Observable<CreditResponse<CreditLimitProposal>> {
    return this.http.get<CreditResponse<CreditLimitProposal>>(`${this.base}/customers/${customerId}/limit-proposal`);
  }

  // Exposure
  getExposure(customerId: string): Observable<CreditResponse<CreditExposure>> {
    return this.http.get<CreditResponse<CreditExposure>>(`${this.base}/customers/${customerId}/exposure`);
  }

  getExposures(overLimitOnly?: boolean): Observable<CreditResponse<CreditExposure[]>> {
    return this.http.get<CreditResponse<CreditExposure[]>>(`${this.base}/exposures`, { params: this.params({ over_limit_only: overLimitOnly ? 1 : undefined }) });
  }

  // Limit requests
  getLimitRequests(status?: string): Observable<CreditResponse<CreditLimitRequest[]>> {
    return this.http.get<CreditResponse<CreditLimitRequest[]>>(`${this.base}/limit-requests`, { params: this.params({ status, per_page: 100 }) });
  }

  createLimitRequest(payload: CreditLimitRequestPayload): Observable<CreditResponse<CreditLimitRequest>> {
    return this.http.post<CreditResponse<CreditLimitRequest>>(`${this.base}/limit-requests`, payload);
  }

  approveLimitRequest(id: string, payload: CreditLimitApprovalRequest): Observable<CreditResponse<CreditLimitRequest>> {
    return this.http.post<CreditResponse<CreditLimitRequest>>(`${this.base}/limit-requests/${id}/approve`, payload);
  }

  rejectLimitRequest(id: string, payload: CreditLimitRejectionRequest): Observable<CreditResponse<CreditLimitRequest>> {
    return this.http.post<CreditResponse<CreditLimitRequest>>(`${this.base}/limit-requests/${id}/reject`, payload);
  }

  cancelLimitRequest(id: string): Observable<CreditResponse<CreditLimitRequest>> {
    return this.http.post<CreditResponse<CreditLimitRequest>>(`${this.base}/limit-requests/${id}/cancel`, {});
  }

  // Insurance
  getInsurancePolicies(): Observable<CreditResponse<CreditInsurancePolicy[]>> {
    return this.http.get<CreditResponse<CreditInsurancePolicy[]>>(`${this.base}/insurance-policies`, { params: this.params({ per_page: 100 }) });
  }

  createInsurancePolicy(payload: CreditInsurancePolicyRequest): Observable<CreditResponse<CreditInsurancePolicy>> {
    return this.http.post<CreditResponse<CreditInsurancePolicy>>(`${this.base}/insurance-policies`, payload);
  }

  updateInsurancePolicy(id: string, payload: CreditInsurancePolicyRequest): Observable<CreditResponse<CreditInsurancePolicy>> {
    return this.http.put<CreditResponse<CreditInsurancePolicy>>(`${this.base}/insurance-policies/${id}`, payload);
  }

  deleteInsurancePolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/insurance-policies/${id}`);
  }

  getInsuranceCovers(policyId?: string): Observable<CreditResponse<CreditInsuranceCover[]>> {
    return this.http.get<CreditResponse<CreditInsuranceCover[]>>(`${this.base}/insurance-covers`, { params: this.params({ policy_id: policyId, per_page: 100 }) });
  }

  createInsuranceCover(policyId: string, payload: CreditInsuranceCoverRequest): Observable<CreditResponse<CreditInsuranceCover>> {
    return this.http.post<CreditResponse<CreditInsuranceCover>>(`${this.base}/insurance-policies/${policyId}/covers`, payload);
  }

  updateInsuranceCover(id: string, payload: CreditInsuranceCoverRequest): Observable<CreditResponse<CreditInsuranceCover>> {
    return this.http.put<CreditResponse<CreditInsuranceCover>>(`${this.base}/insurance-covers/${id}`, payload);
  }

  deleteInsuranceCover(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/insurance-covers/${id}`);
  }

  // Dunning strategies
  getStrategies(): Observable<CreditResponse<DunningStrategy[]>> {
    return this.http.get<CreditResponse<DunningStrategy[]>>(`${this.base}/dunning-strategies`, { params: this.params({ per_page: 100 }) });
  }

  getStrategy(id: string): Observable<CreditResponse<DunningStrategy>> {
    return this.http.get<CreditResponse<DunningStrategy>>(`${this.base}/dunning-strategies/${id}`);
  }

  createStrategy(payload: DunningStrategyRequest): Observable<CreditResponse<DunningStrategy>> {
    return this.http.post<CreditResponse<DunningStrategy>>(`${this.base}/dunning-strategies`, payload);
  }

  updateStrategy(id: string, payload: DunningStrategyRequest): Observable<CreditResponse<DunningStrategy>> {
    return this.http.put<CreditResponse<DunningStrategy>>(`${this.base}/dunning-strategies/${id}`, payload);
  }

  deleteStrategy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dunning-strategies/${id}`);
  }

  // Collection cases
  getCases(filters?: CreditCaseFilters): Observable<CreditResponse<CollectionCase[]>> {
    return this.http.get<CreditResponse<CollectionCase[]>>(`${this.base}/cases`, { params: this.params(filters) });
  }

  getCase(id: string): Observable<CreditResponse<CollectionCase>> {
    return this.http.get<CreditResponse<CollectionCase>>(`${this.base}/cases/${id}`);
  }

  createCase(payload: CollectionCaseRequest): Observable<CreditResponse<CollectionCase>> {
    return this.http.post<CreditResponse<CollectionCase>>(`${this.base}/cases`, payload);
  }

  updateCase(id: string, payload: CollectionCaseUpdateRequest): Observable<CreditResponse<CollectionCase>> {
    return this.http.put<CreditResponse<CollectionCase>>(`${this.base}/cases/${id}`, payload);
  }

  /** Sets the collector of an open case; `null` clears it. */
  assignCase(id: string, collectorId: string | null): Observable<CreditResponse<CollectionCase>> {
    return this.http.post<CreditResponse<CollectionCase>>(`${this.base}/cases/${id}/assign`, { collector_id: collectorId });
  }

  advanceCase(id: string, outcome: string | null): Observable<CreditResponse<CollectionCase>> {
    return this.http.post<CreditResponse<CollectionCase>>(`${this.base}/cases/${id}/advance`, { outcome });
  }

  refreshCase(id: string): Observable<CreditResponse<CollectionCase>> {
    return this.http.post<CreditResponse<CollectionCase>>(`${this.base}/cases/${id}/refresh`, {});
  }

  closeCase(id: string, payload: CollectionCaseCloseRequest): Observable<CreditResponse<CollectionCase>> {
    return this.http.post<CreditResponse<CollectionCase>>(`${this.base}/cases/${id}/close`, payload);
  }

  recordAction(id: string, payload: CollectionActionRequest): Observable<CreditResponse<CollectionAction>> {
    return this.http.post<CreditResponse<CollectionAction>>(`${this.base}/cases/${id}/actions`, payload);
  }

  // Promises to pay
  getPromises(filters?: CreditPromiseFilters): Observable<CreditResponse<CollectionPromise[]>> {
    return this.http.get<CreditResponse<CollectionPromise[]>>(`${this.base}/promises`, { params: this.params(filters) });
  }

  markPromisesBroken(): Observable<CreditResponse<CreditMarkedPromises>> {
    return this.http.post<CreditResponse<CreditMarkedPromises>>(`${this.base}/promises/mark-broken`, {});
  }

  createPromise(payload: CollectionPromiseRequest): Observable<CreditResponse<CollectionPromise>> {
    return this.http.post<CreditResponse<CollectionPromise>>(`${this.base}/promises`, payload);
  }

  resolvePromise(id: string, payload: CollectionPromiseResolveRequest): Observable<CreditResponse<CollectionPromise>> {
    return this.http.post<CreditResponse<CollectionPromise>>(`${this.base}/promises/${id}/resolve`, payload);
  }

  // Disputes
  getDisputes(filters?: CreditDisputeFilters): Observable<CreditResponse<CreditDispute[]>> {
    return this.http.get<CreditResponse<CreditDispute[]>>(`${this.base}/disputes`, { params: this.params(filters) });
  }

  createDispute(payload: CreditDisputeRequest): Observable<CreditResponse<CreditDispute>> {
    return this.http.post<CreditResponse<CreditDispute>>(`${this.base}/disputes`, payload);
  }

  reviewDispute(id: string): Observable<CreditResponse<CreditDispute>> {
    return this.http.post<CreditResponse<CreditDispute>>(`${this.base}/disputes/${id}/review`, {});
  }

  resolveDispute(id: string, payload: CreditDisputeResolveRequest): Observable<CreditResponse<CreditDispute>> {
    return this.http.post<CreditResponse<CreditDispute>>(`${this.base}/disputes/${id}/resolve`, payload);
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
