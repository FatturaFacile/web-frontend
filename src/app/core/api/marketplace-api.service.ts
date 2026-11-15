import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  MarketplaceCategory,
  MarketplaceConfigureRequest,
  MarketplaceConnector,
  MarketplaceHealthCheck,
  MarketplaceInstallation,
  MarketplaceInstallationStatus,
  MarketplaceInstallRequest,
  MarketplaceOverview,
  MarketplaceResponse,
  MarketplaceRunStatus,
  MarketplaceSyncRun,
} from '../models';

@Service()
export class MarketplaceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/marketplace`;

  getOverview(): Observable<MarketplaceResponse<MarketplaceOverview>> {
    return this.http.get<MarketplaceResponse<MarketplaceOverview>>(`${this.base}/overview`);
  }

  // Catalog
  getConnectors(filters?: { category?: MarketplaceCategory; search?: string }): Observable<MarketplaceResponse<MarketplaceConnector[]>> {
    return this.http.get<MarketplaceResponse<MarketplaceConnector[]>>(`${this.base}/connectors`, { params: this.params(filters) });
  }

  getConnector(key: string): Observable<MarketplaceResponse<MarketplaceConnector>> {
    return this.http.get<MarketplaceResponse<MarketplaceConnector>>(`${this.base}/connectors/${key}`);
  }

  // Installations and their lifecycle
  getInstallations(filters?: { status?: MarketplaceInstallationStatus; connector_key?: string; per_page?: number }): Observable<MarketplaceResponse<MarketplaceInstallation[]>> {
    return this.http.get<MarketplaceResponse<MarketplaceInstallation[]>>(`${this.base}/installations`, { params: this.params(filters) });
  }

  getInstallation(id: string): Observable<MarketplaceResponse<MarketplaceInstallation>> {
    return this.http.get<MarketplaceResponse<MarketplaceInstallation>>(`${this.base}/installations/${id}`);
  }

  install(payload: MarketplaceInstallRequest): Observable<MarketplaceResponse<MarketplaceInstallation>> {
    return this.http.post<MarketplaceResponse<MarketplaceInstallation>>(`${this.base}/installations`, payload);
  }

  configure(id: string, payload: MarketplaceConfigureRequest): Observable<MarketplaceResponse<MarketplaceInstallation>> {
    return this.http.put<MarketplaceResponse<MarketplaceInstallation>>(`${this.base}/installations/${id}/configuration`, payload);
  }

  enable(id: string): Observable<MarketplaceResponse<MarketplaceInstallation>> {
    return this.http.post<MarketplaceResponse<MarketplaceInstallation>>(`${this.base}/installations/${id}/enable`, {});
  }

  disable(id: string): Observable<MarketplaceResponse<MarketplaceInstallation>> {
    return this.http.post<MarketplaceResponse<MarketplaceInstallation>>(`${this.base}/installations/${id}/disable`, {});
  }

  upgrade(id: string, grantedScopes: string[] = []): Observable<MarketplaceResponse<MarketplaceInstallation>> {
    return this.http.post<MarketplaceResponse<MarketplaceInstallation>>(`${this.base}/installations/${id}/upgrade`, { granted_scopes: grantedScopes });
  }

  uninstall(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/installations/${id}`);
  }

  // Health checks
  getHealthChecks(id: string): Observable<MarketplaceResponse<MarketplaceHealthCheck[]>> {
    return this.http.get<MarketplaceResponse<MarketplaceHealthCheck[]>>(`${this.base}/installations/${id}/health-checks`);
  }

  runHealthCheck(id: string): Observable<MarketplaceResponse<MarketplaceHealthCheck>> {
    return this.http.post<MarketplaceResponse<MarketplaceHealthCheck>>(`${this.base}/installations/${id}/health-checks`, {});
  }

  // Sync runs
  getSyncRuns(filters?: { status?: MarketplaceRunStatus; installation_id?: string; per_page?: number }): Observable<MarketplaceResponse<MarketplaceSyncRun[]>> {
    return this.http.get<MarketplaceResponse<MarketplaceSyncRun[]>>(`${this.base}/sync-runs`, { params: this.params(filters) });
  }

  getInstallationRuns(id: string, filters?: { status?: MarketplaceRunStatus }): Observable<MarketplaceResponse<MarketplaceSyncRun[]>> {
    return this.http.get<MarketplaceResponse<MarketplaceSyncRun[]>>(`${this.base}/installations/${id}/sync-runs`, { params: this.params(filters) });
  }

  runSync(id: string, resource: string): Observable<MarketplaceResponse<MarketplaceSyncRun>> {
    return this.http.post<MarketplaceResponse<MarketplaceSyncRun>>(`${this.base}/installations/${id}/sync-runs`, { resource });
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }
}
