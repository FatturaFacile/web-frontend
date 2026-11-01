import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ConstructionProgressBilling,
  ConstructionProgressBillingPayload,
  ConstructionSite,
} from '../models';

@Service()
export class ConstructionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/construction`;

  getSites(): Observable<ApiResponse<ConstructionSite[]>> {
    return this.http.get<ApiResponse<ConstructionSite[]>>(`${this.base}/sites`);
  }

  getProgressBillings(): Observable<ApiResponse<ConstructionProgressBilling[]>> {
    return this.http.get<ApiResponse<ConstructionProgressBilling[]>>(`${this.base}/sal`);
  }

  createProgressBilling(
    payload: ConstructionProgressBillingPayload,
  ): Observable<ApiResponse<ConstructionProgressBilling>> {
    return this.http.post<ApiResponse<ConstructionProgressBilling>>(`${this.base}/sal`, payload);
  }
}
