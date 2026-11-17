import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ReturnsClaimFilters,
  ReturnsReasonCode,
  ReturnsReasonCodeRequest,
  ReturnsResponse,
  ReturnsRma,
  ReturnsRmaFilters,
  ReturnsRmaInspectLineRequest,
  ReturnsRmaReceiveRequest,
  ReturnsRmaRequest,
  ReturnsRmaResolveRequest,
  ReturnsSettings,
  ReturnsSource,
  ReturnsSummary,
  ReturnsSupplierReturn,
  ReturnsSupplierReturnFilters,
  ReturnsSupplierReturnRequest,
  ReturnsSupplierReturnShipRequest,
  ReturnsWarranty,
  ReturnsWarrantyClaim,
  ReturnsWarrantyClaimRequest,
  ReturnsWarrantyFilters,
  ReturnsWarrantyRequest,
  ReturnsWarrantyValidity,
} from '../models';

/** Returns and warranty (RMA): customer returns, warranty registry and claims, supplier returns, settings, summary. */
@Service()
export class ReturnsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/returns`;

  // Summary and settings
  getSummary(range?: { from?: string; to?: string }): Observable<ReturnsResponse<ReturnsSummary>> {
    return this.http.get<ReturnsResponse<ReturnsSummary>>(`${this.base}/summary`, { params: this.params(range) });
  }

  getSettings(): Observable<ReturnsResponse<ReturnsSettings>> {
    return this.http.get<ReturnsResponse<ReturnsSettings>>(`${this.base}/settings`);
  }

  updateSettings(returnWindowDays: number): Observable<ReturnsResponse<ReturnsSettings>> {
    return this.http.put<ReturnsResponse<ReturnsSettings>>(`${this.base}/settings`, { return_window_days: returnWindowDays });
  }

  getReasonCodes(activeOnly = false): Observable<ReturnsResponse<ReturnsReasonCode[]>> {
    return this.http.get<ReturnsResponse<ReturnsReasonCode[]>>(`${this.base}/reason-codes`, {
      params: this.params({ active: activeOnly || undefined }),
    });
  }

  createReasonCode(payload: ReturnsReasonCodeRequest): Observable<ReturnsResponse<ReturnsReasonCode>> {
    return this.http.post<ReturnsResponse<ReturnsReasonCode>>(`${this.base}/reason-codes`, payload);
  }

  updateReasonCode(id: string, payload: Partial<Omit<ReturnsReasonCodeRequest, 'code'>>): Observable<ReturnsResponse<ReturnsReasonCode>> {
    return this.http.put<ReturnsResponse<ReturnsReasonCode>>(`${this.base}/reason-codes/${id}`, payload);
  }

  /** `deleted` is false when the code is in use and was deactivated instead. */
  deleteReasonCode(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/reason-codes/${id}`);
  }

  // Customer returns
  getSources(contactId: string): Observable<ReturnsResponse<ReturnsSource[]>> {
    return this.http.get<ReturnsResponse<ReturnsSource[]>>(`${this.base}/sources`, { params: this.params({ contact_id: contactId }) });
  }

  getRmas(filters?: ReturnsRmaFilters): Observable<ReturnsResponse<ReturnsRma[]>> {
    return this.http.get<ReturnsResponse<ReturnsRma[]>>(`${this.base}/rmas`, { params: this.params(filters) });
  }

  getRma(id: string): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.get<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}`);
  }

  createRma(payload: ReturnsRmaRequest): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas`, payload);
  }

  updateRma(id: string, payload: Partial<Pick<ReturnsRmaRequest, 'reason_code' | 'requested_on' | 'override_window' | 'notes' | 'lines'>>): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.put<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}`, payload);
  }

  approveRma(id: string, warehouseId?: string | null): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}/approve`, { warehouse_id: warehouseId ?? null });
  }

  rejectRma(id: string, reason: string): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}/reject`, { reason });
  }

  receiveRma(id: string, payload: ReturnsRmaReceiveRequest): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}/receive`, payload);
  }

  inspectRma(id: string, lines: ReturnsRmaInspectLineRequest[]): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}/inspect`, { lines });
  }

  resolveRma(id: string, payload: ReturnsRmaResolveRequest): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}/resolve`, payload);
  }

  closeRma(id: string): Observable<ReturnsResponse<ReturnsRma>> {
    return this.http.post<ReturnsResponse<ReturnsRma>>(`${this.base}/rmas/${id}/close`, {});
  }

  // Single-record reads
  getWarranty(id: string): Observable<ReturnsResponse<ReturnsWarranty>> {
    return this.http.get<ReturnsResponse<ReturnsWarranty>>(`${this.base}/warranties/${id}`);
  }

  getClaim(id: string): Observable<ReturnsResponse<ReturnsWarrantyClaim>> {
    return this.http.get<ReturnsResponse<ReturnsWarrantyClaim>>(`${this.base}/claims/${id}`);
  }

  getSupplierReturn(id: string): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.get<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns/${id}`);
  }

  // Warranties and claims
  getWarranties(filters?: ReturnsWarrantyFilters): Observable<ReturnsResponse<ReturnsWarranty[]>> {
    return this.http.get<ReturnsResponse<ReturnsWarranty[]>>(`${this.base}/warranties`, { params: this.params(filters) });
  }

  createWarranty(payload: ReturnsWarrantyRequest): Observable<ReturnsResponse<ReturnsWarranty>> {
    return this.http.post<ReturnsResponse<ReturnsWarranty>>(`${this.base}/warranties`, payload);
  }

  updateWarranty(
    id: string,
    payload: Partial<Pick<ReturnsWarrantyRequest, 'starts_on' | 'ends_on' | 'coverage_type' | 'coverage_terms'>>,
  ): Observable<ReturnsResponse<ReturnsWarranty>> {
    return this.http.put<ReturnsResponse<ReturnsWarranty>>(`${this.base}/warranties/${id}`, payload);
  }

  voidWarranty(id: string, reason: string): Observable<ReturnsResponse<ReturnsWarranty>> {
    return this.http.post<ReturnsResponse<ReturnsWarranty>>(`${this.base}/warranties/${id}/void`, { reason });
  }

  checkWarrantyValidity(id: string, on?: string): Observable<ReturnsResponse<ReturnsWarrantyValidity>> {
    return this.http.get<ReturnsResponse<ReturnsWarrantyValidity>>(`${this.base}/warranties/${id}/validity`, { params: this.params({ on }) });
  }

  getClaims(filters?: ReturnsClaimFilters): Observable<ReturnsResponse<ReturnsWarrantyClaim[]>> {
    return this.http.get<ReturnsResponse<ReturnsWarrantyClaim[]>>(`${this.base}/claims`, { params: this.params(filters) });
  }

  createClaim(payload: ReturnsWarrantyClaimRequest): Observable<ReturnsResponse<ReturnsWarrantyClaim>> {
    return this.http.post<ReturnsResponse<ReturnsWarrantyClaim>>(`${this.base}/claims`, payload);
  }

  acceptClaim(id: string, payload: { notes?: string | null; override_validity?: boolean } = {}): Observable<ReturnsResponse<ReturnsWarrantyClaim>> {
    return this.http.post<ReturnsResponse<ReturnsWarrantyClaim>>(`${this.base}/claims/${id}/accept`, payload);
  }

  rejectClaim(id: string, reason: string): Observable<ReturnsResponse<ReturnsWarrantyClaim>> {
    return this.http.post<ReturnsResponse<ReturnsWarrantyClaim>>(`${this.base}/claims/${id}/reject`, { reason });
  }

  resolveClaim(id: string): Observable<ReturnsResponse<ReturnsWarrantyClaim>> {
    return this.http.post<ReturnsResponse<ReturnsWarrantyClaim>>(`${this.base}/claims/${id}/resolve`, {});
  }

  // Supplier returns (RTV)
  getSupplierReturns(filters?: ReturnsSupplierReturnFilters): Observable<ReturnsResponse<ReturnsSupplierReturn[]>> {
    return this.http.get<ReturnsResponse<ReturnsSupplierReturn[]>>(`${this.base}/supplier-returns`, { params: this.params(filters) });
  }

  createSupplierReturn(payload: ReturnsSupplierReturnRequest): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.post<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns`, payload);
  }

  updateSupplierReturn(id: string, payload: Partial<ReturnsSupplierReturnRequest>): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.put<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns/${id}`, payload);
  }

  shipSupplierReturn(id: string, payload: ReturnsSupplierReturnShipRequest = {}): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.post<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns/${id}/ship`, payload);
  }

  creditSupplierReturn(id: string, creditReceived: number): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.post<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns/${id}/credit`, { credit_received: creditReceived });
  }

  closeSupplierReturn(id: string): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.post<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns/${id}/close`, {});
  }

  cancelSupplierReturn(id: string): Observable<ReturnsResponse<ReturnsSupplierReturn>> {
    return this.http.post<ReturnsResponse<ReturnsSupplierReturn>>(`${this.base}/supplier-returns/${id}/cancel`, {});
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
