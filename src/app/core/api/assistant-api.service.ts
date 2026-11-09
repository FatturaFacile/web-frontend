import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AskAssistantRequest,
  AssistantAnswer,
  AssistantCatalogueEntry,
  AssistantLogQueryParams,
  AssistantLogResource,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class AssistantApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/assistant`;

  /**
   * Ask the AI assistant a natural language question.
   */
  ask(payload: AskAssistantRequest): Observable<ApiResponse<AssistantAnswer>> {
    return this.http.post<ApiResponse<AssistantAnswer>>(`${this.baseUrl}/ask`, payload);
  }

  /**
   * List the available assistant catalogue entries for the current user's role.
   */
  getCatalogue(): Observable<ApiResponse<AssistantCatalogueEntry[]>> {
    return this.http.get<ApiResponse<AssistantCatalogueEntry[]>>(`${this.baseUrl}/catalogue`);
  }

  /**
   * List logged questions and audit trail.
   */
  getLogs(params?: AssistantLogQueryParams): Observable<ApiResponse<AssistantLogResource[]>> {
    return this.http.get<ApiResponse<AssistantLogResource[]>>(`${this.baseUrl}/logs`, {
      params: params ? toHttpParams(params as Record<string, unknown>) : undefined,
    });
  }
}
