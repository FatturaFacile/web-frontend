import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  Accrual,
  AccountLedgerReport,
  ApiResponse,
  Budget,
  BudgetLine,
  BudgetVarianceReport,
  ChartAccountDetail,
  ChartAccountPayload,
  PaginatedResponse,
  CloseChecklist,
  CloseTask,
  CloseTaskStatus,
  CreateAccrualPayload,
  CreateRecurringJournalPayload,
  Dimension,
  DimensionPayload,
  DimensionReport,
  FiscalYearClosingRun,
  FxRevaluation,
  GlFiscalYear,
  GlJournalEntry,
  LedgerSettings,
  LedgerStatementReport,
  LedgerTrialBalance,
  RecurringJournal,
  RecurringStatus,
  ReportDimension,
  ReportDimensionFilter,
  RollingForecastReport,
  ScheduledRunResult,
  UpdateLedgerSettingsPayload,
  VatRegister,
} from '../models';

export interface DateRangeParams extends ReportDimensionFilter {
  from: string;
  to: string;
  compare_from?: string | null;
  compare_to?: string | null;
}

export interface AccountLedgerParams extends ReportDimensionFilter {
  account_id: string;
  from: string;
  to: string;
  page?: number;
  per_page?: number;
}

/** General ledger endpoints that extend `AccountingApiService`: settings, four-eyes, close, FX, reports, budgets. */
@Service()
export class GeneralLedgerApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/general-ledger`;

  // --- Settings ---

  getSettings(): Observable<ApiResponse<LedgerSettings>> {
    return this.http.get<ApiResponse<LedgerSettings>>(`${this.base}/settings`);
  }

  updateSettings(payload: UpdateLedgerSettingsPayload): Observable<ApiResponse<LedgerSettings>> {
    return this.http.put<ApiResponse<LedgerSettings>>(`${this.base}/settings`, payload);
  }

  // --- Chart of accounts ---

  getAccountList(params?: { type?: string; active?: string; per_page?: number }): Observable<PaginatedResponse<ChartAccountDetail>> {
    return this.http.get<PaginatedResponse<ChartAccountDetail>>(`${this.base}/accounts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createAccount(payload: ChartAccountPayload): Observable<ApiResponse<ChartAccountDetail>> {
    return this.http.post<ApiResponse<ChartAccountDetail>>(`${this.base}/accounts`, payload);
  }

  getAccount(id: string): Observable<ApiResponse<ChartAccountDetail>> {
    return this.http.get<ApiResponse<ChartAccountDetail>>(`${this.base}/accounts/${id}`);
  }

  updateAccount(id: string, payload: ChartAccountPayload): Observable<ApiResponse<ChartAccountDetail>> {
    return this.http.put<ApiResponse<ChartAccountDetail>>(`${this.base}/accounts/${id}`, payload);
  }

  deleteAccount(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/accounts/${id}`);
  }

  // --- Journals: four-eyes workflow ---

  getJournals(params?: { status?: string; fiscal_period_id?: string; page?: number; per_page?: number }): Observable<PaginatedResponse<GlJournalEntry>> {
    return this.http.get<PaginatedResponse<GlJournalEntry>>(`${this.base}/journals`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getJournal(id: string): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.get<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}`);
  }

  reverseJournalEntry(id: string): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}/reverse`, {});
  }

  submitJournal(id: string): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}/submit`, {});
  }

  approveJournal(id: string): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}/approve`, {});
  }

  rejectJournal(id: string, reason: string): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}/reject`, { reason });
  }

  // --- Recurring journals ---

  getRecurringJournals(status?: RecurringStatus): Observable<ApiResponse<RecurringJournal[]>> {
    return this.http.get<ApiResponse<RecurringJournal[]>>(`${this.base}/recurring-journals`, {
      params: status ? toHttpParams({ status }) : undefined,
    });
  }

  getRecurringJournal(id: string): Observable<ApiResponse<RecurringJournal>> {
    return this.http.get<ApiResponse<RecurringJournal>>(`${this.base}/recurring-journals/${id}`);
  }

  createRecurringJournal(payload: CreateRecurringJournalPayload): Observable<ApiResponse<RecurringJournal>> {
    return this.http.post<ApiResponse<RecurringJournal>>(`${this.base}/recurring-journals`, payload);
  }

  setRecurringJournalStatus(id: string, status: RecurringStatus): Observable<ApiResponse<RecurringJournal>> {
    return this.http.post<ApiResponse<RecurringJournal>>(`${this.base}/recurring-journals/${id}/status`, { status });
  }

  runRecurringJournal(id: string, asOf?: string | null): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/recurring-journals/${id}/run`, {
      as_of: asOf ?? null,
    });
  }

  runScheduledJournals(asOf?: string | null): Observable<ApiResponse<ScheduledRunResult>> {
    return this.http.post<ApiResponse<ScheduledRunResult>>(`${this.base}/scheduled-journals/run`, {
      as_of: asOf ?? null,
    });
  }

  // --- Accruals and deferrals ---

  getAccruals(params?: { accrual_type?: string; cutoff_date?: string }): Observable<ApiResponse<Accrual[]>> {
    return this.http.get<ApiResponse<Accrual[]>>(`${this.base}/accruals`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getAccrual(id: string): Observable<ApiResponse<Accrual>> {
    return this.http.get<ApiResponse<Accrual>>(`${this.base}/accruals/${id}`);
  }

  createAccrual(payload: CreateAccrualPayload): Observable<ApiResponse<Accrual>> {
    return this.http.post<ApiResponse<Accrual>>(`${this.base}/accruals`, payload);
  }

  // --- Period close ---

  getCloseChecklist(periodId: string): Observable<ApiResponse<CloseChecklist>> {
    return this.http.get<ApiResponse<CloseChecklist>>(`${this.base}/fiscal-periods/${periodId}/close-checklist`);
  }

  addCloseTask(
    periodId: string,
    payload: { title: string; description?: string | null; is_blocking?: boolean | null },
  ): Observable<ApiResponse<CloseTask>> {
    return this.http.post<ApiResponse<CloseTask>>(`${this.base}/fiscal-periods/${periodId}/close-tasks`, payload);
  }

  setCloseTaskStatus(
    periodId: string,
    taskId: string,
    status: CloseTaskStatus,
    note?: string | null,
  ): Observable<ApiResponse<CloseTask>> {
    return this.http.post<ApiResponse<CloseTask>>(
      `${this.base}/fiscal-periods/${periodId}/close-tasks/${taskId}/status`,
      { status, note: note ?? null },
    );
  }

  // --- Fiscal years ---

  getFiscalYears(): Observable<ApiResponse<GlFiscalYear[]>> {
    return this.http.get<ApiResponse<GlFiscalYear[]>>(`${this.base}/fiscal-years`);
  }

  getFiscalYear(id: string): Observable<ApiResponse<GlFiscalYear>> {
    return this.http.get<ApiResponse<GlFiscalYear>>(`${this.base}/fiscal-years/${id}`);
  }

  createFiscalYear(payload: { year_code: string; start_date: string; end_date: string }): Observable<ApiResponse<GlFiscalYear>> {
    return this.http.post<ApiResponse<GlFiscalYear>>(`${this.base}/fiscal-years`, payload);
  }

  closeFiscalYear(id: string): Observable<ApiResponse<FiscalYearClosingRun>> {
    return this.http.post<ApiResponse<FiscalYearClosingRun>>(`${this.base}/fiscal-years/${id}/close`, {});
  }

  carryForwardFiscalYear(id: string): Observable<ApiResponse<{ journal_entry_id: string | null; entry_number: string | null }>> {
    return this.http.post<ApiResponse<{ journal_entry_id: string | null; entry_number: string | null }>>(
      `${this.base}/fiscal-years/${id}/carry-forward`,
      {},
    );
  }

  // --- FX revaluation of open receivables / payables ---

  getFxRevaluations(revaluationDate?: string): Observable<ApiResponse<FxRevaluation[]>> {
    return this.http.get<ApiResponse<FxRevaluation[]>>(`${this.base}/fx-revaluations`, {
      params: revaluationDate ? toHttpParams({ revaluation_date: revaluationDate }) : undefined,
    });
  }

  runFxRevaluation(payload: { revaluation_date: string; currency?: string | null }): Observable<ApiResponse<FxRevaluation[]>> {
    return this.http.post<ApiResponse<FxRevaluation[]>>(`${this.base}/fx-revaluations`, payload);
  }

  // --- Cost centres and profit centres ---

  getCostCenters(): Observable<ApiResponse<Dimension[]>> {
    return this.http.get<ApiResponse<Dimension[]>>(`${this.base}/cost-centers`);
  }

  createCostCenter(payload: DimensionPayload): Observable<ApiResponse<Dimension>> {
    return this.http.post<ApiResponse<Dimension>>(`${this.base}/cost-centers`, payload);
  }

  updateCostCenter(id: string, payload: DimensionPayload): Observable<ApiResponse<Dimension>> {
    return this.http.put<ApiResponse<Dimension>>(`${this.base}/cost-centers/${id}`, payload);
  }

  getProfitCenters(): Observable<ApiResponse<Dimension[]>> {
    return this.http.get<ApiResponse<Dimension[]>>(`${this.base}/profit-centers`);
  }

  createProfitCenter(payload: DimensionPayload): Observable<ApiResponse<Dimension>> {
    return this.http.post<ApiResponse<Dimension>>(`${this.base}/profit-centers`, payload);
  }

  updateProfitCenter(id: string, payload: DimensionPayload): Observable<ApiResponse<Dimension>> {
    return this.http.put<ApiResponse<Dimension>>(`${this.base}/profit-centers/${id}`, payload);
  }

  // --- Reports (accounting currency) ---

  getTrialBalanceReport(params: DateRangeParams): Observable<ApiResponse<LedgerTrialBalance>> {
    return this.http.get<ApiResponse<LedgerTrialBalance>>(`${this.base}/reports/trial-balance`, {
      params: toHttpParams(params),
    });
  }

  getAccountLedger(params: AccountLedgerParams): Observable<ApiResponse<AccountLedgerReport>> {
    return this.http.get<ApiResponse<AccountLedgerReport>>(`${this.base}/reports/account-ledger`, {
      params: toHttpParams(params),
    });
  }

  getBalanceSheetReport(params: { as_of: string; compare_as_of?: string | null }): Observable<ApiResponse<LedgerStatementReport>> {
    return this.http.get<ApiResponse<LedgerStatementReport>>(`${this.base}/reports/balance-sheet`, {
      params: toHttpParams(params),
    });
  }

  getIncomeStatementReport(params: DateRangeParams): Observable<ApiResponse<LedgerStatementReport>> {
    return this.http.get<ApiResponse<LedgerStatementReport>>(`${this.base}/reports/income-statement`, {
      params: toHttpParams(params),
    });
  }

  getDimensionReport(params: { dimension: ReportDimension; from: string; to: string }): Observable<ApiResponse<DimensionReport>> {
    return this.http.get<ApiResponse<DimensionReport>>(`${this.base}/reports/dimensions`, {
      params: toHttpParams(params),
    });
  }

  // --- Exports ---

  exportAuditTrail(params: { from: string; to: string; format?: 'csv' | 'json' }): Observable<Blob> {
    return this.http.get(`${this.base}/audit-trail/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  exportJournalBook(params: { fiscal_year_id: string; from?: string | null; to?: string | null }): Observable<Blob> {
    return this.http.get(`${this.base}/journal-book/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  // --- VAT registers ---

  getVatRegister(type: 'sales' | 'purchases', params: { from: string; to: string }): Observable<VatRegister> {
    return this.http.get<VatRegister>(`${this.base}/vat-registers/${type}`, {
      params: toHttpParams({ ...params, format: 'json' }),
    });
  }

  // --- Budgets ---

  getBudgets(fiscalYearId?: string): Observable<ApiResponse<Budget[]>> {
    return this.http.get<ApiResponse<Budget[]>>(`${this.base}/budgets`, {
      params: fiscalYearId ? toHttpParams({ fiscal_year_id: fiscalYearId }) : undefined,
    });
  }

  getBudget(id: string): Observable<ApiResponse<Budget>> {
    return this.http.get<ApiResponse<Budget>>(`${this.base}/budgets/${id}`);
  }

  createBudget(payload: { fiscal_year_id: string; name: string; notes?: string | null }): Observable<ApiResponse<Budget>> {
    return this.http.post<ApiResponse<Budget>>(`${this.base}/budgets`, payload);
  }

  replaceBudgetLines(id: string, lines: BudgetLine[]): Observable<ApiResponse<Budget>> {
    return this.http.put<ApiResponse<Budget>>(`${this.base}/budgets/${id}/lines`, { lines });
  }

  newBudgetVersion(id: string): Observable<ApiResponse<Budget>> {
    return this.http.post<ApiResponse<Budget>>(`${this.base}/budgets/${id}/new-version`, {});
  }

  approveBudget(id: string): Observable<ApiResponse<Budget>> {
    return this.http.post<ApiResponse<Budget>>(`${this.base}/budgets/${id}/approve`, {});
  }

  getBudgetVariance(id: string, costCenterId?: string): Observable<ApiResponse<BudgetVarianceReport>> {
    return this.http.get<ApiResponse<BudgetVarianceReport>>(`${this.base}/budgets/${id}/variance`, {
      params: costCenterId ? toHttpParams({ cost_center_id: costCenterId }) : undefined,
    });
  }

  getBudgetRollingForecast(id: string): Observable<ApiResponse<RollingForecastReport>> {
    return this.http.get<ApiResponse<RollingForecastReport>>(`${this.base}/budgets/${id}/rolling-forecast`);
  }
}
