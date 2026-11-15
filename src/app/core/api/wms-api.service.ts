import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { WmsDashboard, WmsDashboardFilters, WmsResponse } from '../models';

/** The warehouse dashboard; the other WMS screens are declarative resource pages over the same API. */
@Service()
export class WmsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/wms`;

  getDashboard(filters?: WmsDashboardFilters): Observable<WmsResponse<WmsDashboard>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<WmsResponse<WmsDashboard>>(`${this.base}/dashboard`, { params });
  }
}
