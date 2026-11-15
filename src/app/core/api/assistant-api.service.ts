import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResponse,
  AskAssistantRequest,
  AssistantAnswer,
  AssistantCatalogueEntry,
  AssistantFeedbackRating,
  AssistantThread,
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
  getLogs(params?: AssistantLogQueryParams): Observable<PaginatedResponse<AssistantLogResource>> {
    return this.http.get<PaginatedResponse<AssistantLogResource>>(`${this.baseUrl}/logs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** The conversations of the caller, most recently active first. */
  getThreads(): Observable<ApiResponse<AssistantThread[]>> {
    return this.http.get<ApiResponse<AssistantThread[]>>(`${this.baseUrl}/threads`);
  }

  /** One conversation with its questions, oldest first. */
  getThread(id: string): Observable<ApiResponse<AssistantThread>> {
    return this.http.get<ApiResponse<AssistantThread>>(`${this.baseUrl}/threads/${id}`);
  }

  deleteThread(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/threads/${id}`);
  }

  /** Rates an own answer (`log_id` of the answer); a new rating replaces the previous one. */
  sendFeedback(logId: string, rating: AssistantFeedbackRating, comment?: string | null): Observable<ApiResponse<AssistantLogResource>> {
    return this.http.post<ApiResponse<AssistantLogResource>>(`${this.baseUrl}/logs/${logId}/feedback`, { rating, comment: comment ?? null });
  }
}
