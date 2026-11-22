import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AllocationDriver,
  AnalyticalCenter,
  AnalyticalCenterNode,
  AnalyticalCenterPayload,
  AnalyticalEntry,
  AnalyticalEntryPayload,
  AnalyticalPage,
  AnalyticalResponse,
  ApportionmentRun,
  ApportionmentSchedule,
  ContributionMarginReport,
  DerivationRule,
  DerivationRulePayload,
  DerivationTestPayload,
  DerivationTestResult,
  DirectVsApportionedReport,
  DriverValue,
  DriverValueInput,
  ReportFilters,
  SchedulePayload,
} from '../models';

function toParams(values: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  }
  return params;
}

/** Endpoints of the industrial and analytical cost accounting module (Mod 018). */
@Service()
export class AnalyticalAccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/analytical`;

  // --- Centers ---

  getCenterTree(activeOnly = false): Observable<AnalyticalResponse<AnalyticalCenterNode[]>> {
    return this.http.get<AnalyticalResponse<AnalyticalCenterNode[]>>(`${this.base}/centers/tree`, {
      params: toParams({ active_only: activeOnly }),
    });
  }

  getCenterList(activeOnly = false): Observable<AnalyticalResponse<AnalyticalCenter[]>> {
    return this.http.get<AnalyticalResponse<AnalyticalCenter[]>>(`${this.base}/centers/flat`, {
      params: toParams({ active_only: activeOnly }),
    });
  }

  createCenter(payload: AnalyticalCenterPayload): Observable<AnalyticalResponse<AnalyticalCenter>> {
    return this.http.post<AnalyticalResponse<AnalyticalCenter>>(`${this.base}/centers`, payload);
  }

  updateCenter(
    id: string,
    payload: Partial<AnalyticalCenterPayload>,
  ): Observable<AnalyticalResponse<AnalyticalCenter>> {
    return this.http.put<AnalyticalResponse<AnalyticalCenter>>(
      `${this.base}/centers/${id}`,
      payload,
    );
  }

  deactivateCenter(
    id: string,
    withDescendants = false,
  ): Observable<AnalyticalResponse<AnalyticalCenter>> {
    return this.http.post<AnalyticalResponse<AnalyticalCenter>>(
      `${this.base}/centers/${id}/deactivate`,
      { with_descendants: withDescendants },
    );
  }

  deleteCenter(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/centers/${id}`);
  }

  // --- Derivation rules ---

  getRules(): Observable<AnalyticalPage<DerivationRule>> {
    return this.http.get<AnalyticalPage<DerivationRule>>(`${this.base}/derivation-rules`, {
      params: toParams({ per_page: 100 }),
    });
  }

  createRule(payload: DerivationRulePayload): Observable<AnalyticalResponse<DerivationRule>> {
    return this.http.post<AnalyticalResponse<DerivationRule>>(
      `${this.base}/derivation-rules`,
      payload,
    );
  }

  updateRule(
    id: string,
    payload: DerivationRulePayload,
  ): Observable<AnalyticalResponse<DerivationRule>> {
    return this.http.put<AnalyticalResponse<DerivationRule>>(
      `${this.base}/derivation-rules/${id}`,
      payload,
    );
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/derivation-rules/${id}`);
  }

  testRules(payload: DerivationTestPayload): Observable<AnalyticalResponse<DerivationTestResult>> {
    return this.http.post<AnalyticalResponse<DerivationTestResult>>(
      `${this.base}/derivation-rules/test`,
      payload,
    );
  }

  // --- Drivers ---

  getDrivers(): Observable<AnalyticalPage<AllocationDriver>> {
    return this.http.get<AnalyticalPage<AllocationDriver>>(`${this.base}/drivers`, {
      params: toParams({ per_page: 100 }),
    });
  }

  getDriverValues(driverId: string, periodKey?: string): Observable<AnalyticalPage<DriverValue>> {
    return this.http.get<AnalyticalPage<DriverValue>>(`${this.base}/drivers/${driverId}/values`, {
      params: toParams({ period_key: periodKey, per_page: 100 }),
    });
  }

  saveDriverValues(
    driverId: string,
    periodKey: string,
    values: DriverValueInput[],
  ): Observable<AnalyticalPage<DriverValue>> {
    return this.http.put<AnalyticalPage<DriverValue>>(`${this.base}/drivers/${driverId}/values`, {
      period_key: periodKey,
      values,
    });
  }

  // --- Ledger ---

  getEntries(
    filters: Record<string, string | number | undefined> = {},
  ): Observable<AnalyticalPage<AnalyticalEntry>> {
    return this.http.get<AnalyticalPage<AnalyticalEntry>>(`${this.base}/entries`, {
      params: toParams(filters),
    });
  }

  createEntry(payload: AnalyticalEntryPayload): Observable<AnalyticalResponse<AnalyticalEntry>> {
    return this.http.post<AnalyticalResponse<AnalyticalEntry>>(`${this.base}/entries`, payload);
  }

  reverseEntry(id: string, reason?: string): Observable<AnalyticalResponse<AnalyticalEntry>> {
    return this.http.post<AnalyticalResponse<AnalyticalEntry>>(
      `${this.base}/entries/${id}/reverse`,
      { reason },
    );
  }

  // --- Step-down schedules and runs ---

  getSchedules(): Observable<AnalyticalPage<ApportionmentSchedule>> {
    return this.http.get<AnalyticalPage<ApportionmentSchedule>>(`${this.base}/schedules`, {
      params: toParams({ per_page: 100 }),
    });
  }

  createSchedule(payload: SchedulePayload): Observable<AnalyticalResponse<ApportionmentSchedule>> {
    return this.http.post<AnalyticalResponse<ApportionmentSchedule>>(
      `${this.base}/schedules`,
      payload,
    );
  }

  updateSchedule(
    id: string,
    payload: SchedulePayload,
  ): Observable<AnalyticalResponse<ApportionmentSchedule>> {
    return this.http.put<AnalyticalResponse<ApportionmentSchedule>>(
      `${this.base}/schedules/${id}`,
      payload,
    );
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/schedules/${id}`);
  }

  getRuns(): Observable<AnalyticalPage<ApportionmentRun>> {
    return this.http.get<AnalyticalPage<ApportionmentRun>>(`${this.base}/runs`, {
      params: toParams({ per_page: 50 }),
    });
  }

  getRun(id: string): Observable<AnalyticalResponse<ApportionmentRun>> {
    return this.http.get<AnalyticalResponse<ApportionmentRun>>(`${this.base}/runs/${id}`);
  }

  previewRun(
    scheduleId: string,
    periodKey: string,
  ): Observable<AnalyticalResponse<ApportionmentRun>> {
    return this.http.post<AnalyticalResponse<ApportionmentRun>>(`${this.base}/runs/preview`, {
      schedule_id: scheduleId,
      period_key: periodKey,
    });
  }

  consolidateRun(id: string): Observable<AnalyticalResponse<ApportionmentRun>> {
    return this.http.post<AnalyticalResponse<ApportionmentRun>>(
      `${this.base}/runs/${id}/consolidate`,
      {},
    );
  }

  reverseRun(id: string, reason?: string): Observable<AnalyticalResponse<ApportionmentRun>> {
    return this.http.post<AnalyticalResponse<ApportionmentRun>>(`${this.base}/runs/${id}/reverse`, {
      reason,
    });
  }

  // --- Reports ---

  getContributionMargin(
    filters: ReportFilters,
  ): Observable<{ success: boolean; data: ContributionMarginReport }> {
    return this.http.get<{ success: boolean; data: ContributionMarginReport }>(
      `${this.base}/reports/contribution-margin`,
      { params: toParams(filters) },
    );
  }

  getDirectVsApportioned(
    filters: ReportFilters & { center_id?: string },
  ): Observable<{ success: boolean; data: DirectVsApportionedReport }> {
    return this.http.get<{ success: boolean; data: DirectVsApportionedReport }>(
      `${this.base}/reports/direct-vs-apportioned`,
      { params: toParams(filters) },
    );
  }

  exportUrl(report: 'contribution-margin' | 'direct-vs-apportioned', filters: ReportFilters): string {
    return `${this.base}/reports/${report}?${toParams({ ...filters, format: 'csv' }).toString()}`;
  }
}
