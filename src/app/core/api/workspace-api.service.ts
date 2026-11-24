import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AuthorizeWorkspaceRequest,
  PaginatedResponse,
  WorkspaceAuthorizeResponse,
  WorkspaceCallbackRequest,
  WorkspaceConnectionResource,
  WorkspaceItemQueryParams,
  WorkspaceItemResource,
  WorkspaceSyncResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class WorkspaceApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/workspace`;

  /**
   * List the active external workspace connections of the caller.
   */
  getConnections(): Observable<ApiResponse<WorkspaceConnectionResource[]>> {
    return this.http.get<ApiResponse<WorkspaceConnectionResource[]>>(`${this.baseUrl}/connections`);
  }

  /**
   * Start OAuth connection flow for provider (google | microsoft).
   */
  authorize(
    provider: string,
    payload: AuthorizeWorkspaceRequest
  ): Observable<ApiResponse<WorkspaceAuthorizeResponse>> {
    return this.http.post<ApiResponse<WorkspaceAuthorizeResponse>>(
      `${this.baseUrl}/connections/${provider}/authorize`,
      payload
    );
  }

  /**
   * Complete connection with OAuth authorization code and state token.
   */
  callback(provider: string, payload: WorkspaceCallbackRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      `${this.baseUrl}/connections/${provider}/callback`,
      payload
    );
  }

  /**
   * Trigger immediate fetch of calendar events and message metadata.
   */
  sync(id: string): Observable<ApiResponse<WorkspaceSyncResponse>> {
    return this.http.post<ApiResponse<WorkspaceSyncResponse>>(
      `${this.baseUrl}/connections/${id}/sync`,
      {}
    );
  }

  /**
   * Revoke workspace connection and erase tokens and synced data.
   */
  revoke(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/connections/${id}`);
  }

  /**
   * List synced calendar events and message metadata.
   */
  getItems(params?: WorkspaceItemQueryParams): Observable<PaginatedResponse<WorkspaceItemResource>> {
    return this.http.get<PaginatedResponse<WorkspaceItemResource>>(`${this.baseUrl}/items`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
