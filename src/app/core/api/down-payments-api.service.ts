import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  DpChain,
  DpChainDetail,
  DpChainFilters,
  DpConfirmPaymentPayload,
  DpCreatePayload,
  DpCreditNotePayload,
  DpCreditNotePreview,
  DpCreditNoteResult,
  DpDeposit,
  DpEmitPayload,
  DpEmitResult,
  DpEnvelope,
  DpLookups,
  DpPlanPayload,
  DpPlanPreview,
  DpResolutionPreview,
  DpResolvePayload,
  DpSettlementPayload,
  DpSettlementPreview,
  DpSettlementResult,
} from '../models';

type Envelope<T> = Observable<DpEnvelope<T>>;

/** Endpoints of the down-payment chain module (Mod 203): plan wizard, advances, deposits, final settlement and credit notes. */
@Service()
export class DownPaymentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/down-payment-chains`;

  getLookups(): Envelope<DpLookups> {
    return this.http.get<DpEnvelope<DpLookups>>(`${this.base}/lookups`);
  }

  // --- Chains ---

  listChains(filters: DpChainFilters = {}): Envelope<DpChain[]> {
    return this.http.get<DpEnvelope<DpChain[]>>(this.base, { params: toHttpParams(filters) });
  }

  getChain(id: string): Envelope<DpChainDetail> {
    return this.http.get<DpEnvelope<DpChainDetail>>(`${this.base}/${id}`);
  }

  previewPlan(payload: DpPlanPayload): Envelope<DpPlanPreview> {
    return this.http.post<DpEnvelope<DpPlanPreview>>(`${this.base}/preview-plan`, payload);
  }

  createFromSource(payload: DpCreatePayload): Envelope<DpChainDetail> {
    return this.http.post<DpEnvelope<DpChainDetail>>(`${this.base}/from-source`, payload);
  }

  cancelChain(id: string): Envelope<DpChainDetail> {
    return this.http.post<DpEnvelope<DpChainDetail>>(`${this.base}/${id}/cancel`, {});
  }

  emitInstallment(
    id: string,
    installmentId: string,
    payload: DpEmitPayload = {},
  ): Envelope<DpEmitResult> {
    return this.http.post<DpEnvelope<DpEmitResult>>(
      `${this.base}/${id}/installments/${installmentId}/emit`,
      payload,
    );
  }

  // --- Pro-forma, final settlement and credit notes ---

  confirmProformaPayment(
    id: string,
    linkId: string,
    payload: DpConfirmPaymentPayload,
  ): Envelope<DpChainDetail> {
    return this.http.post<DpEnvelope<DpChainDetail>>(
      `${this.base}/${id}/proforma/${linkId}/confirm-payment`,
      payload,
    );
  }

  previewFinalSettlement(id: string): Envelope<DpSettlementPreview> {
    return this.http.post<DpEnvelope<DpSettlementPreview>>(
      `${this.base}/${id}/preview-final-settlement`,
      {},
    );
  }

  generateFinalSettlement(
    id: string,
    payload: DpSettlementPayload = {},
  ): Envelope<DpSettlementResult> {
    return this.http.post<DpEnvelope<DpSettlementResult>>(
      `${this.base}/${id}/generate-final-settlement`,
      payload,
    );
  }

  previewCreditNote(
    id: string,
    linkId: string,
    payload: DpCreditNotePayload,
  ): Envelope<DpCreditNotePreview> {
    return this.http.post<DpEnvelope<DpCreditNotePreview>>(
      `${this.base}/${id}/links/${linkId}/credit-note/preview`,
      payload,
    );
  }

  issueCreditNote(
    id: string,
    linkId: string,
    payload: DpCreditNotePayload,
  ): Envelope<DpCreditNoteResult> {
    return this.http.post<DpEnvelope<DpCreditNoteResult>>(
      `${this.base}/${id}/links/${linkId}/credit-note`,
      payload,
    );
  }

  // --- Deposits ---

  confirmDepositPayment(
    id: string,
    depositId: string,
    payload: DpConfirmPaymentPayload,
  ): Envelope<DpDeposit> {
    return this.http.post<DpEnvelope<DpDeposit>>(
      `${this.base}/${id}/deposits/${depositId}/confirm-payment`,
      payload,
    );
  }

  previewDepositResolution(
    id: string,
    depositId: string,
    payload: DpResolvePayload,
  ): Envelope<DpResolutionPreview> {
    return this.http.post<DpEnvelope<DpResolutionPreview>>(
      `${this.base}/${id}/deposits/${depositId}/preview-resolution`,
      payload,
    );
  }

  resolveDeposit(
    id: string,
    depositId: string,
    payload: DpResolvePayload,
  ): Envelope<DpChainDetail> {
    return this.http.post<DpEnvelope<DpChainDetail>>(
      `${this.base}/${id}/deposits/${depositId}/resolve`,
      payload,
    );
  }
}
