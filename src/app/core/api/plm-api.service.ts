import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  PlmChangeOrder,
  PlmChangeOrderFilters,
  PlmChangeOrderRequest,
  PlmDecisionRequest,
  PlmItemRevision,
  PlmItemRevisionFilters,
  PlmItemRevisionRequest,
  PlmOption,
  PlmResponse,
} from '../models';

@Service()
export class PlmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/plm`;

  // Change orders
  getChangeOrders(filters?: PlmChangeOrderFilters): Observable<PlmResponse<PlmChangeOrder[]>> {
    return this.http.get<PlmResponse<PlmChangeOrder[]>>(`${this.base}/change-orders`, { params: this.params(filters) });
  }

  getChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.get<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}`);
  }

  createChangeOrder(payload: PlmChangeOrderRequest): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders`, payload);
  }

  updateChangeOrder(id: string, payload: Partial<PlmChangeOrderRequest>): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.put<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}`, payload);
  }

  deleteChangeOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/change-orders/${id}`);
  }

  submitChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/submit`, {});
  }

  decideChangeOrder(id: string, payload: PlmDecisionRequest): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/decide`, payload);
  }

  cancelChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/cancel`, {});
  }

  implementChangeOrder(id: string): Observable<PlmResponse<PlmChangeOrder>> {
    return this.http.post<PlmResponse<PlmChangeOrder>>(`${this.base}/change-orders/${id}/implement`, {});
  }

  // Item revisions
  getRevisions(filters?: PlmItemRevisionFilters): Observable<PlmResponse<PlmItemRevision[]>> {
    return this.http.get<PlmResponse<PlmItemRevision[]>>(`${this.base}/revisions`, { params: this.params(filters) });
  }

  /** A single item revision. */
  getRevision(id: string): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.get<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}`);
  }

  createRevision(payload: PlmItemRevisionRequest): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.post<PlmResponse<PlmItemRevision>>(`${this.base}/revisions`, payload);
  }

  updateRevision(id: string, payload: Partial<PlmItemRevisionRequest>): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.put<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}`, payload);
  }

  deleteRevision(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/revisions/${id}`);
  }

  releaseRevision(id: string): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.post<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}/release`, {});
  }

  obsoleteRevision(id: string): Observable<PlmResponse<PlmItemRevision>> {
    return this.http.post<PlmResponse<PlmItemRevision>>(`${this.base}/revisions/${id}/obsolete`, {});
  }

  // Lookups of the manufacturing module the forms pick from
  getItemOptions(): Observable<PlmOption[]> {
    return this.http
      .get<{ data: { id: string; item_code: string; name: string }[] }>(`${environment.apiBaseUrl}/manufacturing/items`, { params: this.params({ per_page: 100 }) })
      .pipe(map((response) => response.data.map((item) => ({ id: item.id, label: `${item.item_code} - ${item.name}` }))));
  }

  getBomOptions(): Observable<PlmOption[]> {
    return this.http
      .get<{ data: { id: string; bom_number: string; name: string; revision: string }[] }>(`${environment.apiBaseUrl}/manufacturing/boms`, { params: this.params({ per_page: 100 }) })
      .pipe(map((response) => response.data.map((bom) => ({ id: bom.id, label: `${bom.bom_number} (${bom.revision}) - ${bom.name}` }))));
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
