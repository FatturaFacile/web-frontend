import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  RebateAccrual,
  RebateAccrualRun,
  RebateAccrualRunRequest,
  RebateContribution,
  RebateContributionRequest,
  RebateProgress,
  RebateProposalAction,
  RebateProposalFilters,
  RebateProposalRequest,
  RebateProposalTransitionRequest,
  RebateSettlementProposal,
  RebateAgreement,
  RebateAgreementFilters,
  RebateAgreementRequest,
  RebateCalculateRequest,
  RebateCalculation,
  RebateDashboard,
  RebatePromotion,
  RebatePromotionFilters,
  RebatePromotionRequest,
  RebateResponse,
  RebateSettleRequest,
  RebateSettlement,
} from '../models';

@Service()
export class RebatesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/rebates`;

  getDashboard(): Observable<RebateResponse<RebateDashboard>> {
    return this.http.get<RebateResponse<RebateDashboard>>(`${this.base}/dashboard`);
  }

  // Agreements
  getAgreements(filters?: RebateAgreementFilters): Observable<RebateResponse<RebateAgreement[]>> {
    return this.http.get<RebateResponse<RebateAgreement[]>>(`${this.base}/agreements`, { params: this.params(filters) });
  }

  getAgreement(id: string): Observable<RebateResponse<RebateAgreement>> {
    return this.http.get<RebateResponse<RebateAgreement>>(`${this.base}/agreements/${id}`);
  }

  createAgreement(payload: RebateAgreementRequest): Observable<RebateResponse<RebateAgreement>> {
    return this.http.post<RebateResponse<RebateAgreement>>(`${this.base}/agreements`, payload);
  }

  updateAgreement(id: string, payload: Partial<RebateAgreementRequest>): Observable<RebateResponse<RebateAgreement>> {
    return this.http.put<RebateResponse<RebateAgreement>>(`${this.base}/agreements/${id}`, payload);
  }

  deleteAgreement(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/agreements/${id}`);
  }

  activateAgreement(id: string): Observable<RebateResponse<RebateAgreement>> {
    return this.http.post<RebateResponse<RebateAgreement>>(`${this.base}/agreements/${id}/activate`, {});
  }

  closeAgreement(id: string): Observable<RebateResponse<RebateAgreement>> {
    return this.http.post<RebateResponse<RebateAgreement>>(`${this.base}/agreements/${id}/close`, {});
  }

  calculateAccrual(id: string, payload: RebateCalculateRequest = {}): Observable<RebateResponse<RebateCalculation>> {
    return this.http.post<RebateResponse<RebateCalculation>>(`${this.base}/agreements/${id}/calculate`, payload);
  }

  getAccruals(id: string): Observable<RebateResponse<RebateAccrual[]>> {
    return this.http.get<RebateResponse<RebateAccrual[]>>(`${this.base}/agreements/${id}/accruals`);
  }

  settleAgreement(id: string, payload: RebateSettleRequest = {}): Observable<RebateResponse<RebateSettlement>> {
    return this.http.post<RebateResponse<RebateSettlement>>(`${this.base}/agreements/${id}/settle`, payload);
  }

  getSettlements(filters?: { agreement_id?: string; per_page?: number }): Observable<RebateResponse<RebateSettlement[]>> {
    return this.http.get<RebateResponse<RebateSettlement[]>>(`${this.base}/settlements`, { params: this.params(filters) });
  }

  // Supplier rebate programs
  getProgress(id: string, asOf?: string | null): Observable<RebateResponse<RebateProgress>> {
    return this.http.get<RebateResponse<RebateProgress>>(`${this.base}/agreements/${id}/progress`, { params: this.params({ as_of: asOf }) });
  }

  getContributions(agreementId: string): Observable<RebateResponse<RebateContribution[]>> {
    return this.http.get<RebateResponse<RebateContribution[]>>(`${this.base}/agreements/${agreementId}/contributions`);
  }

  createContribution(agreementId: string, payload: RebateContributionRequest): Observable<RebateResponse<RebateContribution>> {
    return this.http.post<RebateResponse<RebateContribution>>(`${this.base}/agreements/${agreementId}/contributions`, payload);
  }

  updateContribution(id: string, payload: Partial<RebateContributionRequest>): Observable<RebateResponse<RebateContribution>> {
    return this.http.put<RebateResponse<RebateContribution>>(`${this.base}/contributions/${id}`, payload);
  }

  deleteContribution(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/contributions/${id}`);
  }

  getAccrualRuns(agreementId: string): Observable<RebateResponse<RebateAccrualRun[]>> {
    return this.http.get<RebateResponse<RebateAccrualRun[]>>(`${this.base}/agreements/${agreementId}/accrual-runs`);
  }

  createAccrualRun(agreementId: string, payload: RebateAccrualRunRequest = {}): Observable<RebateResponse<RebateAccrualRun>> {
    return this.http.post<RebateResponse<RebateAccrualRun>>(`${this.base}/agreements/${agreementId}/accrual-runs`, payload);
  }

  reverseAccrualRun(id: string, reason: string): Observable<RebateResponse<RebateAccrualRun>> {
    return this.http.post<RebateResponse<RebateAccrualRun>>(`${this.base}/accrual-runs/${id}/reverse`, { reason });
  }

  getSettlementProposals(filters?: RebateProposalFilters): Observable<RebateResponse<RebateSettlementProposal[]>> {
    return this.http.get<RebateResponse<RebateSettlementProposal[]>>(`${this.base}/settlement-proposals`, { params: this.params(filters) });
  }

  getSettlementProposal(id: string): Observable<RebateResponse<RebateSettlementProposal>> {
    return this.http.get<RebateResponse<RebateSettlementProposal>>(`${this.base}/settlement-proposals/${id}`);
  }

  createSettlementProposal(agreementId: string, payload: RebateProposalRequest): Observable<RebateResponse<RebateSettlementProposal>> {
    return this.http.post<RebateResponse<RebateSettlementProposal>>(`${this.base}/agreements/${agreementId}/settlement-proposals`, payload);
  }

  /** Moves a proposal through its workflow: submit, approve, execute or cancel. */
  transitionSettlementProposal(id: string, action: RebateProposalAction, payload: RebateProposalTransitionRequest = {}): Observable<RebateResponse<RebateSettlementProposal>> {
    return this.http.post<RebateResponse<RebateSettlementProposal>>(`${this.base}/settlement-proposals/${id}/${action}`, payload);
  }

  // Promotions
  getPromotions(filters?: RebatePromotionFilters): Observable<RebateResponse<RebatePromotion[]>> {
    return this.http.get<RebateResponse<RebatePromotion[]>>(`${this.base}/promotions`, { params: this.params(filters) });
  }

  createPromotion(payload: RebatePromotionRequest): Observable<RebateResponse<RebatePromotion>> {
    return this.http.post<RebateResponse<RebatePromotion>>(`${this.base}/promotions`, payload);
  }

  updatePromotion(id: string, payload: Partial<RebatePromotionRequest>): Observable<RebateResponse<RebatePromotion>> {
    return this.http.put<RebateResponse<RebatePromotion>>(`${this.base}/promotions/${id}`, payload);
  }

  deletePromotion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/promotions/${id}`);
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
