import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  IntrastatCodeList,
  IntrastatDeclaration,
  IntrastatDeclarationLine,
  IntrastatDeclarationRequest,
  IntrastatExportRequest,
  IntrastatGenerateRequest,
  IntrastatLineRequest,
  IntrastatPeriodicityThresholds,
  IntrastatProductProfile,
  IntrastatProductProfileRequest,
  IntrastatSubmitRequest,
  IntrastatValidationResponse,
} from '../models';

@Service()
export class IntrastatApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/intrastat`;

  getDeclarations(params?: {
    flow?: string;
    year?: number;
    status?: string;
    page?: number;
    per_page?: number;
  }): Observable<ApiResponse<IntrastatDeclaration[]>> {
    let httpParams = new HttpParams();
    if (params?.flow) httpParams = httpParams.set('flow', params.flow);
    if (params?.year) httpParams = httpParams.set('year', params.year.toString());
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());

    return this.http.get<ApiResponse<IntrastatDeclaration[]>>(`${this.base}/declarations`, {
      params: httpParams,
    });
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

  exportDeclaration(payload: IntrastatExportRequest): Observable<ApiResponse<{ file_name: string; content?: string }>> {
    return this.http.post<ApiResponse<{ file_name: string; content?: string }>>(
      `${this.base}/exports`,
      payload,
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

  getProductProfiles(): Observable<ApiResponse<IntrastatProductProfile[]>> {
    return this.http.get<ApiResponse<IntrastatProductProfile[]>>(`${this.base}/product-profiles`);
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
