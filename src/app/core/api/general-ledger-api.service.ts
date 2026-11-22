import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  CountryVatReturn,
  DatevExportParams,
  JournalLettering,
  JournalLetteringResult,
  SpanishAnnualVatSummary,
  Us1099Payment,
  Us1099PaymentUpdatePayload,
  Us1099RecipientUpdatePayload,
  Us1099SupplierPayment,
  UsTaxExemptionCertificate,
  UsTaxExemptionCertificatePayload,
  UsTaxExemptionCertificateUpdatePayload,
  UsTaxJurisdictionUpdatePayload,
  UsTaxLookup,
  UsTaxLookupParams,
  UsTaxNexusUpdatePayload,
  UsTaxPreloadResult,
  UsTaxRateUpdatePayload,
  Accrual,
  AccountLedgerReport,
  ApiResponse,
  Budget,
  BudgetLine,
  BudgetVarianceReport,
  ChartAccountDetail,
  ChartAccountPayload,
  ChartAccountTemplate,
  ChartAccountTemplateImportResult,
  PaginatedResponse,
  QueryFilterParams,
  CloseChecklist,
  CloseTask,
  CloseTaskStatus,
  CreateAccrualPayload,
  CreateRecurringJournalPayload,
  DataEnvelope,
  Dimension,
  DimensionPayload,
  DimensionReport,
  FiscalYearClosingRun,
  FxRevaluation,
  GlFiscalYear,
  GlJournalEntry,
  LedgerBookCode,
  LedgerSettings,
  LedgerStatementReport,
  ReverseJournalPayload,
  LedgerTrialBalance,
  RecurringJournal,
  RecurringStatus,
  ReportDimension,
  ReportDimensionFilter,
  RollingForecastReport,
  ScheduledRunResult,
  SiiBookType,
  UpdateLedgerSettingsPayload,
  Us1099PaymentPayload,
  Us1099Recipient,
  Us1099RecipientPayload,
  Us1099Summary,
  UsTaxCalculation,
  UsTaxCalculationPayload,
  UsTaxJurisdiction,
  UsTaxJurisdictionPayload,
  UsTaxNexus,
  UsTaxNexusPayload,
  UsTaxRate,
  UsTaxRatePayload,
  VatCodePack,
  VatCodePackCountry,
  VatCodePackImportResult,
  VatRegister,
} from '../models';

export interface DateRangeParams extends ReportDimensionFilter {
  from: string;
  to: string;
  compare_from?: string | null;
  compare_to?: string | null;
  /** Ledger book: 01 statutory, 02 tax, 03 IFRS (default 01). */
  ledger?: LedgerBookCode | null;
  /** Trial balance layout: 2 (side balances) or 4 (opening, debit, credit, closing). */
  columns?: 2 | 4 | null;
}

export interface AccountLedgerParams extends ReportDimensionFilter {
  account_id: string;
  from: string;
  to: string;
  page?: number;
  per_page?: number;
  ledger?: LedgerBookCode | null;
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

  getAccountList(params?: QueryFilterParams & { type?: string; active?: string }): Observable<PaginatedResponse<ChartAccountDetail>> {
    return this.http.get<PaginatedResponse<ChartAccountDetail>>(`${this.base}/accounts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createAccount(payload: ChartAccountPayload): Observable<ApiResponse<ChartAccountDetail>> {
    return this.http.post<ApiResponse<ChartAccountDetail>>(`${this.base}/accounts`, payload);
  }

  getAccountTemplates(): Observable<ApiResponse<ChartAccountTemplate[]>> {
    return this.http.get<ApiResponse<ChartAccountTemplate[]>>(`${this.base}/account-templates`);
  }

  importAccountTemplate(key: string): Observable<ApiResponse<ChartAccountTemplateImportResult>> {
    return this.http.post<ApiResponse<ChartAccountTemplateImportResult>>(`${this.base}/account-templates/${key}/import`, {});
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

  getJournals(params?: QueryFilterParams & { status?: string; fiscal_period_id?: string }): Observable<PaginatedResponse<GlJournalEntry>> {
    return this.http.get<PaginatedResponse<GlJournalEntry>>(`${this.base}/journals`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getJournal(id: string): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.get<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}`);
  }

