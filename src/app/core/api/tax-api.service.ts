import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  EnasarcoStatus,
  FiscalErrorCode,
  StampDutyQuarterlyReport,
  TaxPreviewRequest,
  TaxPreviewResult,
  WithholdingReport,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

const FISCAL_ERROR_CODES: readonly FiscalErrorCode[] = [
  'forfettario_incompatible',
  'enasarco_rate_not_configured',
  'split_payment_incompatible',
  'split_payment_requires_vat',
  'invalid_natura',
  'amount_out_of_range',
];

/** Fiscal-rule code of a 422 response (`{ code, errors }`), or `null` for any other error. */
export function fiscalErrorCode(err: unknown): FiscalErrorCode | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 422) {
    return null;
  }
  const code = (err.error as { code?: unknown } | null)?.code;
  return FISCAL_ERROR_CODES.find((c) => c === code) ?? null;
}

/** Italian fiscal preview and tax reports (issue #286). Amounts are decimal strings computed by the backend. */
@Service()
export class TaxApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/tax`;

  preview(payload: TaxPreviewRequest): Observable<ApiResponse<TaxPreviewResult>> {
    return this.http.post<ApiResponse<TaxPreviewResult>>(`${this.url}/preview`, payload);
  }

  getStampDutyQuarterly(
    year: number,
    quarter: number,
  ): Observable<ApiResponse<StampDutyQuarterlyReport>> {
    return this.http.get<ApiResponse<StampDutyQuarterlyReport>>(
      `${this.url}/stamp-duty/quarterly`,
      {
        params: toHttpParams({ year, quarter }),
      },
    );
  }

  downloadStampDutyQuarterlyCsv(year: number, quarter: number): Observable<Blob> {
    return this.http.get(`${this.url}/stamp-duty/quarterly`, {
      params: toHttpParams({ year, quarter, format: 'csv' }),
      responseType: 'blob',
    });
  }

  getWithholdingsReport(year: number): Observable<ApiResponse<WithholdingReport>> {
    return this.http.get<ApiResponse<WithholdingReport>>(`${this.url}/withholdings/report`, {
      params: toHttpParams({ year }),
    });
  }

  downloadWithholdingsReportCsv(year: number): Observable<Blob> {
    return this.http.get(`${this.url}/withholdings/report`, {
      params: toHttpParams({ year, format: 'csv' }),
      responseType: 'blob',
    });
  }

  getEnasarcoStatus(contactId: string, year: number): Observable<ApiResponse<EnasarcoStatus>> {
    return this.http.get<ApiResponse<EnasarcoStatus>>(`${this.url}/enasarco/status`, {
      params: toHttpParams({ contact_id: contactId, year }),
    });
  }
}
