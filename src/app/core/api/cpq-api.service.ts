import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CpqApprovalOverview,
  CpqApprovalRequest,
  CpqApprovalTier,
  CpqApprovalTierRequest,
  CpqEnvelope,
  CpqLocale,
  CpqMarginResult,
  CpqPublicSigningView,
  CpqRevisionDiff,
  CpqRevisionSummary,
  CpqSignatureLink,
  CpqSignatureRequest,
  CpqSignatureVerification,
  CpqSignRequest,
  CpqSimulationRequest,
  CpqSimulationResult,
} from '../models';

/** Technical and commercial quoting: margin simulation, revisions, tiered approval, signature and PDF preview. */
@Service()
export class CpqApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/sales`;
  private readonly publicBase = `${environment.apiBaseUrl}/public/quote-signatures`;

  getMargin(quoteId: string): Observable<CpqEnvelope<CpqMarginResult>> {
    return this.http.get<CpqEnvelope<CpqMarginResult>>(`${this.base}/quotes/${quoteId}/margin`);
  }

  simulate(quoteId: string, payload: CpqSimulationRequest): Observable<CpqEnvelope<CpqSimulationResult>> {
    return this.http.post<CpqEnvelope<CpqSimulationResult>>(`${this.base}/quotes/${quoteId}/simulate`, payload);
  }

  getRevisions(quoteId: string): Observable<CpqEnvelope<CpqRevisionSummary[]>> {
    return this.http.get<CpqEnvelope<CpqRevisionSummary[]>>(`${this.base}/quotes/${quoteId}/revisions`);
  }

  diff(fromId: string, toId: string): Observable<CpqEnvelope<CpqRevisionDiff>> {
    return this.http.get<CpqEnvelope<CpqRevisionDiff>>(`${this.base}/quotes/${fromId}/diff/${toId}`);
  }

  getApprovals(quoteId: string): Observable<CpqEnvelope<CpqApprovalOverview>> {
    return this.http.get<CpqEnvelope<CpqApprovalOverview>>(`${this.base}/quotes/${quoteId}/approvals`);
  }

  submitForApproval(quoteId: string): Observable<CpqEnvelope<CpqApprovalRequest[]>> {
    return this.http.post<CpqEnvelope<CpqApprovalRequest[]>>(`${this.base}/quotes/${quoteId}/approvals/submit`, {});
  }

  approve(quoteId: string): Observable<CpqEnvelope<CpqApprovalRequest>> {
    return this.http.post<CpqEnvelope<CpqApprovalRequest>>(`${this.base}/quotes/${quoteId}/approvals/approve`, {});
  }

  reject(quoteId: string, rejectionReason: string): Observable<CpqEnvelope<CpqApprovalRequest>> {
    return this.http.post<CpqEnvelope<CpqApprovalRequest>>(`${this.base}/quotes/${quoteId}/approvals/reject`, {
      rejection_reason: rejectionReason,
    });
  }

  getTiers(): Observable<CpqEnvelope<CpqApprovalTier[]>> {
    return this.http.get<CpqEnvelope<CpqApprovalTier[]>>(`${this.base}/quote-approval-tiers`);
  }

  saveTier(payload: CpqApprovalTierRequest, id?: string): Observable<CpqEnvelope<CpqApprovalTier>> {
    return id
      ? this.http.put<CpqEnvelope<CpqApprovalTier>>(`${this.base}/quote-approval-tiers/${id}`, payload)
      : this.http.post<CpqEnvelope<CpqApprovalTier>>(`${this.base}/quote-approval-tiers`, payload);
  }

  deleteTier(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/quote-approval-tiers/${id}`);
  }

  createSignatureLink(quoteId: string, locale: CpqLocale, validityHours?: number): Observable<CpqEnvelope<CpqSignatureLink>> {
    return this.http.post<CpqEnvelope<CpqSignatureLink>>(`${this.base}/quotes/${quoteId}/signature-links`, {
      locale,
      validity_hours: validityHours ?? null,
    });
  }

  getSignatureRequests(quoteId: string): Observable<CpqEnvelope<CpqSignatureRequest[]>> {
    return this.http.get<CpqEnvelope<CpqSignatureRequest[]>>(`${this.base}/quotes/${quoteId}/signature-requests`);
  }

  revokeSignatureLink(quoteId: string, requestId: string): Observable<CpqEnvelope<CpqSignatureRequest>> {
    return this.http.post<CpqEnvelope<CpqSignatureRequest>>(
      `${this.base}/quotes/${quoteId}/signature-requests/${requestId}/revoke`,
      {},
    );
  }

  verifySignature(quoteId: string, requestId: string): Observable<CpqEnvelope<CpqSignatureVerification>> {
    return this.http.get<CpqEnvelope<CpqSignatureVerification>>(
      `${this.base}/quotes/${quoteId}/signature-requests/${requestId}/verify`,
    );
  }

  /** The quote PDF in the chosen language, as a blob for the live preview. */
  previewPdf(quoteId: string, locale: CpqLocale, showTechnicalDetails: boolean): Observable<Blob> {
    const params = new HttpParams().set('locale', locale).set('show_technical_details', showTechnicalDetails ? '1' : '0');

    return this.http.get(`${this.base}/quotes/${quoteId}/preview-pdf`, { params, responseType: 'blob' });
  }

  getPublicSigning(token: string): Observable<CpqEnvelope<CpqPublicSigningView>> {
    return this.http.get<CpqEnvelope<CpqPublicSigningView>>(`${this.publicBase}/${token}`);
  }

  getPublicPdf(token: string, locale?: CpqLocale): Observable<Blob> {
    const params = locale ? new HttpParams().set('locale', locale) : new HttpParams();

    return this.http.get(`${this.publicBase}/${token}/pdf`, { params, responseType: 'blob' });
  }

  signPublic(token: string, payload: CpqSignRequest): Observable<CpqEnvelope<CpqSignatureRequest>> {
    return this.http.post<CpqEnvelope<CpqSignatureRequest>>(`${this.publicBase}/${token}/sign`, payload);
  }

  requestPublicChanges(token: string, message: string): Observable<CpqEnvelope<CpqSignatureRequest>> {
    return this.http.post<CpqEnvelope<CpqSignatureRequest>>(`${this.publicBase}/${token}/request-changes`, { message });
  }
}
