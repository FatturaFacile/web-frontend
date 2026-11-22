import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../../core/http/laravel-http.utils';
import {
  Envelope,
  FinancialSnapshot,
  ManualEtcPayload,
  OverheadAllocationPayload,
  OverheadAllocationResult,
  Scurve,
  ScurveFilters,
  Waterfall,
  WbsBreakdown,
} from './project-evm.models';

/** HTTP access to the profitability and earned value endpoints of the projects API (Mod 082). */
@Service()
export class ProjectEvmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  /** Recomputes the financial snapshot of the project (and of its WBS nodes) and returns the project one. */
  compute(projectId: string): Observable<Envelope<FinancialSnapshot>> {
    return this.http.post<Envelope<FinancialSnapshot>>(`${this.base}/${projectId}/evm/compute`, {});
  }

  wbsBreakdown(projectId: string): Observable<Envelope<WbsBreakdown>> {
    return this.http.get<Envelope<WbsBreakdown>>(`${this.base}/${projectId}/evm/wbs-breakdown`);
  }

  waterfall(projectId: string): Observable<Envelope<Waterfall>> {
    return this.http.get<Envelope<Waterfall>>(`${this.base}/${projectId}/evm/waterfall`);
  }

  scurve(filters: ScurveFilters): Observable<Envelope<Scurve>> {
    let params: HttpParams = toHttpParams({ granularity: filters.granularity, from: filters.from, to: filters.to });

    for (const id of filters.projectIds ?? []) {
      params = params.append('project_ids[]', id);
    }

    return this.http.get<Envelope<Scurve>>(`${this.base}/evm/scurve`, { params });
  }

  /** Sets the manual bottom-up ETC of the project or of a WBS node; a null estimate restores the BAC / CPI forecast. */
  setManualEtc(projectId: string, payload: ManualEtcPayload): Observable<Envelope<FinancialSnapshot>> {
    return this.http.put<Envelope<FinancialSnapshot>>(`${this.base}/${projectId}/evm/etc`, payload);
  }

  allocateOverhead(payload: OverheadAllocationPayload): Observable<Envelope<OverheadAllocationResult>> {
    return this.http.post<Envelope<OverheadAllocationResult>>(`${this.base}/evm/overhead-allocations`, payload);
  }
}
