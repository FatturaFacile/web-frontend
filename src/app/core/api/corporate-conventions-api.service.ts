import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  CcvCheckoutRequest,
  CcvCheckoutResult,
  CcvConsolidationPreview,
  CcvConsolidationRequest,
  CcvConsolidationResult,
  CcvConvention,
  CcvConventionFilters,
  CcvConventionPayload,
  CcvEnrollment,
  CcvEnvelope,
  CcvIdentifierStats,
  CcvImportResult,
  CcvLookups,
  CcvOtpRequested,
  CcvPage,
  CcvPass,
  CcvPendingQuota,
  CcvPricing,
  CcvPricingRequest,
  CcvPublicConvention,
  CcvReconcileRequest,
  CcvReconcileResult,
  CcvRelationship,
  CcvRoi,
  CcvRoiFilters,
  CcvSplitBilling,
  CcvWelfareFilters,
  CcvWelfareProvider,
  CcvWelfareRedeemRequest,
  CcvWelfareRedemption,
  CcvWelfareSummaryRow,
} from '../models';

type Envelope<T> = Observable<CcvEnvelope<T>>;

/** Endpoints of the corporate conventions module (Mod 358): back office, till, billing, welfare vouchers and the public landing page. */
@Service()
export class CorporateConventionsApiService {
  private readonly http = inject(HttpClient);
  private readonly sales = `${environment.apiBaseUrl}/sales`;
  private readonly conventions = `${this.sales}/corporate-conventions`;
  private readonly publicBase = `${environment.apiBaseUrl}/public/conventions`;

  // --- Lookups and analytics ---

  getLookups(): Envelope<CcvLookups> {
    return this.http.get<CcvEnvelope<CcvLookups>>(`${this.conventions}/lookups`);
  }

  getRoi(filters: CcvRoiFilters = {}): Envelope<CcvRoi> {
    return this.http.get<CcvEnvelope<CcvRoi>>(`${this.conventions}/analytics/roi`, {
      params: toHttpParams(filters),
    });
  }

  exportRoi(filters: CcvRoiFilters = {}): Observable<Blob> {
    return this.http.get(`${this.conventions}/analytics/roi/export`, {
      params: toHttpParams(filters),
      responseType: 'blob',
    });
  }

  // --- Conventions ---

  listConventions(filters: CcvConventionFilters = {}): Observable<CcvPage<CcvConvention>> {
    return this.http.get<CcvPage<CcvConvention>>(this.conventions, {
      params: toHttpParams(filters),
    });
  }

  getConvention(id: string): Envelope<CcvConvention> {
    return this.http.get<CcvEnvelope<CcvConvention>>(`${this.conventions}/${id}`);
  }

  createConvention(payload: CcvConventionPayload): Envelope<CcvConvention> {
    return this.http.post<CcvEnvelope<CcvConvention>>(this.conventions, payload);
  }

  updateConvention(id: string, payload: Partial<CcvConventionPayload>): Envelope<CcvConvention> {
    return this.http.put<CcvEnvelope<CcvConvention>>(`${this.conventions}/${id}`, payload);
  }

  deleteConvention(id: string): Envelope<null> {
    return this.http.delete<CcvEnvelope<null>>(`${this.conventions}/${id}`);
  }

  transitionConvention(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED',
  ): Envelope<CcvConvention> {
    return this.http.post<CcvEnvelope<CcvConvention>>(`${this.conventions}/${id}/transition`, {
      status,
    });
  }

  importIdentifiers(id: string, identifiers: string[], dryRun: boolean): Envelope<CcvImportResult> {
    return this.http.post<CcvEnvelope<CcvImportResult>>(`${this.conventions}/${id}/identifiers`, {
      identifiers,
      dry_run: dryRun,
    });
  }

