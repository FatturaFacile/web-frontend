import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AllocationPreview,
  AllocationRule,
  AllocationRun,
  AnalyticalJob,
  BudgetPlan,
  ControllingBudgetLine,
  CostCenterNode,
  ControllingResponse,
  FinancialKpis,
  JobPnl,
  AnalyticalLedgerEntry,
  AnalyticalLedgerPage,
  AnalyticalLedgerPayload,
  AnalyticalLedgerQuery,
  MarginExplore,
  MarginMatrix,
  MarginPareto,
  MarginQuery,
  MarginSummary,
  VarianceQuery,
  VarianceReport,
  WaterfallStep,
} from '../models';

/** Controlling: cost centers, jobs, allocations, margin control (#216), working capital KPIs, budgets and variances. */
@Service()
export class ControllingApiService {
  private readonly http = inject(HttpClient);
  private readonly controlling = `${environment.apiBaseUrl}/controlling`;
  private readonly analytics = `${environment.apiBaseUrl}/analytics`;
  private readonly budgets = `${environment.apiBaseUrl}/budgets`;

  // Margins
  getMarginSummary(query: MarginQuery): Observable<ControllingResponse<MarginSummary>> {
    return this.http.get<ControllingResponse<MarginSummary>>(`${this.analytics}/margins/summary`, {
      params: this.params(query),
    });
  }

  exploreMargins(query: MarginQuery): Observable<MarginExplore> {
    return this.http.get<MarginExplore>(`${this.analytics}/margins/explore`, {
      params: this.params(query),
    });
  }

  getMarginMatrix(query: MarginQuery): Observable<ControllingResponse<MarginMatrix>> {
    return this.http.get<ControllingResponse<MarginMatrix>>(`${this.analytics}/margins/matrix`, {
      params: this.params(query),
    });
  }

  getMarginPareto(query: MarginQuery): Observable<ControllingResponse<MarginPareto>> {
    return this.http.get<ControllingResponse<MarginPareto>>(`${this.analytics}/margins/pareto`, {
      params: this.params(query),
    });
  }

