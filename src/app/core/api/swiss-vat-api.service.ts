import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  BezugsteuerEntry,
  CalculateSwissVatReturnPayload,
  InputTaxAdjustment,
  SssSectorRate,
  StoreBezugsteuerPayload,
  StoreInputTaxAdjustmentPayload,
  StoreSwissVatTaxCodePayload,
  SuisseTaxValidationResult,
  SuisseTaxXmlExport,
  SwissVatConfig,
  SwissVatReconciliationReport,
  SwissVatReturn,
  SwissVatTaxCode,
  UpsertSwissVatConfigPayload,
} from '../models';

/** Swiss VAT compliance endpoints (Mod 024 / #164): config, tax codes, Bezugsteuer, adjustments, returns & SuisseTax XML. */
@Service()
export class SwissVatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/swiss-vat`;

  getConfig(): Observable<ApiResponse<SwissVatConfig>> {
    return this.http.get<ApiResponse<SwissVatConfig>>(`${this.base}/config`);
  }

  updateConfig(payload: UpsertSwissVatConfigPayload): Observable<ApiResponse<SwissVatConfig>> {
    return this.http.put<ApiResponse<SwissVatConfig>>(`${this.base}/config`, payload);
  }

  getTaxCodes(): Observable<ApiResponse<SwissVatTaxCode[]>> {
    return this.http.get<ApiResponse<SwissVatTaxCode[]>>(`${this.base}/tax-codes`);
  }

  createTaxCode(payload: StoreSwissVatTaxCodePayload): Observable<ApiResponse<SwissVatTaxCode>> {
    return this.http.post<ApiResponse<SwissVatTaxCode>>(`${this.base}/tax-codes`, payload);
  }

  updateTaxCode(
    id: string,
    payload: Partial<StoreSwissVatTaxCodePayload> & { is_active?: boolean },
  ): Observable<ApiResponse<SwissVatTaxCode>> {
    return this.http.put<ApiResponse<SwissVatTaxCode>>(`${this.base}/tax-codes/${id}`, payload);
  }

  getSssSectors(): Observable<ApiResponse<SssSectorRate[]>> {
    return this.http.get<ApiResponse<SssSectorRate[]>>(`${this.base}/sss-sectors`);
  }

  getBezugsteuer(params?: {
    status?: string;
    period_from?: string;
    period_to?: string;
  }): Observable<ApiResponse<BezugsteuerEntry[]>> {
    return this.http.get<ApiResponse<BezugsteuerEntry[]>>(`${this.base}/bezugsteuer`, {
      params: toHttpParams(params ?? {}),
    });
  }

  createBezugsteuer(payload: StoreBezugsteuerPayload): Observable<ApiResponse<BezugsteuerEntry>> {
    return this.http.post<ApiResponse<BezugsteuerEntry>>(`${this.base}/bezugsteuer`, payload);
  }

  detectBezugsteuer(periodFrom: string, periodTo: string): Observable<ApiResponse<BezugsteuerEntry[]>> {
    return this.http.post<ApiResponse<BezugsteuerEntry[]>>(`${this.base}/bezugsteuer/detect`, {
      period_from: periodFrom,
      period_to: periodTo,
    });
  }

  confirmBezugsteuer(id: string): Observable<ApiResponse<BezugsteuerEntry>> {
    return this.http.post<ApiResponse<BezugsteuerEntry>>(
      `${this.base}/bezugsteuer/${id}/confirm`,
      {},
    );
  }

  excludeBezugsteuer(id: string): Observable<ApiResponse<BezugsteuerEntry>> {
    return this.http.post<ApiResponse<BezugsteuerEntry>>(
      `${this.base}/bezugsteuer/${id}/exclude`,
      {},
    );
  }

  getAdjustments(params?: { year?: number; status?: string }): Observable<ApiResponse<InputTaxAdjustment[]>> {
    return this.http.get<ApiResponse<InputTaxAdjustment[]>>(`${this.base}/adjustments`, {
      params: toHttpParams(params ?? {}),
    });
  }

  createAdjustment(payload: StoreInputTaxAdjustmentPayload): Observable<ApiResponse<InputTaxAdjustment>> {
    return this.http.post<ApiResponse<InputTaxAdjustment>>(`${this.base}/adjustments`, payload);
  }

  approveAdjustment(id: string): Observable<ApiResponse<InputTaxAdjustment>> {
    return this.http.post<ApiResponse<InputTaxAdjustment>>(
      `${this.base}/adjustments/${id}/approve`,
      {},
    );
  }

  deleteAdjustment(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/adjustments/${id}`);
  }

  getReturns(year?: number): Observable<ApiResponse<SwissVatReturn[]>> {
    return this.http.get<ApiResponse<SwissVatReturn[]>>(`${this.base}/returns`, {
      params: toHttpParams({ year }),
    });
  }

  calculateReturn(payload: CalculateSwissVatReturnPayload): Observable<ApiResponse<SwissVatReturn>> {
    return this.http.post<ApiResponse<SwissVatReturn>>(`${this.base}/returns/calculate`, payload);
  }

  getReturn(id: string): Observable<ApiResponse<SwissVatReturn>> {
    return this.http.get<ApiResponse<SwissVatReturn>>(`${this.base}/returns/${id}`);
  }

  getReconciliation(id: string): Observable<ApiResponse<SwissVatReconciliationReport>> {
    return this.http.get<ApiResponse<SwissVatReconciliationReport>>(
      `${this.base}/returns/${id}/reconciliation`,
    );
  }

  validateReturnXml(id: string): Observable<ApiResponse<SuisseTaxValidationResult>> {
    return this.http.post<ApiResponse<SuisseTaxValidationResult>>(
      `${this.base}/returns/${id}/validate`,
      {},
    );
  }

  finalizeReturn(id: string): Observable<ApiResponse<SwissVatReturn>> {
    return this.http.post<ApiResponse<SwissVatReturn>>(`${this.base}/returns/${id}/finalize`, {});
  }

  exportReturnXml(id: string): Observable<ApiResponse<SuisseTaxXmlExport>> {
    return this.http.post<ApiResponse<SuisseTaxXmlExport>>(
      `${this.base}/returns/${id}/export-xml`,
      {},
    );
  }

  getReturnExports(id: string): Observable<ApiResponse<SuisseTaxXmlExport[]>> {
    return this.http.get<ApiResponse<SuisseTaxXmlExport[]>>(`${this.base}/returns/${id}/exports`);
  }

  downloadExportXml(exportId: string): Observable<Blob> {
    return this.http.get(`${this.base}/exports/${exportId}/download`, { responseType: 'blob' });
  }
}
