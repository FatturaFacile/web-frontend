import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ContractAlertResource,
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
}
