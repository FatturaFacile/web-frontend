import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ContractAddCommentRequest,
  ContractAlertResource,
  ContractDocumentVersionResource,
  ContractPublicSigningView,
  ContractVersionComment,
  ContractVersionComparison,
  ContractKind,
  ContractObligationParams,
  ContractObligationResource,
  ContractPartyResource,
  ContractRegisterParams,
  ContractResource,
  ContractSaveObligationRequest,
  ContractSavePartyRequest,
  ContractStatusChangeResource,
  ContractTransitionRequest,
  PaginatedResponse,
  QueryFilterParams,
  RenewContractRequest,
  StoreContractRequest,
  UpdateContractTermsRequest,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class ContractRegisterApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- LINKED DOCUMENTS (DMS) ---
  getContractDocuments(kind: ContractKind, id: string): Observable<{ data: Record<string, unknown>[] }> {
    return this.http.get<{ data: Record<string, unknown>[] }>(`${this.base}/contract-register/${kind}/${id}/documents`);
  }

  attachContractDocument(
    kind: ContractKind,
    id: string,
    documentId: string,
  ): Observable<{ data: Record<string, unknown> }> {
    return this.http.post<{ data: Record<string, unknown> }>(`${this.base}/contract-register/${kind}/${id}/documents`, {
      document_id: documentId,
    });
  }

  detachContractDocument(kind: ContractKind, id: string, documentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/contract-register/${kind}/${id}/documents/${documentId}`);
  }

  // --- CONTRACTS ---
  getContracts(params?: ContractRegisterParams): Observable<PaginatedResponse<ContractResource>> {
    return this.http.get<PaginatedResponse<ContractResource>>(`${this.base}/contract-register`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getContract(kind: ContractKind, id: string): Observable<ApiResponse<ContractResource>> {
    return this.http.get<ApiResponse<ContractResource>>(`${this.base}/contract-register/${kind}/${id}`);
  }

  createContract(payload: StoreContractRequest): Observable<ApiResponse<ContractResource>> {
    return this.http.post<ApiResponse<ContractResource>>(`${this.base}/contract-register`, payload);
  }

  updateTerms(
    kind: ContractKind,
    id: string,
    payload: UpdateContractTermsRequest,
  ): Observable<ApiResponse<ContractResource>> {
    return this.http.put<ApiResponse<ContractResource>>(
      `${this.base}/contract-register/${kind}/${id}/terms`,
      payload,
    );
  }

  renewContract(
    kind: ContractKind,
    id: string,
    payload: RenewContractRequest,
  ): Observable<ApiResponse<ContractResource>> {
    return this.http.post<ApiResponse<ContractResource>>(
      `${this.base}/contract-register/${kind}/${id}/renew`,
      payload,
    );
  }

  sendNotice(
    kind: ContractKind,
    id: string,
    payload: { notice_given_at?: string },
  ): Observable<ApiResponse<ContractResource>> {
    return this.http.post<ApiResponse<ContractResource>>(
      `${this.base}/contract-register/${kind}/${id}/notice`,
      payload,
    );
  }

  transitionStatus(
    kind: ContractKind,
    id: string,
    payload: ContractTransitionRequest,
  ): Observable<ApiResponse<ContractResource>> {
    return this.http.post<ApiResponse<ContractResource>>(
      `${this.base}/contract-register/${kind}/${id}/transition`,
      payload,
    );
  }

  getContractHistory(
    kind: ContractKind,
    id: string,
  ): Observable<ApiResponse<ContractStatusChangeResource[]>> {
    return this.http.get<ApiResponse<ContractStatusChangeResource[]>>(
      `${this.base}/contract-register/${kind}/${id}/history`,
    );
  }

  // --- PARTIES ---
  getParties(kind: ContractKind, id: string): Observable<ApiResponse<ContractPartyResource[]>> {
    return this.http.get<ApiResponse<ContractPartyResource[]>>(
      `${this.base}/contract-register/${kind}/${id}/parties`,
    );
  }

  addParty(
    kind: ContractKind,
    id: string,
    payload: ContractSavePartyRequest,
  ): Observable<ApiResponse<ContractPartyResource>> {
    return this.http.post<ApiResponse<ContractPartyResource>>(
      `${this.base}/contract-register/${kind}/${id}/parties`,
      payload,
    );
  }

  deleteParty(kind: ContractKind, id: string, partyId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/contract-register/${kind}/${id}/parties/${partyId}`,
    );
  }

  // --- OBLIGATIONS & MILESTONES ---
  getAllObligations(params?: ContractObligationParams): Observable<PaginatedResponse<ContractObligationResource>> {
    return this.http.get<PaginatedResponse<ContractObligationResource>>(
      `${this.base}/contract-register/obligations`,
      {
        params: params ? toHttpParams(params) : undefined,
      },
    );
  }

  getContractObligations(
    kind: ContractKind,
    id: string,
  ): Observable<ApiResponse<ContractObligationResource[]>> {
    return this.http.get<ApiResponse<ContractObligationResource[]>>(
      `${this.base}/contract-register/${kind}/${id}/obligations`,
    );
  }

  addObligation(
    kind: ContractKind,
    id: string,
    payload: ContractSaveObligationRequest,
  ): Observable<ApiResponse<ContractObligationResource>> {
    return this.http.post<ApiResponse<ContractObligationResource>>(
      `${this.base}/contract-register/${kind}/${id}/obligations`,
      payload,
    );
  }

  updateObligation(
    obligationId: string,
    payload: Partial<ContractSaveObligationRequest>,
  ): Observable<ApiResponse<ContractObligationResource>> {
    return this.http.put<ApiResponse<ContractObligationResource>>(
      `${this.base}/contract-register/obligations/${obligationId}`,
      payload,
    );
  }

  deleteObligation(obligationId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/contract-register/obligations/${obligationId}`);
  }

  completeObligation(
    obligationId: string,
    payload?: { note?: string },
  ): Observable<ApiResponse<ContractObligationResource>> {
    return this.http.post<ApiResponse<ContractObligationResource>>(
      `${this.base}/contract-register/obligations/${obligationId}/complete`,
      payload || {},
    );
  }

  waiveObligation(
    obligationId: string,
    payload?: { note?: string },
  ): Observable<ApiResponse<ContractObligationResource>> {
    return this.http.post<ApiResponse<ContractObligationResource>>(
      `${this.base}/contract-register/obligations/${obligationId}/waive`,
      payload || {},
    );
  }

  // --- ALERTS ---
  getAlerts(params?: QueryFilterParams): Observable<PaginatedResponse<ContractAlertResource>> {
    return this.http.get<PaginatedResponse<ContractAlertResource>>(`${this.base}/contract-register/alerts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  acknowledgeAlert(id: string): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(
      `${this.base}/contract-register/alerts/${id}/acknowledge`,
      {},
    );
  }

  // --- PUBLIC SIGNING (no authentication: the token of the link is the credential) ---
  getPublicSigning(token: string): Observable<{ data: ContractPublicSigningView }> {
    return this.http.get<{ data: ContractPublicSigningView }>(
      `${this.base}/public/contract-signing/${encodeURIComponent(token)}`,
    );
  }

  signPublicSigning(token: string): Observable<{ data: ContractPublicSigningView }> {
    return this.http.post<{ data: ContractPublicSigningView }>(
      `${this.base}/public/contract-signing/${encodeURIComponent(token)}/sign`,
      {},
    );
  }

  declinePublicSigning(token: string, reason: string): Observable<{ data: ContractPublicSigningView }> {
    return this.http.post<{ data: ContractPublicSigningView }>(
      `${this.base}/public/contract-signing/${encodeURIComponent(token)}/decline`,
      { reason },
    );
  }

  // --- REDLINING ---
  getDocumentVersions(kind: ContractKind, id: string): Observable<{ data: ContractDocumentVersionResource[] }> {
    return this.http.get<{ data: ContractDocumentVersionResource[] }>(
      `${this.base}/contract-authoring/contracts/${kind}/${id}/versions`,
    );
  }

  compareDocumentVersions(
    kind: ContractKind,
    id: string,
    from: number,
    to: number,
  ): Observable<{ data: ContractVersionComparison }> {
    return this.http.get<{ data: ContractVersionComparison }>(
      `${this.base}/contract-authoring/contracts/${kind}/${id}/versions/compare`,
      { params: { from, to } },
    );
  }

  getVersionComments(versionId: string): Observable<{ data: ContractVersionComment[] }> {
    return this.http.get<{ data: ContractVersionComment[] }>(
      `${this.base}/contract-authoring/document-versions/${versionId}/comments`,
    );
  }

  addVersionComment(
    versionId: string,
    payload: ContractAddCommentRequest,
  ): Observable<{ data: ContractVersionComment }> {
    return this.http.post<{ data: ContractVersionComment }>(
      `${this.base}/contract-authoring/document-versions/${versionId}/comments`,
      payload,
    );
  }

  resolveVersionComment(commentId: string): Observable<{ data: ContractVersionComment }> {
    return this.http.post<{ data: ContractVersionComment }>(
      `${this.base}/contract-authoring/contract-comments/${commentId}/resolve`,
      {},
    );
  }
}
