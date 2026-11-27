import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  FvrClaim,
  FvrClaimPeriodPayload,
  FvrClaimPreview,
  FvrCreateClaimPayload,
  FvrDashboard,
  FvrDecidePayload,
  FvrEnvelope,
  FvrExportType,
  FvrLedgerEntry,
  FvrLedgerFilters,
  FvrManualLedgerPayload,
  FvrMandate,
  FvrMandatePayload,
  FvrReconcilePayload,
  FvrReference,
  FvrRule,
  FvrRulePayload,
  FvrRulesMeta,
  FvrSettings,
  FvrSplitPreview,
  FvrSubmitPayload,
} from '../models';

type Envelope<T> = Observable<FvrEnvelope<T>>;

/** Endpoints of the foreign VAT refund module (Mod 227): dashboard, ledger, claims, rules, mandates and settings. */
@Service()
export class ForeignVatRefundApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/foreign-vat-refund`;

  // --- Dashboard and reference data ---

  getDashboard(): Envelope<FvrDashboard> {
    return this.http.get<FvrEnvelope<FvrDashboard>>(`${this.base}/dashboard`);
  }

  getReference(): Envelope<FvrReference> {
    return this.http.get<FvrEnvelope<FvrReference>>(`${this.base}/reference`);
  }

  previewSplit(payload: {
    country: string;
    expense_category_code?: number | null;
    description?: string | null;
    vat_amount: number;
  }): Envelope<FvrSplitPreview> {
    return this.http.post<FvrEnvelope<FvrSplitPreview>>(`${this.base}/preview-split`, payload);
  }

  getSettings(): Envelope<FvrSettings> {
    return this.http.get<FvrEnvelope<FvrSettings>>(`${this.base}/settings`);
  }

  saveSettings(payload: Partial<FvrSettings>): Envelope<FvrSettings> {
    return this.http.put<FvrEnvelope<FvrSettings>>(`${this.base}/settings`, payload);
  }

  // --- Ledger ---

  listLedger(filters: FvrLedgerFilters = {}): Envelope<FvrLedgerEntry[]> {
    return this.http.get<FvrEnvelope<FvrLedgerEntry[]>>(`${this.base}/ledger`, {
      params: toHttpParams({ ...filters }),
    });
  }

  createLedgerEntry(payload: FvrManualLedgerPayload): Envelope<FvrLedgerEntry> {
    return this.http.post<FvrEnvelope<FvrLedgerEntry>>(`${this.base}/ledger`, payload);
  }

  updateLedgerEntry(
    id: string,
    payload: { expense_category_code?: number; supplier_country_code?: string },
  ): Envelope<FvrLedgerEntry> {
    return this.http.patch<FvrEnvelope<FvrLedgerEntry>>(`${this.base}/ledger/${id}`, payload);
  }

  recalculateLedgerEntry(id: string): Envelope<FvrLedgerEntry> {
    return this.http.post<FvrEnvelope<FvrLedgerEntry>>(`${this.base}/ledger/${id}/recalculate`, {});
  }

  deleteLedgerEntry(id: string): Envelope<null> {
    return this.http.delete<FvrEnvelope<null>>(`${this.base}/ledger/${id}`);
  }

  uploadLedgerAttachment(id: string, file: File): Envelope<FvrLedgerEntry> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<FvrEnvelope<FvrLedgerEntry>>(`${this.base}/ledger/${id}/attachment`, body);
  }

  downloadLedgerAttachment(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/ledger/${id}/attachment`, { responseType: 'blob' });
  }

  // --- Claims ---

  listClaims(
    filters: { status?: string | null; country?: string | null; fiscal_year?: number | null } = {},
  ): Envelope<FvrClaim[]> {
    return this.http.get<FvrEnvelope<FvrClaim[]>>(`${this.base}/claims`, {
      params: toHttpParams({ ...filters }),
    });
  }

  previewClaim(payload: FvrClaimPeriodPayload): Envelope<FvrClaimPreview> {
    return this.http.post<FvrEnvelope<FvrClaimPreview>>(`${this.base}/claims/preview`, payload);
  }

  createClaim(payload: FvrCreateClaimPayload): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims`, payload);
  }

  getClaim(id: string): Envelope<FvrClaim> {
    return this.http.get<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}`);
  }

  deleteClaim(id: string): Envelope<null> {
    return this.http.delete<FvrEnvelope<null>>(`${this.base}/claims/${id}`);
  }

  markReady(id: string): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}/ready`, {});
  }

  backToDraft(id: string): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}/draft`, {});
  }

  submitClaim(id: string, payload: FvrSubmitPayload): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}/submit`, payload);
  }

  requestInformation(id: string, note: string): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}/request-information`, {
      note,
    });
  }

  decideClaim(id: string, payload: FvrDecidePayload): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}/decide`, payload);
  }

  reconcileClaim(id: string, payload: FvrReconcilePayload): Envelope<FvrClaim> {
    return this.http.post<FvrEnvelope<FvrClaim>>(`${this.base}/claims/${id}/reconcile`, payload);
  }

  downloadExport(id: string, type: FvrExportType): Observable<Blob> {
    return this.http.get(`${this.base}/claims/${id}/exports/${type}`, { responseType: 'blob' });
  }

  // --- Rules ---

  listRules(country?: string): Observable<FvrEnvelope<FvrRule[]> & { meta: FvrRulesMeta }> {
    return this.http.get<FvrEnvelope<FvrRule[]> & { meta: FvrRulesMeta }>(`${this.base}/rules`, {
      params: toHttpParams({ country }),
    });
  }

  saveRule(payload: FvrRulePayload, id?: string): Envelope<FvrRule> {
    return id === undefined
      ? this.http.post<FvrEnvelope<FvrRule>>(`${this.base}/rules`, payload)
      : this.http.put<FvrEnvelope<FvrRule>>(`${this.base}/rules/${id}`, payload);
  }

  deleteRule(id: string): Envelope<null> {
    return this.http.delete<FvrEnvelope<null>>(`${this.base}/rules/${id}`);
  }

  // --- Mandates ---

  listMandates(): Envelope<FvrMandate[]> {
    return this.http.get<FvrEnvelope<FvrMandate[]>>(`${this.base}/mandates`);
  }

  saveMandate(payload: FvrMandatePayload, id?: string): Envelope<FvrMandate> {
    return id === undefined
      ? this.http.post<FvrEnvelope<FvrMandate>>(`${this.base}/mandates`, payload)
      : this.http.put<FvrEnvelope<FvrMandate>>(`${this.base}/mandates/${id}`, payload);
  }

  deleteMandate(id: string): Envelope<null> {
    return this.http.delete<FvrEnvelope<null>>(`${this.base}/mandates/${id}`);
  }

  uploadMandateDocument(
    id: string,
    type: 'power_of_attorney' | 'certificate',
    file: File,
    certificateExpiryDate?: string | null,
  ): Envelope<FvrMandate> {
    const body = new FormData();
    body.append('file', file);
    body.append('type', type);
    if (certificateExpiryDate) {
      body.append('certificate_expiry_date', certificateExpiryDate);
    }
    return this.http.post<FvrEnvelope<FvrMandate>>(`${this.base}/mandates/${id}/documents`, body);
  }

  downloadMandateDocument(id: string, type: 'power_of_attorney' | 'certificate'): Observable<Blob> {
    return this.http.get(`${this.base}/mandates/${id}/documents/${type}`, { responseType: 'blob' });
  }
}