  /** Storno: the API needs a `reversal_date`; the optional body keeps the older call sites working. */
  reverseJournalEntry(id: string, body: Partial<ReverseJournalPayload> = {}): Observable<ApiResponse<GlJournalEntry>> {
    return this.http.post<ApiResponse<GlJournalEntry>>(`${this.base}/journals/${id}/reverse`, body);
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

  getRecurringJournals(params?: QueryFilterParams & { status?: RecurringStatus }): Observable<PaginatedResponse<RecurringJournal>> {
    return this.http.get<PaginatedResponse<RecurringJournal>>(`${this.base}/recurring-journals`, {
      params: params ? toHttpParams(params) : undefined,
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

  getAccruals(params?: QueryFilterParams & { accrual_type?: string; cutoff_date?: string }): Observable<PaginatedResponse<Accrual>> {
    return this.http.get<PaginatedResponse<Accrual>>(`${this.base}/accruals`, {
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

  getFiscalYears(params?: QueryFilterParams): Observable<PaginatedResponse<GlFiscalYear>> {
    return this.http.get<PaginatedResponse<GlFiscalYear>>(`${this.base}/fiscal-years`, {
      params: params ? toHttpParams(params) : undefined,
    });
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

  reopenFiscalYear(id: string, reason: string): Observable<ApiResponse<GlFiscalYear>> {
    return this.http.post<ApiResponse<GlFiscalYear>>(`${this.base}/fiscal-years/${id}/reopen`, { reason });
  }

  approveFiscalYearAtAgm(id: string, resolutionReference?: string | null): Observable<ApiResponse<GlFiscalYear>> {
    return this.http.post<ApiResponse<GlFiscalYear>>(`${this.base}/fiscal-years/${id}/approve-agm`, {
      resolution_reference: resolutionReference ?? null,
    });
  }

  carryForwardFiscalYear(id: string): Observable<ApiResponse<{ journal_entry_id: string | null; entry_number: string | null }>> {
    return this.http.post<ApiResponse<{ journal_entry_id: string | null; entry_number: string | null }>>(
      `${this.base}/fiscal-years/${id}/carry-forward`,
      {},
    );
  }

  // --- FX revaluation of open receivables / payables ---

  getFxRevaluations(params?: QueryFilterParams & { revaluation_date?: string }): Observable<PaginatedResponse<FxRevaluation>> {
    return this.http.get<PaginatedResponse<FxRevaluation>>(`${this.base}/fx-revaluations`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  runFxRevaluation(payload: { revaluation_date: string; currency?: string | null }): Observable<ApiResponse<FxRevaluation[]>> {
    return this.http.post<ApiResponse<FxRevaluation[]>>(`${this.base}/fx-revaluations`, payload);
  }

  // --- Cost centres and profit centres ---

  getCostCenters(params?: QueryFilterParams): Observable<PaginatedResponse<Dimension>> {
    return this.http.get<PaginatedResponse<Dimension>>(`${this.base}/cost-centers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createCostCenter(payload: DimensionPayload): Observable<ApiResponse<Dimension>> {
    return this.http.post<ApiResponse<Dimension>>(`${this.base}/cost-centers`, payload);
  }

  updateCostCenter(id: string, payload: DimensionPayload): Observable<ApiResponse<Dimension>> {
    return this.http.put<ApiResponse<Dimension>>(`${this.base}/cost-centers/${id}`, payload);
  }

  getProfitCenters(params?: QueryFilterParams): Observable<PaginatedResponse<Dimension>> {
    return this.http.get<PaginatedResponse<Dimension>>(`${this.base}/profit-centers`, {
      params: params ? toHttpParams(params) : undefined,
    });
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

  // --- Localization packs: VAT codes, FEC, SII ---

  getVatCodePacks(): Observable<DataEnvelope<VatCodePack[]>> {
    return this.http.get<DataEnvelope<VatCodePack[]>>(`${this.base}/vat-code-packs`);
  }

  importVatCodePack(country: VatCodePackCountry): Observable<DataEnvelope<VatCodePackImportResult>> {
    return this.http.post<DataEnvelope<VatCodePackImportResult>>(`${this.base}/vat-code-packs/${country}/import`, {});
  }

  exportFec(params: { fiscal_year_id: string }): Observable<Blob> {
    return this.http.get(`${this.base}/fec/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  exportSiiVatBook(type: SiiBookType, params: { from: string; to: string }): Observable<Blob> {
    return this.http.get(`${this.base}/sii/${type}/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  // --- US sales tax ---

  getUsTaxJurisdictions(params?: { state?: string }): Observable<DataEnvelope<UsTaxJurisdiction[]>> {
    return this.http.get<DataEnvelope<UsTaxJurisdiction[]>>(`${this.base}/us-tax/jurisdictions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createUsTaxJurisdiction(payload: UsTaxJurisdictionPayload): Observable<DataEnvelope<UsTaxJurisdiction>> {
    return this.http.post<DataEnvelope<UsTaxJurisdiction>>(`${this.base}/us-tax/jurisdictions`, payload);
  }

  createUsTaxRate(jurisdictionId: string, payload: UsTaxRatePayload): Observable<DataEnvelope<UsTaxRate>> {
    return this.http.post<DataEnvelope<UsTaxRate>>(`${this.base}/us-tax/jurisdictions/${jurisdictionId}/rates`, payload);
  }

  getUsTaxNexus(): Observable<DataEnvelope<UsTaxNexus[]>> {
    return this.http.get<DataEnvelope<UsTaxNexus[]>>(`${this.base}/us-tax/nexus`);
  }

  createUsTaxNexus(payload: UsTaxNexusPayload): Observable<DataEnvelope<UsTaxNexus>> {
    return this.http.post<DataEnvelope<UsTaxNexus>>(`${this.base}/us-tax/nexus`, payload);
  }

  calculateUsSalesTax(payload: UsTaxCalculationPayload): Observable<DataEnvelope<UsTaxCalculation>> {
    return this.http.post<DataEnvelope<UsTaxCalculation>>(`${this.base}/us-tax/calculate`, payload);
  }

  updateUsTaxJurisdiction(id: string, payload: UsTaxJurisdictionUpdatePayload): Observable<DataEnvelope<UsTaxJurisdiction>> {
    return this.http.put<DataEnvelope<UsTaxJurisdiction>>(`${this.base}/us-tax/jurisdictions/${id}`, payload);
  }

  deleteUsTaxJurisdiction(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/us-tax/jurisdictions/${id}`);
  }

  updateUsTaxRate(id: string, payload: UsTaxRateUpdatePayload): Observable<DataEnvelope<UsTaxRate>> {
    return this.http.put<DataEnvelope<UsTaxRate>>(`${this.base}/us-tax/rates/${id}`, payload);
  }

  deleteUsTaxRate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/us-tax/rates/${id}`);
  }

  updateUsTaxNexus(id: string, payload: UsTaxNexusUpdatePayload): Observable<DataEnvelope<UsTaxNexus>> {
    return this.http.put<DataEnvelope<UsTaxNexus>>(`${this.base}/us-tax/nexus/${id}`, payload);
  }

  deleteUsTaxNexus(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/us-tax/nexus/${id}`);
  }

  preloadUsTaxRates(states?: string[]): Observable<DataEnvelope<UsTaxPreloadResult>> {
    return this.http.post<DataEnvelope<UsTaxPreloadResult>>(`${this.base}/us-tax/preload`, states?.length ? { states } : {});
  }

  lookupUsTaxRate(params: UsTaxLookupParams): Observable<DataEnvelope<UsTaxLookup>> {
    return this.http.get<DataEnvelope<UsTaxLookup>>(`${this.base}/us-tax/lookup`, { params: toHttpParams(params) });
  }

  getUsTaxExemptionCertificates(params?: { contact_id?: string; state?: string }): Observable<DataEnvelope<UsTaxExemptionCertificate[]>> {
    return this.http.get<DataEnvelope<UsTaxExemptionCertificate[]>>(`${this.base}/us-tax/exemption-certificates`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createUsTaxExemptionCertificate(payload: UsTaxExemptionCertificatePayload): Observable<DataEnvelope<UsTaxExemptionCertificate>> {
    return this.http.post<DataEnvelope<UsTaxExemptionCertificate>>(`${this.base}/us-tax/exemption-certificates`, payload);
  }

  updateUsTaxExemptionCertificate(id: string, payload: UsTaxExemptionCertificateUpdatePayload): Observable<DataEnvelope<UsTaxExemptionCertificate>> {
    return this.http.put<DataEnvelope<UsTaxExemptionCertificate>>(`${this.base}/us-tax/exemption-certificates/${id}`, payload);
  }

  deleteUsTaxExemptionCertificate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/us-tax/exemption-certificates/${id}`);
  }

  // --- US 1099 ---

  getUs1099Recipients(): Observable<DataEnvelope<Us1099Recipient[]>> {
    return this.http.get<DataEnvelope<Us1099Recipient[]>>(`${this.base}/us-1099/recipients`);
  }

  createUs1099Recipient(payload: Us1099RecipientPayload): Observable<DataEnvelope<Us1099Recipient>> {
    return this.http.post<DataEnvelope<Us1099Recipient>>(`${this.base}/us-1099/recipients`, payload);
  }

  updateUs1099Recipient(id: string, payload: Us1099RecipientUpdatePayload): Observable<DataEnvelope<Us1099Recipient>> {
    return this.http.put<DataEnvelope<Us1099Recipient>>(`${this.base}/us-1099/recipients/${id}`, payload);
  }

  deleteUs1099Recipient(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/us-1099/recipients/${id}`);
  }

  getUs1099Payments(params?: { year?: number; recipient_id?: string }): Observable<DataEnvelope<Us1099Payment[]>> {
    return this.http.get<DataEnvelope<Us1099Payment[]>>(`${this.base}/us-1099/payments`, { params: params ? toHttpParams(params) : undefined });
  }

  createUs1099Payment(payload: Us1099PaymentPayload): Observable<DataEnvelope<Us1099Payment>> {
    return this.http.post<DataEnvelope<Us1099Payment>>(`${this.base}/us-1099/payments`, payload);
  }

  updateUs1099Payment(id: string, payload: Us1099PaymentUpdatePayload): Observable<DataEnvelope<Us1099Payment>> {
    return this.http.put<DataEnvelope<Us1099Payment>>(`${this.base}/us-1099/payments/${id}`, payload);
  }

  deleteUs1099Payment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/us-1099/payments/${id}`);
  }

  getUs1099SupplierPayments(params?: { year?: number }): Observable<DataEnvelope<Us1099SupplierPayment[]>> {
    return this.http.get<DataEnvelope<Us1099SupplierPayment[]>>(`${this.base}/us-1099/supplier-payments`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // --- Country VAT returns, DATEV and lettering ---

  getFrenchCa3(params: { from: string; to: string; previous_credit?: number | null }): Observable<DataEnvelope<CountryVatReturn>> {
    return this.http.get<DataEnvelope<CountryVatReturn>>(`${this.base}/fr/ca3`, { params: toHttpParams(params) });
  }

  exportFrenchCa3(params: { from: string; to: string; previous_credit?: number | null }): Observable<Blob> {
    return this.http.get(`${this.base}/fr/ca3/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  getSpanishModelo303(params: { from: string; to: string; previous_credit?: number | null }): Observable<DataEnvelope<CountryVatReturn>> {
    return this.http.get<DataEnvelope<CountryVatReturn>>(`${this.base}/es/modelo-303`, { params: toHttpParams(params) });
  }

  exportSpanishModelo303(params: { from: string; to: string; previous_credit?: number | null }): Observable<Blob> {
    return this.http.get(`${this.base}/es/modelo-303/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  getSpanishModelo390(year: number): Observable<DataEnvelope<SpanishAnnualVatSummary>> {
    return this.http.get<DataEnvelope<SpanishAnnualVatSummary>>(`${this.base}/es/modelo-390`, { params: toHttpParams({ year }) });
  }

  getGermanUstva(params: { from: string; to: string }): Observable<DataEnvelope<CountryVatReturn>> {
    return this.http.get<DataEnvelope<CountryVatReturn>>(`${this.base}/de/ustva`, { params: toHttpParams(params) });
  }

  exportGermanUstva(params: { from: string; to: string }): Observable<Blob> {
    return this.http.get(`${this.base}/de/ustva/export`, { params: toHttpParams(params), responseType: 'blob' });
  }

  exportDatev(params: DatevExportParams): Observable<Blob> {
    return this.http.get(`${this.base}/de/datev/export`, { params: toHttpParams({ ...params }), responseType: 'blob' });
  }

  getLetterings(accountId?: string): Observable<DataEnvelope<JournalLettering[]>> {
    return this.http.get<DataEnvelope<JournalLettering[]>>(`${this.base}/letterings`, {
      params: accountId ? toHttpParams({ account_id: accountId }) : undefined,
    });
  }

  createLettering(payload: { journal_line_ids: string[]; lettered_on?: string | null }): Observable<DataEnvelope<JournalLetteringResult>> {
    return this.http.post<DataEnvelope<JournalLetteringResult>>(`${this.base}/letterings`, payload);
  }

  deleteLettering(code: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/letterings/${code}`);
  }

  getUs1099Summary(year: number): Observable<DataEnvelope<Us1099Summary>> {
    return this.http.get<DataEnvelope<Us1099Summary>>(`${this.base}/us-1099/summary`, { params: toHttpParams({ year }) });
  }

  // --- Budgets ---

  getBudgets(params?: QueryFilterParams & { fiscal_year_id?: string }): Observable<PaginatedResponse<Budget>> {
    return this.http.get<PaginatedResponse<Budget>>(`${this.base}/budgets`, {
      params: params ? toHttpParams(params) : undefined,
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
