import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  DcBatch,
  DcCalculatePayload,
  DcCalculation,
  DcChannel,
  DcCustomerHistory,
  DcDashboard,
  DcDossier,
  DcDossierPayload,
  DcEnforcementOffice,
  DcEnforcementOfficePayload,
  DcEnvelope,
  DcExclusion,
  DcExclusionPayload,
  DcGeneratePayload,
  DcGenerateResult,
  DcInterestRate,
  DcInterestRatePayload,
  DcLookups,
  DcMessaInMoraPayload,
  DcNotice,
  DcNoticeFilters,
  DcPage,
  DcPaymentPlan,
  DcPaymentPlanPayload,
  DcPolicy,
  DcPolicyPayload,
  DcProposalFilters,
  DcProposals,
  DcReceipt,
  DcReceiptPayload,
  DcTemplate,
  DcTemplatePayload,
} from '../models';

type Envelope<T> = Observable<DcEnvelope<T>>;

/** Endpoints of the dunning and debt collection module (Mod 014). */
@Service()
export class DebtCollectionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/debt-collection`;

  getLookups(): Envelope<DcLookups> {
    return this.http.get<DcEnvelope<DcLookups>>(`${this.base}/lookups`);
  }

  getDashboard(): Envelope<DcDashboard> {
    return this.http.get<DcEnvelope<DcDashboard>>(`${this.base}/dashboard`);
  }

  // --- Proposals ---

  listProposals(filters: DcProposalFilters = {}): Envelope<DcProposals> {
    return this.http.get<DcEnvelope<DcProposals>>(`${this.base}/proposals`, {
      params: toHttpParams(filters),
    });
  }

  calculate(payload: DcCalculatePayload): Envelope<DcCalculation> {
    return this.http.post<DcEnvelope<DcCalculation>>(`${this.base}/calculate`, payload);
  }

  generate(payload: DcGeneratePayload): Envelope<DcGenerateResult> {
    return this.http.post<DcEnvelope<DcGenerateResult>>(`${this.base}/proposals/generate`, payload);
  }

  // --- Notices ---

  listNotices(filters: DcNoticeFilters = {}): Observable<DcPage<DcNotice>> {
    return this.http.get<DcPage<DcNotice>>(`${this.base}/notices`, {
      params: toHttpParams(filters),
    });
  }

  getNotice(id: string): Envelope<DcNotice> {
    return this.http.get<DcEnvelope<DcNotice>>(`${this.base}/notices/${id}`);
  }

  downloadNoticePdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/notices/${id}/pdf`, { responseType: 'blob' });
  }

  /** The PEC export package (zip) of a notice. */
  exportNotice(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/notices/${id}/export`, { responseType: 'blob' });
  }

  sendNotice(id: string, channel?: DcChannel): Envelope<DcNotice> {
    return this.http.post<DcEnvelope<DcNotice>>(
      `${this.base}/notices/${id}/send`,
      channel ? { channel } : {},
    );
  }

  cancelNotice(id: string): Envelope<DcNotice> {
    return this.http.post<DcEnvelope<DcNotice>>(`${this.base}/notices/${id}/cancel`, {});
  }

  registerReceipt(id: string, payload: DcReceiptPayload): Envelope<DcReceipt> {
    return this.http.post<DcEnvelope<DcReceipt>>(
      `${this.base}/notices/${id}/pec-receipts`,
      payload,
    );
  }

  // --- Batches ---

  listBatches(): Observable<DcPage<DcBatch>> {
    return this.http.get<DcPage<DcBatch>>(`${this.base}/batches`);
  }

  getBatch(id: string): Envelope<DcBatch> {
    return this.http.get<DcEnvelope<DcBatch>>(`${this.base}/batches/${id}`);
  }

  createBatch(noticeIds: string[], channel: DcChannel): Envelope<DcBatch> {
    return this.http.post<DcEnvelope<DcBatch>>(`${this.base}/batches`, {
      notice_ids: noticeIds,
      channel,
    });
  }

  retryBatch(id: string): Envelope<DcBatch> {
    return this.http.post<DcEnvelope<DcBatch>>(`${this.base}/batches/${id}/retry`, {});
  }

  // --- Policies ---

  listPolicies(): Envelope<DcPolicy[]> {
    return this.http.get<DcEnvelope<DcPolicy[]>>(`${this.base}/policies`);
  }

  createPolicy(payload: DcPolicyPayload): Envelope<DcPolicy> {
    return this.http.post<DcEnvelope<DcPolicy>>(`${this.base}/policies`, payload);
  }

  updatePolicy(id: string, payload: DcPolicyPayload): Envelope<DcPolicy> {
    return this.http.put<DcEnvelope<DcPolicy>>(`${this.base}/policies/${id}`, payload);
  }

  deletePolicy(id: string): Envelope<null> {
    return this.http.delete<DcEnvelope<null>>(`${this.base}/policies/${id}`);
  }

  // --- Interest rates ---

  listInterestRates(jurisdiction?: string): Envelope<DcInterestRate[]> {
    return this.http.get<DcEnvelope<DcInterestRate[]>>(`${this.base}/interest-rates`, {
      params: toHttpParams({ jurisdiction }),
    });
  }

  createInterestRate(payload: DcInterestRatePayload): Envelope<DcInterestRate> {
    return this.http.post<DcEnvelope<DcInterestRate>>(`${this.base}/interest-rates`, payload);
  }

  updateInterestRate(id: string, payload: DcInterestRatePayload): Envelope<DcInterestRate> {
    return this.http.put<DcEnvelope<DcInterestRate>>(`${this.base}/interest-rates/${id}`, payload);
  }

  deleteInterestRate(id: string): Envelope<null> {
    return this.http.delete<DcEnvelope<null>>(`${this.base}/interest-rates/${id}`);
  }

  // --- Templates ---

  listTemplates(filters: { code?: string; locale?: string } = {}): Envelope<DcTemplate[]> {
    return this.http.get<DcEnvelope<DcTemplate[]>>(`${this.base}/templates`, {
      params: toHttpParams(filters),
    });
  }

  /** Editing a global template creates a tenant override and answers it. */
  updateTemplate(id: string, payload: DcTemplatePayload): Envelope<DcTemplate> {
    return this.http.put<DcEnvelope<DcTemplate>>(`${this.base}/templates/${id}`, payload);
  }

  // --- Exclusions ---

  listExclusions(filters: { customer_id?: string; active?: 0 | 1 } = {}): Envelope<DcExclusion[]> {
    return this.http.get<DcEnvelope<DcExclusion[]>>(`${this.base}/exclusions`, {
      params: toHttpParams(filters),
    });
  }

  createExclusion(payload: DcExclusionPayload): Envelope<DcExclusion> {
    return this.http.post<DcEnvelope<DcExclusion>>(`${this.base}/exclusions`, payload);
  }

  releaseExclusion(id: string, note: string): Envelope<DcExclusion> {
    return this.http.post<DcEnvelope<DcExclusion>>(`${this.base}/exclusions/${id}/release`, {
      note,
    });
  }

  // --- Payment plans ---

  listPaymentPlans(customerId?: string): Envelope<DcPaymentPlan[]> {
    return this.http.get<DcEnvelope<DcPaymentPlan[]>>(`${this.base}/payment-plans`, {
      params: toHttpParams({ customer_id: customerId }),
    });
  }

  createPaymentPlan(payload: DcPaymentPlanPayload): Envelope<DcPaymentPlan> {
    return this.http.post<DcEnvelope<DcPaymentPlan>>(`${this.base}/payment-plans`, payload);
  }

  transitionPaymentPlan(
    id: string,
    action: 'complete' | 'default' | 'cancel',
  ): Envelope<DcPaymentPlan> {
    return this.http.post<DcEnvelope<DcPaymentPlan>>(
      `${this.base}/payment-plans/${id}/${action}`,
      {},
    );
  }

  // --- Enforcement offices ---

  listEnforcementOffices(): Envelope<DcEnforcementOffice[]> {
    return this.http.get<DcEnvelope<DcEnforcementOffice[]>>(`${this.base}/enforcement-offices`);
  }

  createEnforcementOffice(payload: DcEnforcementOfficePayload): Envelope<DcEnforcementOffice> {
    return this.http.post<DcEnvelope<DcEnforcementOffice>>(
      `${this.base}/enforcement-offices`,
      payload,
    );
  }

  updateEnforcementOffice(
    id: string,
    payload: DcEnforcementOfficePayload,
  ): Envelope<DcEnforcementOffice> {
    return this.http.put<DcEnvelope<DcEnforcementOffice>>(
      `${this.base}/enforcement-offices/${id}`,
      payload,
    );
  }

  deleteEnforcementOffice(id: string): Envelope<null> {
    return this.http.delete<DcEnvelope<null>>(`${this.base}/enforcement-offices/${id}`);
  }

  // --- Legal: dossiers and messa in mora ---

  listDossiers(customerId?: string): Envelope<DcDossier[]> {
    return this.http.get<DcEnvelope<DcDossier[]>>(`${this.base}/dossiers`, {
      params: toHttpParams({ customer_id: customerId }),
    });
  }

  createDossier(payload: DcDossierPayload): Envelope<DcDossier> {
    return this.http.post<DcEnvelope<DcDossier>>(`${this.base}/dossiers`, payload);
  }

  getDossier(id: string): Envelope<DcDossier> {
    return this.http.get<DcEnvelope<DcDossier>>(`${this.base}/dossiers/${id}`);
  }

  /** The Betreibungsbegehren (debt enforcement request). */
  downloadDossierPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/dossiers/${id}/pdf`, { responseType: 'blob' });
  }

  downloadDossierBundle(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/dossiers/${id}/bundle`, { responseType: 'blob' });
  }

  submitDossier(id: string): Envelope<DcDossier> {
    return this.http.post<DcEnvelope<DcDossier>>(`${this.base}/dossiers/${id}/submit`, {});
  }

  createMessaInMora(payload: DcMessaInMoraPayload): Envelope<DcNotice> {
    return this.http.post<DcEnvelope<DcNotice>>(`${this.base}/messa-in-mora`, payload);
  }

  // --- Customer master record ---

  getCustomerHistory(customerId: string): Envelope<DcCustomerHistory> {
    return this.http.get<DcEnvelope<DcCustomerHistory>>(
      `${this.base}/customers/${customerId}/history`,
    );
  }
}
