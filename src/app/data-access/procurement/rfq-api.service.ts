import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toHttpParams } from '@core/http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  PurchaseOrder,
} from '@core/models';
import {
  ApprovedRequisitionOption,
  AwardRfqPayload,
  BidComparisonMatrix,
  CreateRfqFromRequisitionsPayload,
  CreateRfqPayload,
  ExternalBidSubmissionPayload,
  ExternalRfqPortalView,
  QualifiedSupplierOption,
  RfqAttachment,
  RfqSummary,
  SupplierBid,
} from '@domain/procurement/rfq.models';
import { environment } from '@env';
import { Observable } from 'rxjs';

export interface RfqListFilters {
  status?: string | null;
  buyer_user_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  search?: string | null;
  page?: number;
  per_page?: number;
}

/**
 * Typed HTTP repository for Mod 045 (Requests for Quotation, Comparison Matrix, Awarding & Public Supplier Portal).
 */
@Injectable({ providedIn: 'root' })
export class RfqApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/procurement/rfqs`;
  private readonly procurementBase = `${environment.apiBaseUrl}/procurement`;
  private readonly publicBase = `${environment.apiBaseUrl}/public/rfq-portal`;

  listRfqs(filters?: RfqListFilters): Observable<PaginatedResponse<RfqSummary>> {
    return this.http.get<PaginatedResponse<RfqSummary>>(this.base, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getRfq(rfqId: string): Observable<ApiResponse<RfqSummary>> {
    return this.http.get<ApiResponse<RfqSummary>>(`${this.base}/${rfqId}`);
  }

  createRfq(payload: CreateRfqPayload): Observable<ApiResponse<RfqSummary>> {
    return this.http.post<ApiResponse<RfqSummary>>(this.base, payload);
  }

  createFromRequisitions(payload: CreateRfqFromRequisitionsPayload): Observable<ApiResponse<RfqSummary>> {
    return this.http.post<ApiResponse<RfqSummary>>(`${this.base}/from-requisitions`, payload);
  }

  updateRfq(rfqId: string, payload: Partial<CreateRfqPayload>): Observable<ApiResponse<RfqSummary>> {
    return this.http.put<ApiResponse<RfqSummary>>(`${this.base}/${rfqId}`, payload);
  }

  publishRfq(rfqId: string): Observable<ApiResponse<RfqSummary>> {
    return this.http.post<ApiResponse<RfqSummary>>(`${this.base}/${rfqId}/publish`, {});
  }

  extendDeadline(rfqId: string, submissionDeadline: string): Observable<ApiResponse<RfqSummary>> {
    return this.http.post<ApiResponse<RfqSummary>>(`${this.base}/${rfqId}/extend-deadline`, {
      submission_deadline: submissionDeadline,
    });
  }

  getComparisonMatrix(rfqId: string): Observable<ApiResponse<BidComparisonMatrix>> {
    return this.http.get<ApiResponse<BidComparisonMatrix>>(`${this.base}/${rfqId}/comparison-matrix`);
  }

  awardRfq(
    rfqId: string,
    payload: AwardRfqPayload,
  ): Observable<ApiResponse<{ rfq: RfqSummary; purchase_orders: PurchaseOrder[] }>> {
    return this.http.post<ApiResponse<{ rfq: RfqSummary; purchase_orders: PurchaseOrder[] }>>(
      `${this.base}/${rfqId}/award`,
      payload,
    );
  }

  cancelRfq(rfqId: string, reason?: string | null): Observable<ApiResponse<RfqSummary>> {
    return this.http.post<ApiResponse<RfqSummary>>(`${this.base}/${rfqId}/cancel`, {
      reason: reason ?? null,
    });
  }

  uploadAttachment(
    rfqId: string,
    file: File,
    isVisibleToSuppliers: boolean,
  ): Observable<ApiResponse<RfqAttachment>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_visible_to_suppliers', isVisibleToSuppliers ? '1' : '0');

    return this.http.post<ApiResponse<RfqAttachment>>(`${this.base}/${rfqId}/attachments`, formData);
  }

  toggleAttachmentVisibility(
    rfqId: string,
    attachmentId: string,
    isVisibleToSuppliers: boolean,
  ): Observable<ApiResponse<RfqAttachment>> {
    return this.http.patch<ApiResponse<RfqAttachment>>(
      `${this.base}/${rfqId}/attachments/${attachmentId}`,
      { is_visible_to_suppliers: isVisibleToSuppliers },
    );
  }

  downloadAttachment(rfqId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${rfqId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
  }

  deleteAttachment(rfqId: string, attachmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${rfqId}/attachments/${attachmentId}`);
  }

  listApprovedRequisitions(): Observable<PaginatedResponse<ApprovedRequisitionOption>> {
    return this.http.get<PaginatedResponse<ApprovedRequisitionOption>>(`${this.procurementBase}/requisitions`, {
      params: toHttpParams({ status: 'approved', per_page: 100 }),
    });
  }

  listQualifiedSuppliers(search?: string, categoryId?: string | null): Observable<PaginatedResponse<QualifiedSupplierOption>> {
    return this.http.get<PaginatedResponse<QualifiedSupplierOption>>(`${this.procurementBase}/suppliers`, {
      params: toHttpParams({
        avl_only: true,
        search,
        category_id: categoryId,
        per_page: 100,
      }),
    });
  }

  // --- Public Magic-Link Supplier Bidding Portal ---

  getPublicPortal(token: string, locale?: string): Observable<ApiResponse<ExternalRfqPortalView>> {
    return this.http.get<ApiResponse<ExternalRfqPortalView>>(`${this.publicBase}/${token}`, {
      params: locale ? toHttpParams({ locale }) : undefined,
    });
  }

  submitPublicBid(
    token: string,
    payload: ExternalBidSubmissionPayload,
  ): Observable<ApiResponse<SupplierBid>> {
    if (payload.quote_attachment) {
      const formData = new FormData();
      formData.append('action', payload.action);
      if (payload.supplier_quote_reference) {
        formData.append('supplier_quote_reference', payload.supplier_quote_reference);
      }
      formData.append('currency_code', payload.currency_code);
      formData.append('payment_terms_days', String(payload.payment_terms_days));
      if (payload.incoterms) {
        formData.append('incoterms', payload.incoterms);
      }
      formData.append('shipping_cost', String(payload.shipping_cost));
      if (payload.valid_until) {
        formData.append('valid_until', payload.valid_until);
      }
      if (payload.general_notes) {
        formData.append('general_notes', payload.general_notes);
      }
      formData.append('lines', JSON.stringify(payload.lines));
      formData.append('quote_attachment', payload.quote_attachment);

      return this.http.post<ApiResponse<SupplierBid>>(`${this.publicBase}/${token}/bid`, formData);
    }

    return this.http.post<ApiResponse<SupplierBid>>(`${this.publicBase}/${token}/bid`, {
      action: payload.action,
      supplier_quote_reference: payload.supplier_quote_reference ?? null,
      currency_code: payload.currency_code,
      payment_terms_days: payload.payment_terms_days,
      incoterms: payload.incoterms ?? null,
      shipping_cost: payload.shipping_cost,
      valid_until: payload.valid_until ?? null,
      general_notes: payload.general_notes ?? null,
      lines: payload.lines,
    });
  }

  declinePublicInvitation(token: string, reason?: string | null): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.publicBase}/${token}/decline`, {
      reason: reason ?? null,
    });
  }

  downloadPublicAttachment(token: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.publicBase}/${token}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
  }
}