  importIdentifiersFile(id: string, file: File, dryRun: boolean): Envelope<CcvImportResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('dry_run', dryRun ? '1' : '0');
    return this.http.post<CcvEnvelope<CcvImportResult>>(
      `${this.conventions}/${id}/identifiers`,
      body,
    );
  }

  getIdentifierStats(id: string): Envelope<CcvIdentifierStats> {
    return this.http.get<CcvEnvelope<CcvIdentifierStats>>(
      `${this.conventions}/${id}/identifiers/stats`,
    );
  }

  uploadContract(id: string, file: File): Envelope<CcvConvention> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<CcvEnvelope<CcvConvention>>(`${this.conventions}/${id}/contract`, body);
  }

  downloadContract(id: string): Observable<Blob> {
    return this.http.get(`${this.conventions}/${id}/contract`, { responseType: 'blob' });
  }

  uploadLogo(id: string, file: File): Envelope<CcvConvention> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<CcvEnvelope<CcvConvention>>(`${this.conventions}/${id}/logo`, body);
  }

  // --- Beneficiaries and till ---

  listEnrollments(
    filters: {
      convention_id?: string;
      status?: string;
      q?: string;
      per_page?: number;
      page?: number;
    } = {},
  ): Observable<CcvPage<CcvEnrollment>> {
    return this.http.get<CcvPage<CcvEnrollment>>(`${this.conventions}/enrollments`, {
      params: toHttpParams(filters),
    });
  }

  verifyIdentifier(payload: {
    identifier: string;
    convention_id?: string | null;
    full_name?: string | null;
    email?: string | null;
  }): Envelope<CcvEnrollment> {
    return this.http.post<CcvEnvelope<CcvEnrollment>>(
      `${this.conventions}/enrollments/verify`,
      payload,
    );
  }

  addFamilyMember(
    enrollmentId: string,
    payload: { full_name: string; relationship: CcvRelationship },
  ): Envelope<CcvEnrollment> {
    return this.http.post<CcvEnvelope<CcvEnrollment>>(
      `${this.conventions}/enrollments/${enrollmentId}/family-members`,
      payload,
    );
  }

  revokeEnrollment(enrollmentId: string): Envelope<CcvEnrollment> {
    return this.http.post<CcvEnvelope<CcvEnrollment>>(
      `${this.conventions}/enrollments/${enrollmentId}/revoke`,
      {},
    );
  }

  priceCart(payload: CcvPricingRequest): Envelope<CcvPricing> {
    return this.http.post<CcvEnvelope<CcvPricing>>(`${this.conventions}/pos/pricing`, payload);
  }

  checkout(payload: CcvCheckoutRequest): Envelope<CcvCheckoutResult> {
    return this.http.post<CcvEnvelope<CcvCheckoutResult>>(
      `${this.conventions}/pos/checkout`,
      payload,
    );
  }

  // --- Split billing ---

  listSplitBillings(
    filters: {
      convention_id?: string;
      status?: string;
      from?: string;
      to?: string;
      per_page?: number;
      page?: number;
    } = {},
  ): Observable<CcvPage<CcvSplitBilling>> {
    return this.http.get<CcvPage<CcvSplitBilling>>(`${this.sales}/split-billings`, {
      params: toHttpParams(filters),
    });
  }

  getPendingQuotas(): Envelope<CcvPendingQuota[]> {
    return this.http.get<CcvEnvelope<CcvPendingQuota[]>>(`${this.sales}/split-billings/pending`);
  }

  previewConsolidation(payload: CcvConsolidationRequest): Envelope<CcvConsolidationPreview> {
    return this.http.post<CcvEnvelope<CcvConsolidationPreview>>(
      `${this.sales}/split-billings/preview`,
      payload,
    );
  }

  generateInvoice(payload: CcvConsolidationRequest): Envelope<CcvConsolidationResult> {
    return this.http.post<CcvEnvelope<CcvConsolidationResult>>(
      `${this.sales}/split-billings/generate-invoice`,
      payload,
    );
  }

  downloadSchedule(invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.sales}/split-billings/invoices/${invoiceId}/attachment`, {
      responseType: 'blob',
    });
  }

  // --- Welfare vouchers ---

  listWelfareVouchers(filters: CcvWelfareFilters = {}): Observable<CcvPage<CcvWelfareRedemption>> {
    return this.http.get<CcvPage<CcvWelfareRedemption>>(`${this.sales}/welfare-vouchers`, {
      params: toHttpParams(filters),
    });
  }

  getWelfareSummary(): Envelope<CcvWelfareSummaryRow[]> {
    return this.http.get<CcvEnvelope<CcvWelfareSummaryRow[]>>(
      `${this.sales}/welfare-vouchers/summary`,
    );
  }

  redeemVoucher(payload: CcvWelfareRedeemRequest): Envelope<CcvWelfareRedemption> {
    return this.http.post<CcvEnvelope<CcvWelfareRedemption>>(
      `${this.sales}/welfare-vouchers/redeem`,
      payload,
    );
  }

  submitVoucherBatch(
    provider: CcvWelfareProvider,
    batchReference: string,
    redemptionIds: string[],
  ): Envelope<{ submitted: number; batch_reference: string }> {
    return this.http.post<CcvEnvelope<{ submitted: number; batch_reference: string }>>(
      `${this.sales}/welfare-vouchers/submit-batch`,
      { provider, batch_reference: batchReference, redemption_ids: redemptionIds },
    );
  }

  reconcileVouchers(payload: CcvReconcileRequest): Envelope<CcvReconcileResult> {
    return this.http.post<CcvEnvelope<CcvReconcileResult>>(
      `${this.sales}/welfare-vouchers/reconcile`,
      payload,
    );
  }

  // --- Public landing page (no account) ---

  getPublicConvention(slug: string): Envelope<CcvPublicConvention> {
    return this.http.get<CcvEnvelope<CcvPublicConvention>>(`${this.publicBase}/${slug}`);
  }

  publicLogoUrl(slug: string): string {
    return `${this.publicBase}/${slug}/logo`;
  }

  /** URL of a file of a pass: its QR code (`qr.svg`, `qr.png`) or the Apple Wallet archive (`apple.pkpass`). */
  passAssetUrl(walletPassId: string, file: 'qr.svg' | 'qr.png' | 'apple.pkpass'): string {
    return `${this.publicBase}/passes/${walletPassId}/${file}`;
  }

  requestOtp(slug: string, email: string): Envelope<CcvOtpRequested> {
    return this.http.post<CcvEnvelope<CcvOtpRequested>>(`${this.publicBase}/${slug}/request-otp`, {
      email,
    });
  }

  verifyOtp(slug: string, email: string, code: string, fullName: string): Envelope<CcvPass> {
    return this.http.post<CcvEnvelope<CcvPass>>(`${this.publicBase}/${slug}/verify-otp`, {
      email,
      code,
      full_name: fullName,
    });
  }

  verifyPublicIdentifier(
    slug: string,
    identifier: string,
    fullName: string,
    email?: string,
  ): Envelope<CcvPass> {
    return this.http.post<CcvEnvelope<CcvPass>>(`${this.publicBase}/${slug}/verify-identifier`, {
      identifier,
      full_name: fullName,
      email: email || undefined,
    });
  }

  getPass(walletPassId: string): Envelope<CcvPass> {
    return this.http.get<CcvEnvelope<CcvPass>>(`${this.publicBase}/passes/${walletPassId}`);
  }

  addPublicFamilyMember(
    walletPassId: string,
    payload: { full_name: string; relationship: CcvRelationship },
  ): Envelope<CcvPass> {
    return this.http.post<CcvEnvelope<CcvPass>>(
      `${this.publicBase}/passes/${walletPassId}/family-members`,
      payload,
    );
  }
}
