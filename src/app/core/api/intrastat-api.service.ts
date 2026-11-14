import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  IntrastatCodeList,
  IntrastatDeclaration,
  IntrastatDeclarationLine,
  IntrastatDeclarationRequest,
  IntrastatDeclarationSummary,
  IntrastatExportRequest,
  IntrastatGenerateRequest,
  IntrastatLineRequest,
  IntrastatPeriodicityThresholds,
  IntrastatProductProfile,
  IntrastatProductProfileRequest,
  IntrastatSubmitRequest,
  IntrastatValidationResponse,
  LaravelPaginationMeta,
  PaginatedResponse,
  QueryFilterParams,
} from '../models';

@Service()
export class IntrastatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/intrastat`;

  /** Grid list: page-level filters (flow, year, status) plus the grid query (paging, sort, column filters, grid_values). */
  getDeclarations(
    params: QueryFilterParams & { flow?: string; year?: number; status?: string } = {},
  ): Observable<PaginatedResponse<IntrastatDeclaration> & { summary?: IntrastatDeclarationSummary }> {
    return this.http
      .get<ApiResponse<IntrastatDeclaration[]> & { meta?: LaravelPaginationMeta; summary?: IntrastatDeclarationSummary }>(
        `${this.base}/declarations`,
        { params: toHttpParams(params) },
      )
      .pipe(map((res) => ({ ...res, meta: res.meta ?? plainListMeta(res.data, params) })));
  }

  getDeclaration(id: string): Observable<ApiResponse<IntrastatDeclaration>> {
    return this.http.get<ApiResponse<IntrastatDeclaration>>(`${this.base}/declarations/${id}`);
  }

  createDeclaration(payload: IntrastatDeclarationRequest): Observable<ApiResponse<IntrastatDeclaration>> {
    return this.http.post<ApiResponse<IntrastatDeclaration>>(`${this.base}/declarations`, payload);
  }

  generateDeclaration(payload: IntrastatGenerateRequest): Observable<ApiResponse<IntrastatDeclaration>> {
    return this.http.post<ApiResponse<IntrastatDeclaration>>(`${this.base}/declarations/generate`, payload);
  }

  updateDeclaration(
    id: string,
    payload: Partial<IntrastatDeclarationRequest>,
  ): Observable<ApiResponse<IntrastatDeclaration>> {
    return this.http.put<ApiResponse<IntrastatDeclaration>>(`${this.base}/declarations/${id}`, payload);
  }

  deleteDeclaration(id: string): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/declarations/${id}`);
  }

  validateDeclaration(id: string): Observable<ApiResponse<IntrastatValidationResponse>> {
    return this.http.post<ApiResponse<IntrastatValidationResponse>>(
      `${this.base}/declarations/${id}/validate`,
      {},
    );
  }

  submitDeclaration(
    id: string,
    payload: IntrastatSubmitRequest,
  ): Observable<ApiResponse<IntrastatDeclaration>> {
    return this.http.post<ApiResponse<IntrastatDeclaration>>(
      `${this.base}/declarations/${id}/submit`,
      payload,
    );
  }

  addLine(
    declarationId: string,
    payload: IntrastatLineRequest,
  ): Observable<ApiResponse<IntrastatDeclarationLine>> {
    return this.http.post<ApiResponse<IntrastatDeclarationLine>>(
      `${this.base}/declarations/${declarationId}/lines`,
      payload,
    );
  }

  updateLine(
    declarationId: string,
    lineId: string,
    payload: Partial<IntrastatLineRequest>,
  ): Observable<ApiResponse<IntrastatDeclarationLine>> {
    return this.http.put<ApiResponse<IntrastatDeclarationLine>>(
      `${this.base}/declarations/${declarationId}/lines/${lineId}`,
      payload,
    );
  }

  deleteLine(declarationId: string, lineId: string): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(
      `${this.base}/declarations/${declarationId}/lines/${lineId}`,
    );
  }

  /** The API answers with the telematic file as plain text; its name is in the Content-Disposition header. */
  exportDeclaration(payload: IntrastatExportRequest): Observable<{ file_name: string; content: string }> {
    return this.http.post(`${this.base}/exports`, payload, { observe: 'response', responseType: 'text' }).pipe(
      map((res) => {
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const match = /filename="?([^";]+)"?/i.exec(disposition);
        return { content: res.body ?? '', file_name: match?.[1] ?? 'intrastat.txt' };
      }),
    );
  }

  getPeriodicity(year?: number): Observable<ApiResponse<IntrastatPeriodicityThresholds>> {
    let httpParams = new HttpParams();
    if (year) httpParams = httpParams.set('year', year.toString());
    return this.http.get<ApiResponse<IntrastatPeriodicityThresholds>>(`${this.base}/periodicity`, {
      params: httpParams,
    });
  }

  /** Code lists of the INTRA forms (nature of transaction, transport, delivery terms). */
  getCodes(): Observable<ApiResponse<IntrastatCodeList>> {
    return this.http.get<ApiResponse<IntrastatCodeList>>(`${this.base}/codes`);
  }

  getProductProfiles(params: QueryFilterParams = {}): Observable<PaginatedResponse<IntrastatProductProfile>> {
    return this.http
      .get<ApiResponse<IntrastatProductProfile[]> & { meta?: LaravelPaginationMeta }>(`${this.base}/product-profiles`, {
        params: toHttpParams(params),
      })
      .pipe(map((res) => ({ ...res, meta: res.meta ?? plainListMeta(res.data, params) })));
  }

  setProductProfile(
    productId: string,
    payload: IntrastatProductProfileRequest,
  ): Observable<ApiResponse<IntrastatProductProfile>> {
    return this.http.put<ApiResponse<IntrastatProductProfile>>(
      `${this.base}/product-profiles/${productId}`,
      payload,
    );
  }

  deleteProductProfile(productId: string): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/product-profiles/${productId}`);
  }
}

/** The `grid_values` answer is a plain list without meta: give it one so every response is a PaginatedResponse. */
function plainListMeta(items: unknown[] | undefined, params: QueryFilterParams): LaravelPaginationMeta {
  const count = items?.length ?? 0;
  return { current_page: params.page ?? 1, from: null, to: null, last_page: 1, per_page: count, total: count };
}
