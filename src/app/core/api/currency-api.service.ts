import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { handleErrorsLocally } from '../http/error-handling.context';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  CurrencyExportFormat,
  CurrencyExposure,
  CurrencyProvider,
  CurrencyRate,
  CurrencyRateFilters,
  CurrencyRatePayload,
  CurrencyRateResolveQuery,
  CurrencySettings,
  CurrencySettingsPayload,
  CurrencySyncResult,
  CurrencySyncRun,
  FxRevaluationFilters,
  FxRevaluationRun,
  FxRevaluationSimulatePayload,
  PaginatedResponse,
  ResolvedCurrencyRate,
} from '../models';

/**
 * Multi-currency engine (Mod 003): exchange rates, ECB / SNB / ESTV synchronisation, the currency settings, the exposure
 * and the FX revaluation. Rates and amounts travel as decimal strings. 409 and 422 answers are rendered by the callers.
 */
@Service()
export class CurrencyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  private readonly currencies = `${this.base}/currencies`;
  private readonly revaluations = `${this.base}/accounting/fx-revaluations`;

  // --- Rates ---

  listRates(filters: CurrencyRateFilters = {}): Observable<PaginatedResponse<CurrencyRate>> {
    return this.http.get<PaginatedResponse<CurrencyRate>>(`${this.currencies}/rates`, {
      params: toHttpParams(filters),
    });
  }

  /** The rate a document of `date` takes. A 422 `exchange_rate_missing` is left to the caller (field error). */
  resolveRate(query: CurrencyRateResolveQuery): Observable<ApiResponse<ResolvedCurrencyRate>> {
    return this.http.get<ApiResponse<ResolvedCurrencyRate>>(`${this.currencies}/rates/resolve`, {
      params: toHttpParams(query),
    });
  }

  createRate(payload: CurrencyRatePayload): Observable<ApiResponse<CurrencyRate>> {
    return this.http.post<ApiResponse<CurrencyRate>>(`${this.currencies}/rates`, payload);
  }

  /** Audit export (the rates used in the period) as a file. */
  exportRates(
    range: { from?: string; to?: string },
    format: CurrencyExportFormat,
  ): Observable<Blob> {
    return this.http.get(`${this.currencies}/rates/export`, {
      params: toHttpParams({ ...range, format }),
      responseType: 'blob',
    });
  }

  // --- Synchronisation ---

  /** Queues a synchronisation (202); 409 means one is already running. */
  syncRates(providers?: CurrencyProvider[]): Observable<ApiResponse<CurrencySyncResult>> {
    return this.http.post<ApiResponse<CurrencySyncResult>>(
      `${this.currencies}/rates/sync`,
      providers && providers.length > 0 ? { providers } : {},
      { context: handleErrorsLocally(409) },
    );
  }

  listSyncRuns(perPage = 20): Observable<PaginatedResponse<CurrencySyncRun>> {
    return this.http.get<PaginatedResponse<CurrencySyncRun>>(`${this.currencies}/sync-runs`, {
      params: toHttpParams({ per_page: perPage }),
    });
  }

  // --- Exposure and settings ---

  getExposure(asOf?: string): Observable<ApiResponse<CurrencyExposure>> {
    return this.http.get<ApiResponse<CurrencyExposure>>(`${this.currencies}/exposure`, {
      params: toHttpParams({ as_of: asOf }),
    });
  }

  getSettings(): Observable<ApiResponse<CurrencySettings>> {
    return this.http.get<ApiResponse<CurrencySettings>>(`${this.base}/settings/currencies`);
  }

  /** 409 = a currency to deactivate still has open items; the message is shown by the caller. */
  updateSettings(payload: CurrencySettingsPayload): Observable<ApiResponse<CurrencySettings>> {
    return this.http.put<ApiResponse<CurrencySettings>>(
      `${this.base}/settings/currencies`,
      payload,
      {
        context: handleErrorsLocally(409),
      },
    );
  }

  // --- FX revaluation ---

  listRevaluations(
    filters: FxRevaluationFilters = {},
  ): Observable<PaginatedResponse<FxRevaluationRun>> {
    return this.http.get<PaginatedResponse<FxRevaluationRun>>(this.revaluations, {
      params: toHttpParams(filters),
    });
  }

  getRevaluation(id: string): Observable<ApiResponse<FxRevaluationRun>> {
    return this.http.get<ApiResponse<FxRevaluationRun>>(`${this.revaluations}/${id}`);
  }

  simulateRevaluation(
    payload: FxRevaluationSimulatePayload,
  ): Observable<ApiResponse<FxRevaluationRun>> {
    return this.http.post<ApiResponse<FxRevaluationRun>>(this.revaluations, payload);
  }

  /** Posts the journal entry. The same `idempotencyKey` replays the stored answer; another key on a posted run is a 409. */
  postRevaluation(id: string, idempotencyKey: string): Observable<ApiResponse<FxRevaluationRun>> {
    return this.http.post<ApiResponse<FxRevaluationRun>>(
      `${this.revaluations}/${id}/post`,
      {},
      {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
        context: handleErrorsLocally(409),
      },
    );
  }

  reverseRevaluation(id: string): Observable<ApiResponse<FxRevaluationRun>> {
    return this.http.post<ApiResponse<FxRevaluationRun>>(
      `${this.revaluations}/${id}/reverse`,
      {},
      { context: handleErrorsLocally(409) },
    );
  }
}