  exportMargins(query: MarginQuery, format: 'csv' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.analytics}/margins/export`, {
      params: this.params({ ...query, format }),
      responseType: 'blob',
    });
  }

  // Working capital
  getFinancialKpis(asOf?: string, months = 12): Observable<ControllingResponse<FinancialKpis>> {
    return this.http.get<ControllingResponse<FinancialKpis>>(`${this.analytics}/financial-kpis`, {
      params: this.params({ as_of: asOf, months }),
    });
  }

  // Cost centers, jobs, allocations
  getCostCenterTree(
    fiscalYear: number,
    fromMonth = 1,
    toMonth = 12,
  ): Observable<ControllingResponse<CostCenterNode[]>> {
    return this.http.get<ControllingResponse<CostCenterNode[]>>(
      `${this.controlling}/cost-centers`,
      {
        params: this.params({
          view: 'tree',
          fiscal_year: fiscalYear,
          from_month: fromMonth,
          to_month: toMonth,
        }),
      },
    );
  }

  getJobs(): Observable<ControllingResponse<AnalyticalJob[]>> {
    return this.http.get<ControllingResponse<AnalyticalJob[]>>(`${this.controlling}/jobs`, {
      params: this.params({ per_page: 100 }),
    });
  }

  getJobPnl(id: string): Observable<ControllingResponse<JobPnl>> {
    return this.http.get<ControllingResponse<JobPnl>>(`${this.controlling}/jobs/${id}/pnl`);
  }

  getLedgerEntries(query: AnalyticalLedgerQuery = {}): Observable<AnalyticalLedgerPage> {
    return this.http.get<AnalyticalLedgerPage>(`${this.controlling}/analytical-ledger`, {
      params: this.params({ per_page: 25, ...query }),
    });
  }

  createLedgerEntry(
    payload: AnalyticalLedgerPayload,
  ): Observable<ControllingResponse<AnalyticalLedgerEntry>> {
    return this.http.post<ControllingResponse<AnalyticalLedgerEntry>>(
      `${this.controlling}/analytical-ledger`,
      payload,
    );
  }

  getAllocationRules(): Observable<ControllingResponse<AllocationRule[]>> {
    return this.http.get<ControllingResponse<AllocationRule[]>>(
      `${this.controlling}/allocation-rules`,
    );
  }

  getAllocationRuns(): Observable<ControllingResponse<AllocationRun[]>> {
    return this.http.get<ControllingResponse<AllocationRun[]>>(`${this.controlling}/allocations`);
  }

  previewAllocation(
    fiscalYear: number,
    fiscalMonth: number,
  ): Observable<ControllingResponse<AllocationPreview>> {
    return this.http.post<ControllingResponse<AllocationPreview>>(
      `${this.controlling}/allocations/preview`,
      { fiscal_year: fiscalYear, fiscal_month: fiscalMonth },
    );
  }

  executeAllocation(
    fiscalYear: number,
    fiscalMonth: number,
  ): Observable<ControllingResponse<AllocationRun>> {
    return this.http.post<ControllingResponse<AllocationRun>>(
      `${this.controlling}/allocations/execute`,
      { fiscal_year: fiscalYear, fiscal_month: fiscalMonth },
    );
  }

  reverseAllocation(runId: string): Observable<ControllingResponse<AllocationRun>> {
    return this.http.post<ControllingResponse<AllocationRun>>(
      `${this.controlling}/allocations/${runId}/reverse`,
      {},
    );
  }

  // Budgets and variances
  getBudgets(fiscalYear?: number): Observable<ControllingResponse<BudgetPlan[]>> {
    return this.http.get<ControllingResponse<BudgetPlan[]>>(this.budgets, {
      params: this.params({ fiscal_year: fiscalYear, per_page: 100 }),
    });
  }

  getBudget(id: string): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.get<ControllingResponse<BudgetPlan>>(`${this.budgets}/${id}`);
  }

  createBudget(body: {
    code: string;
    name: string;
    fiscal_year: number;
  }): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.post<ControllingResponse<BudgetPlan>>(this.budgets, body);
  }

  cloneBudget(
    id: string,
    body: { code: string; name: string; uplift_percent: number },
  ): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.post<ControllingResponse<BudgetPlan>>(`${this.budgets}/${id}/clone`, body);
  }

  seedBudget(body: {
    code: string;
    name: string;
    fiscal_year: number;
    uplift_percent: number;
  }): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.post<ControllingResponse<BudgetPlan>>(
      `${this.budgets}/seed-from-prior-year`,
      body,
    );
  }

  generateRollingForecast(
    id: string,
    cutoffMonth: number,
  ): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.post<ControllingResponse<BudgetPlan>>(
      `${this.budgets}/${id}/generate-rolling-forecast`,
      { cutoff_month: cutoffMonth },
    );
  }

  transitionBudget(
    id: string,
    action: 'submit' | 'approve' | 'lock',
  ): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.post<ControllingResponse<BudgetPlan>>(`${this.budgets}/${id}/${action}`, {});
  }

  saveBudgetLines(
    id: string,
    lines: Partial<ControllingBudgetLine>[],
  ): Observable<ControllingResponse<BudgetPlan>> {
    return this.http.put<ControllingResponse<BudgetPlan>>(`${this.budgets}/${id}/lines/bulk`, {
      lines,
    });
  }

  getVariance(query: VarianceQuery): Observable<VarianceReport> {
    return this.http.get<VarianceReport>(`${this.analytics}/variance`, {
      params: this.params(query),
    });
  }

  getWaterfall(query: VarianceQuery): Observable<ControllingResponse<{ steps: WaterfallStep[] }>> {
    return this.http.get<ControllingResponse<{ steps: WaterfallStep[] }>>(
      `${this.analytics}/variance/waterfall`,
      { params: this.params(query) },
    );
  }

  private params(values: object | undefined): HttpParams {
    let params = new HttpParams();
    const append = (key: string, value: unknown): void => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.entries(item).forEach(([k, v]) => append(`${key}[${index}][${k}]`, v));
          } else {
            append(`${key}[${index}]`, item);
          }
        });
        return;
      }
      params = params.set(key, String(value));
    };
    Object.entries(values ?? {}).forEach(([key, value]) => append(key, value));
    return params;
  }
}
