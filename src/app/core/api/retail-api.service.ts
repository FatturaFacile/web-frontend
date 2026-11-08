import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CommercialDocumentResource,
  DailyCorrispettivoResource,
  PaginatedResponse,
  QueryFilterParams,
  RetailSession,
  StoreCommercialDocumentPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class RetailApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/fiscal-retail`;

  getCommercialDocuments(params?: QueryFilterParams): Observable<PaginatedResponse<CommercialDocumentResource>> {
    return this.http.get<PaginatedResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCommercialDocument(id: string): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.get<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents/${id}`);
  }

  createCommercialDocument(payload: StoreCommercialDocumentPayload): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.post<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents`, payload);
  }

  voidCommercialDocument(id: string): Observable<ApiResponse<CommercialDocumentResource>> {
    return this.http.post<ApiResponse<CommercialDocumentResource>>(`${this.base}/commercial-documents/${id}/void`, {});
  }

  getDailyCorrispettivi(date: string): Observable<ApiResponse<DailyCorrispettivoResource>> {
    return this.http.get<ApiResponse<DailyCorrispettivoResource>>(`${this.base}/corrispettivi/daily/${date}`);
  }

  // Backward compatible
  getSessions(): Observable<ApiResponse<RetailSession[]>> {
    return this.http.get<ApiResponse<RetailSession[]>>(`${environment.apiBaseUrl}/retail/sessions`);
  }
}
