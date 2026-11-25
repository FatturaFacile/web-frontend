import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  FrnAction,
  FrnAgreement,
  FrnAgreementPayload,
  FrnAnswer,
  FrnAudit,
  FrnBatch,
  FrnBenchmark,
  FrnDashboard,
  FrnEnvelope,
  FrnFormula,
  FrnFormulaPayload,
  FrnLookups,
  FrnLoyaltyPosition,
  FrnLoyaltyTransaction,
  FrnNetworkStatRow,
  FrnPage,
  FrnPortalContract,
  FrnPortalStatements,
  FrnPortalSync,
  FrnPurchase,
  FrnPush,
  FrnPushCreatePayload,
  FrnRun,
  FrnSellOut,
  FrnSellOutPayload,
  FrnSimulation,
  FrnStore,
  FrnStorePayload,
} from '../models';

type Envelope<T> = Observable<FrnEnvelope<T>>;

/** Endpoints of the franchise network governance (Mod 244). */
@Service()
export class FranchiseNetworkApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/franchise-network`;

  // --- Lookups and command view ---

  getLookups(): Envelope<FrnLookups> {
    return this.http.get<FrnEnvelope<FrnLookups>>(`${this.base}/lookups`);
  }

  getDashboard(period?: string): Envelope<FrnDashboard> {
    return this.http.get<FrnEnvelope<FrnDashboard>>(`${this.base}/dashboard`, {
      params: toHttpParams({ period }),
    });
  }

  // --- Stores ---

  listStores(q?: string): Observable<FrnPage<FrnStore>> {
    return this.http.get<FrnPage<FrnStore>>(`${this.base}/stores`, {
      params: toHttpParams({ q, per_page: 100 }),
    });
  }

  createStore(payload: FrnStorePayload): Envelope<FrnStore> {
    return this.http.post<FrnEnvelope<FrnStore>>(`${this.base}/stores`, payload);
  }

  updateStore(id: string, payload: Partial<FrnStorePayload>): Envelope<FrnStore> {
    return this.http.put<FrnEnvelope<FrnStore>>(`${this.base}/stores/${id}`, payload);
  }

  deleteStore(id: string): Envelope<null> {
    return this.http.delete<FrnEnvelope<null>>(`${this.base}/stores/${id}`);
  }

  issueLinkCode(id: string): Envelope<{ code: string }> {
    return this.http.post<FrnEnvelope<{ code: string }>>(`${this.base}/stores/${id}/link-code`, {});
  }

  // --- Formulas ---

  listFormulas(): Envelope<FrnFormula[]> {
    return this.http.get<FrnEnvelope<FrnFormula[]>>(`${this.base}/formulas`);
  }

  createFormula(payload: FrnFormulaPayload): Envelope<FrnFormula> {
    return this.http.post<FrnEnvelope<FrnFormula>>(`${this.base}/formulas`, payload);
  }

  updateFormula(id: string, payload: Partial<FrnFormulaPayload>): Envelope<FrnFormula> {
    return this.http.put<FrnEnvelope<FrnFormula>>(`${this.base}/formulas/${id}`, payload);
  }

  deleteFormula(id: string): Envelope<null> {
    return this.http.delete<FrnEnvelope<null>>(`${this.base}/formulas/${id}`);
  }

  cloneFormula(id: string, code: string): Envelope<FrnFormula> {
    return this.http.post<FrnEnvelope<FrnFormula>>(`${this.base}/formulas/${id}/clone`, { code });
  }

  simulateFormula(
    id: string,
    payload: { net_sales: number; opened_on?: string | null; period: string },
  ): Envelope<FrnSimulation> {
    return this.http.post<FrnEnvelope<FrnSimulation>>(
      `${this.base}/formulas/${id}/simulate`,
      payload,
    );
  }

  // --- Agreements ---

  listAgreements(filters: { status?: string; store_id?: string } = {}): Observable<FrnPage<FrnAgreement>> {
    return this.http.get<FrnPage<FrnAgreement>>(`${this.base}/agreements`, {
      params: toHttpParams({ ...filters, per_page: 100 }),
    });
  }

  getAgreementAlerts(): Envelope<FrnAgreement[]> {
    return this.http.get<FrnEnvelope<FrnAgreement[]>>(`${this.base}/agreements/alerts`);
  }

  getAgreement(id: string): Envelope<FrnAgreement> {
    return this.http.get<FrnEnvelope<FrnAgreement>>(`${this.base}/agreements/${id}`);
  }

  createAgreement(payload: FrnAgreementPayload): Envelope<FrnAgreement> {
    return this.http.post<FrnEnvelope<FrnAgreement>>(`${this.base}/agreements`, payload);
  }

  updateAgreement(id: string, payload: Partial<FrnAgreementPayload>): Envelope<FrnAgreement> {
    return this.http.put<FrnEnvelope<FrnAgreement>>(`${this.base}/agreements/${id}`, payload);
  }

  deleteAgreement(id: string): Envelope<null> {
    return this.http.delete<FrnEnvelope<null>>(`${this.base}/agreements/${id}`);
  }

  activateAgreement(id: string): Envelope<FrnAgreement> {
    return this.http.post<FrnEnvelope<FrnAgreement>>(`${this.base}/agreements/${id}/activate`, {});
  }

  terminateAgreement(id: string): Envelope<FrnAgreement> {
    return this.http.post<FrnEnvelope<FrnAgreement>>(`${this.base}/agreements/${id}/terminate`, {});
  }

  renewAgreement(id: string, endDate: string): Envelope<FrnAgreement> {
    return this.http.post<FrnEnvelope<FrnAgreement>>(`${this.base}/agreements/${id}/renew`, {
      end_date: endDate,
    });
  }

  // --- Central pushes ---

  listPushes(status?: string): Observable<FrnPage<FrnPush>> {
    return this.http.get<FrnPage<FrnPush>>(`${this.base}/pushes`, {
      params: toHttpParams({ status, per_page: 50 }),
    });
  }

  getPush(id: string): Envelope<FrnPush> {
    return this.http.get<FrnEnvelope<FrnPush>>(`${this.base}/pushes/${id}`);
  }

  createPush(payload: FrnPushCreatePayload): Envelope<FrnPush> {
    return this.http.post<FrnEnvelope<FrnPush>>(`${this.base}/pushes`, payload);
  }

  dispatchPush(id: string): Envelope<FrnPush> {
    return this.http.post<FrnEnvelope<FrnPush>>(`${this.base}/pushes/${id}/dispatch`, {});
  }

  retryPush(id: string): Envelope<FrnPush> {
    return this.http.post<FrnEnvelope<FrnPush>>(`${this.base}/pushes/${id}/retry`, {});
  }

  // --- Sell-out, purchases, loyalty ---

  listSellOut(period?: string, storeId?: string): Observable<FrnPage<FrnSellOut>> {
    return this.http.get<FrnPage<FrnSellOut>>(`${this.base}/sell-out`, {
      params: toHttpParams({ period, store_id: storeId, per_page: 100 }),
    });
  }

  saveSellOut(storeId: string, period: string, payload: FrnSellOutPayload): Envelope<FrnSellOut> {
    return this.http.put<FrnEnvelope<FrnSellOut>>(
      `${this.base}/stores/${storeId}/sell-out/${period}`,
      payload,
    );
  }

  importSellOut(
    period: string,
    rows: (Partial<FrnSellOutPayload> & { store_code: string; gross_sales: number })[],
  ): Envelope<{ imported: number; rejected: { store_code: string; code: string }[] }> {
    return this.http.post<
      FrnEnvelope<{ imported: number; rejected: { store_code: string; code: string }[] }>
    >(`${this.base}/sell-out/import`, { period, rows });
  }

  listPurchases(period?: string): Observable<FrnPage<FrnPurchase>> {
    return this.http.get<FrnPage<FrnPurchase>>(`${this.base}/purchases`, {
      params: toHttpParams({ period, per_page: 100 }),
    });
  }

  savePurchase(storeId: string, period: string, purchasedAmount: number): Envelope<FrnPurchase> {
    return this.http.put<FrnEnvelope<FrnPurchase>>(
      `${this.base}/stores/${storeId}/purchases/${period}`,
      { purchased_amount: purchasedAmount },
    );
  }

  listLoyalty(period?: string): Observable<FrnPage<FrnLoyaltyTransaction>> {
    return this.http.get<FrnPage<FrnLoyaltyTransaction>>(`${this.base}/loyalty/transactions`, {
      params: toHttpParams({ period, per_page: 50 }),
    });
  }

  getLoyaltySettlement(period: string): Envelope<FrnLoyaltyPosition[]> {
    return this.http.get<FrnEnvelope<FrnLoyaltyPosition[]>>(`${this.base}/loyalty/settlement`, {
      params: toHttpParams({ period }),
    });
  }

  // --- Royalty runs ---

  listRuns(): Observable<FrnPage<FrnRun>> {
    return this.http.get<FrnPage<FrnRun>>(`${this.base}/royalty-runs`);
  }

  getRun(id: string): Envelope<FrnRun> {
    return this.http.get<FrnEnvelope<FrnRun>>(`${this.base}/royalty-runs/${id}`);
  }

  calculateRun(period: string): Envelope<FrnRun> {
    return this.http.post<FrnEnvelope<FrnRun>>(`${this.base}/royalty-runs`, { period });
  }

  invoiceRun(id: string): Envelope<FrnRun> {
    return this.http.post<FrnEnvelope<FrnRun>>(`${this.base}/royalty-runs/${id}/invoice`, {});
  }

  getRunBatches(id: string): Envelope<FrnBatch[]> {
    return this.http.get<FrnEnvelope<FrnBatch[]>>(`${this.base}/royalty-runs/${id}/batches`);
  }

  // --- Audits ---

  listAudits(filters: { store_id?: string; status?: string } = {}): Observable<FrnPage<FrnAudit>> {
    return this.http.get<FrnPage<FrnAudit>>(`${this.base}/audits`, {
      params: toHttpParams({ ...filters, per_page: 50 }),
    });
  }

  getAudit(id: string): Envelope<FrnAudit> {
    return this.http.get<FrnEnvelope<FrnAudit>>(`${this.base}/audits/${id}`);
  }

  startAudit(payload: {
    store_id: string;
    template_id: string;
    audited_on?: string | null;
  }): Envelope<FrnAudit> {
    return this.http.post<FrnEnvelope<FrnAudit>>(`${this.base}/audits`, payload);
  }

  saveAuditAnswers(id: string, answers: FrnAnswer[], notes: string | null): Envelope<FrnAudit> {
    return this.http.put<FrnEnvelope<FrnAudit>>(`${this.base}/audits/${id}/answers`, {
      answers,
      notes,
    });
  }

  addAuditPhoto(
    id: string,
    file: File,
    criterionCode: string | null,
    caption: string | null,
  ): Envelope<FrnAudit> {
    const body = new FormData();
    body.append('photo', file);
    if (criterionCode) {
      body.append('criterion_code', criterionCode);
    }
    if (caption) {
      body.append('caption', caption);
    }
    return this.http.post<FrnEnvelope<FrnAudit>>(`${this.base}/audits/${id}/photos`, body);
  }

  removeAuditPhoto(id: string, photoId: string): Envelope<FrnAudit> {
    return this.http.delete<FrnEnvelope<FrnAudit>>(`${this.base}/audits/${id}/photos/${photoId}`);
  }

  auditPhotoBlob(id: string, photoId: string): Observable<Blob> {
    return this.http.get(`${this.base}/audits/${id}/photos/${photoId}`, { responseType: 'blob' });
  }

  submitAudit(id: string): Envelope<FrnAudit> {
    return this.http.post<FrnEnvelope<FrnAudit>>(`${this.base}/audits/${id}/submit`, {});
  }

  listAuditActions(filters: { status?: string; store_id?: string } = {}): Observable<FrnPage<FrnAction>> {
    return this.http.get<FrnPage<FrnAction>>(`${this.base}/audit-actions`, {
      params: toHttpParams({ ...filters, per_page: 100 }),
    });
  }

  completeAuditAction(id: string, note: string | null): Envelope<FrnAction> {
    return this.http.post<FrnEnvelope<FrnAction>>(`${this.base}/audit-actions/${id}/complete`, {
      completion_note: note,
    });
  }

  // --- Benchmark ---

  computeBenchmark(period: string): Envelope<{ stores: number; stats: number }> {
    return this.http.post<FrnEnvelope<{ stores: number; stats: number }>>(
      `${this.base}/benchmark/snapshot`,
      { period },
    );
  }

  getBenchmarkStats(period?: string): Envelope<{ period: string; rows: FrnNetworkStatRow[] }> {
    return this.http.get<FrnEnvelope<{ period: string; rows: FrnNetworkStatRow[] }>>(
      `${this.base}/benchmark/stats`,
      { params: toHttpParams({ period }) },
    );
  }

  // --- Franchisee portal ---

  getPortalStores(): Envelope<{ stores: FrnStore[] }> {
    return this.http.get<FrnEnvelope<{ stores: FrnStore[] }>>(`${this.base}/portal/me`);
  }

  linkPortal(code: string): Envelope<FrnStore> {
    return this.http.post<FrnEnvelope<FrnStore>>(`${this.base}/portal/link`, { code });
  }

  getPortalContract(storeId?: string): Envelope<FrnPortalContract> {
    return this.http.get<FrnEnvelope<FrnPortalContract>>(`${this.base}/portal/contract`, {
      params: toHttpParams({ store_id: storeId }),
    });
  }

  getPortalSyncs(storeId?: string): Envelope<FrnPortalSync[]> {
    return this.http.get<FrnEnvelope<FrnPortalSync[]>>(`${this.base}/portal/syncs`, {
      params: toHttpParams({ store_id: storeId }),
    });
  }

  acknowledgePortalSync(id: string, storeId?: string): Envelope<{ id: string; status: string }> {
    return this.http.post<FrnEnvelope<{ id: string; status: string }>>(
      `${this.base}/portal/syncs/${id}/acknowledge`,
      {},
      { params: toHttpParams({ store_id: storeId }) },
    );
  }

  getPortalStatements(storeId?: string): Envelope<FrnPortalStatements> {
    return this.http.get<FrnEnvelope<FrnPortalStatements>>(`${this.base}/portal/statements`, {
      params: toHttpParams({ store_id: storeId }),
    });
  }

  getPortalBenchmark(storeId?: string, period?: string): Envelope<FrnBenchmark> {
    return this.http.get<FrnEnvelope<FrnBenchmark>>(`${this.base}/portal/benchmark`, {
      params: toHttpParams({ store_id: storeId, period }),
    });
  }
}
