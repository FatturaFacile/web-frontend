import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  GdtAccrualPayload,
  GdtAccrualResult,
  GdtAccrualRun,
  GdtContract,
  GdtContractFilters,
  GdtContractPayload,
  GdtCreditNotePayload,
  GdtDashboard,
  GdtDeliveryPoint,
  GdtDeliveryPointPayload,
  GdtDisputeResolution,
  GdtEnvelope,
  GdtLookups,
  GdtMargin,
  GdtMarginFilters,
  GdtPage,
  GdtProductRef,
  GdtProgress,
  GdtPromoInvoicePayload,
  GdtPromotion,
  GdtPromotionFilters,
  GdtPromotionPayload,
  GdtProposePayload,
  GdtScale,
  GdtScalePayload,
  GdtSettlement,
  GdtSettlementFilters,
  GdtSimulation,
  GdtSimulationPayload,
  GdtTransition,
} from '../models';

type Envelope<T> = Observable<GdtEnvelope<T>>;

/** Endpoints of the GDO trade terms module (Mod 231). */
@Service()
export class GdoTradeTermsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/gdo-trade-terms`;

  getLookups(): Envelope<GdtLookups> {
    return this.http.get<GdtEnvelope<GdtLookups>>(`${this.base}/lookups`);
  }

  searchProducts(q: string): Envelope<GdtProductRef[]> {
    return this.http.get<GdtEnvelope<GdtProductRef[]>>(`${this.base}/products`, {
      params: toHttpParams({ q }),
    });
  }

  getDashboard(asOf?: string): Envelope<GdtDashboard> {
    return this.http.get<GdtEnvelope<GdtDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams({ as_of: asOf }),
    });
  }

  // --- Contracts ---

  listContracts(filters: GdtContractFilters = {}): Observable<GdtPage<GdtContract>> {
    return this.http.get<GdtPage<GdtContract>>(`${this.base}/contracts`, {
      params: toHttpParams(filters),
    });
  }

  getContract(id: string): Envelope<GdtContract> {
    return this.http.get<GdtEnvelope<GdtContract>>(`${this.base}/contracts/${id}`);
  }

  createContract(payload: GdtContractPayload): Envelope<GdtContract> {
    return this.http.post<GdtEnvelope<GdtContract>>(`${this.base}/contracts`, payload);
  }

  updateContract(id: string, payload: Partial<GdtContractPayload>): Envelope<GdtContract> {
    return this.http.put<GdtEnvelope<GdtContract>>(`${this.base}/contracts/${id}`, payload);
  }

  deleteContract(id: string): Envelope<null> {
    return this.http.delete<GdtEnvelope<null>>(`${this.base}/contracts/${id}`);
  }

  transitionContract(id: string, action: GdtTransition): Envelope<GdtContract> {
    return this.http.post<GdtEnvelope<GdtContract>>(`${this.base}/contracts/${id}/transition`, {
      action,
    });
  }

  getProgress(id: string, asOf?: string): Envelope<GdtProgress> {
    return this.http.get<GdtEnvelope<GdtProgress>>(`${this.base}/contracts/${id}/progress`, {
      params: toHttpParams({ as_of: asOf }),
    });
  }

  // --- Scales ---

  createScale(contractId: string, payload: GdtScalePayload): Envelope<GdtScale> {
    return this.http.post<GdtEnvelope<GdtScale>>(
      `${this.base}/contracts/${contractId}/scales`,
      payload,
    );
  }

  updateScale(
    contractId: string,
    scaleId: string,
    payload: Partial<GdtScalePayload>,
  ): Envelope<GdtScale> {
    return this.http.put<GdtEnvelope<GdtScale>>(
      `${this.base}/contracts/${contractId}/scales/${scaleId}`,
      payload,
    );
  }

  deleteScale(contractId: string, scaleId: string): Envelope<null> {
    return this.http.delete<GdtEnvelope<null>>(
      `${this.base}/contracts/${contractId}/scales/${scaleId}`,
    );
  }

  simulate(payload: GdtSimulationPayload): Envelope<GdtSimulation> {
    return this.http.post<GdtEnvelope<GdtSimulation>>(`${this.base}/scale-simulations`, payload);
  }

  // --- Promotions ---

  listPromotions(filters: GdtPromotionFilters = {}): Observable<GdtPage<GdtPromotion>> {
    return this.http.get<GdtPage<GdtPromotion>>(`${this.base}/promotions`, {
      params: toHttpParams(filters),
    });
  }

  createPromotion(contractId: string, payload: GdtPromotionPayload): Envelope<GdtPromotion> {
    return this.http.post<GdtEnvelope<GdtPromotion>>(
      `${this.base}/contracts/${contractId}/promotions`,
      payload,
    );
  }

  updatePromotion(
    contractId: string,
    promotionId: string,
    payload: Partial<GdtPromotionPayload>,
  ): Envelope<GdtPromotion> {
    return this.http.put<GdtEnvelope<GdtPromotion>>(
      `${this.base}/contracts/${contractId}/promotions/${promotionId}`,
      payload,
    );
  }

  transitionPromotion(
    contractId: string,
    promotionId: string,
    action: GdtTransition,
  ): Envelope<GdtPromotion> {
    return this.http.post<GdtEnvelope<GdtPromotion>>(
      `${this.base}/contracts/${contractId}/promotions/${promotionId}/transition`,
      { action },
    );
  }

  deletePromotion(contractId: string, promotionId: string): Envelope<null> {
    return this.http.delete<GdtEnvelope<null>>(
      `${this.base}/contracts/${contractId}/promotions/${promotionId}`,
    );
  }

  // --- Delivery points ---

  listDeliveryPoints(
    filters: { contact_id?: string; q?: string; per_page?: number } = {},
  ): Observable<GdtPage<GdtDeliveryPoint>> {
    return this.http.get<GdtPage<GdtDeliveryPoint>>(`${this.base}/delivery-points`, {
      params: toHttpParams(filters),
    });
  }

  createDeliveryPoint(payload: GdtDeliveryPointPayload): Envelope<GdtDeliveryPoint> {
    return this.http.post<GdtEnvelope<GdtDeliveryPoint>>(`${this.base}/delivery-points`, payload);
  }

  updateDeliveryPoint(
    id: string,
    payload: Partial<GdtDeliveryPointPayload>,
  ): Envelope<GdtDeliveryPoint> {
    return this.http.put<GdtEnvelope<GdtDeliveryPoint>>(
      `${this.base}/delivery-points/${id}`,
      payload,
    );
  }

  deleteDeliveryPoint(id: string): Envelope<null> {
    return this.http.delete<GdtEnvelope<null>>(`${this.base}/delivery-points/${id}`);
  }

  // --- Accruals ---

  listAccrualRuns(
    filters: { status?: string; per_page?: number; page?: number } = {},
  ): Observable<GdtPage<GdtAccrualRun>> {
    return this.http.get<GdtPage<GdtAccrualRun>>(`${this.base}/accrual-runs`, {
      params: toHttpParams(filters),
    });
  }

  previewAccrual(period: string): Envelope<GdtAccrualResult> {
    return this.http.post<GdtEnvelope<GdtAccrualResult>>(`${this.base}/accrual-runs/preview`, {
      period,
    });
  }

  runAccrual(payload: GdtAccrualPayload): Envelope<GdtAccrualResult> {
    return this.http.post<GdtEnvelope<GdtAccrualResult>>(`${this.base}/accrual-runs`, payload);
  }

  getAccrualRun(id: string): Envelope<GdtAccrualRun> {
    return this.http.get<GdtEnvelope<GdtAccrualRun>>(`${this.base}/accrual-runs/${id}`);
  }

  reverseAccrualRun(id: string, reason: string): Envelope<GdtAccrualRun> {
    return this.http.post<GdtEnvelope<GdtAccrualRun>>(`${this.base}/accrual-runs/${id}/reverse`, {
      reason,
    });
  }

  // --- Settlements ---

  listSettlements(filters: GdtSettlementFilters = {}): Observable<GdtPage<GdtSettlement>> {
    return this.http.get<GdtPage<GdtSettlement>>(`${this.base}/settlements`, {
      params: toHttpParams(filters),
    });
  }

  proposeSettlement(payload: GdtProposePayload): Envelope<GdtSettlement> {
    return this.http.post<GdtEnvelope<GdtSettlement>>(`${this.base}/settlements`, payload);
  }

  getSettlement(id: string): Envelope<GdtSettlement> {
    return this.http.get<GdtEnvelope<GdtSettlement>>(`${this.base}/settlements/${id}`);
  }

  settleCreditNote(id: string, payload: GdtCreditNotePayload): Envelope<GdtSettlement> {
    return this.http.post<GdtEnvelope<GdtSettlement>>(
      `${this.base}/settlements/${id}/credit-note`,
      payload,
    );
  }

  reconcilePromoInvoice(id: string, payload: GdtPromoInvoicePayload): Envelope<GdtSettlement> {
    return this.http.post<GdtEnvelope<GdtSettlement>>(
      `${this.base}/settlements/${id}/promo-invoice`,
      payload,
    );
  }

  resolveDispute(
    id: string,
    resolution: GdtDisputeResolution,
    notes: string | null,
  ): Envelope<GdtSettlement> {
    return this.http.post<GdtEnvelope<GdtSettlement>>(
      `${this.base}/settlements/${id}/resolve-dispute`,
      { resolution, notes },
    );
  }

  cancelSettlement(id: string): Envelope<GdtSettlement> {
    return this.http.post<GdtEnvelope<GdtSettlement>>(`${this.base}/settlements/${id}/cancel`, {});
  }

  // --- Margin ---

  getNetNetMargin(filters: GdtMarginFilters): Envelope<GdtMargin> {
    return this.http.get<GdtEnvelope<GdtMargin>>(`${this.base}/net-net-margin`, {
      params: toHttpParams(filters),
    });
  }
}
