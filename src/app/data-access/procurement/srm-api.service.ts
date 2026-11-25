import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toHttpParams } from '@core/http/laravel-http.utils';
import { ApiResponse } from '@core/models';
import {
  DocumentFlow,
  DocumentFlowEntryType,
  SrmDashboard,
  SrmPeriod,
  SupplierRating,
} from '@domain/procurement/srm.models';
import { environment } from '@env';
import { map, Observable } from 'rxjs';

/** Typed HTTP gateway of the purchasing / SRM overview, composite supplier ratings and document flow. */
@Injectable({ providedIn: 'root' })
export class SrmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/procurement`;

  dashboard(period: SrmPeriod = {}): Observable<SrmDashboard> {
    return this.http
      .get<ApiResponse<SrmDashboard>>(`${this.base}/srm/dashboard`, {
        params: toHttpParams({ ...period }),
      })
      .pipe(map((res) => res.data));
  }

  scorecards(period: SrmPeriod = {}): Observable<SupplierRating[]> {
    return this.http
      .get<ApiResponse<SupplierRating[]>>(`${this.base}/srm/scorecards`, {
        params: toHttpParams({ ...period }),
      })
      .pipe(map((res) => res.data ?? []));
  }

  supplierScorecard(supplierId: string, period: SrmPeriod = {}): Observable<SupplierRating> {
    return this.http
      .get<ApiResponse<SupplierRating>>(`${this.base}/suppliers/${supplierId}/srm-scorecard`, {
        params: toHttpParams({ ...period }),
      })
      .pipe(map((res) => res.data));
  }

  documentFlow(type: DocumentFlowEntryType, id: string): Observable<DocumentFlow> {
    return this.http
      .get<ApiResponse<DocumentFlow>>(`${this.base}/document-flow/${type}/${id}`)
      .pipe(map((res) => res.data));
  }
}
