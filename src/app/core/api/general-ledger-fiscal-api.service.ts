import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  EnasarcoAgentType,
  EnasarcoParameter,
  EnasarcoParameterPayload,
  EnasarcoPrincipalStatement,
  LedgerPreviewParams,
  LedgerPreviewTotals,
  LedgerReconciliation,
  LedgerReconciliationType,
  PayrollPosting,
  PayrollSettings,
  LedgerPayrollSettingsPayload,
  StatementScheme,
  StatementSchemePayload,
  SubledgerPage,
  VatSettings,
  VatSettingsPayload,
  VatSettlementF24,
  VendorAging,
  WithholdingF24,
  WithholdingSettlement,
} from '../models';

/** General ledger endpoints for payroll, VAT, withholding, Enasarco, reclassified statements, reconciliations and subledgers. */
@Service()
export class GeneralLedgerFiscalApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/general-ledger`;
  private readonly accountingBase = `${environment.apiBaseUrl}/accounting`;

  // --- Enasarco ---

  getEnasarcoParameters(): Observable<{ data: EnasarcoParameter[] }> {
    return this.http.get<{ data: EnasarcoParameter[] }>(`${this.base}/enasarco/parameters`);
  }

  saveEnasarcoParameter(payload: EnasarcoParameterPayload): Observable<{ data: EnasarcoParameter }> {
    return this.http.put<{ data: EnasarcoParameter }>(`${this.base}/enasarco/parameters`, payload);
  }

  getEnasarcoSummary(params: { year: number; quarter?: number | null }): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.base}/enasarco/summary`, { params: toHttpParams(params) });
  }

  getEnasarcoPrincipalStatement(params: { year: number; quarter: number }): Observable<{ data: EnasarcoPrincipalStatement }> {
    return this.http.get<{ data: EnasarcoPrincipalStatement }>(`${this.base}/enasarco/principal-statements`, {
      params: toHttpParams(params),
    });
  }

  postEnasarcoPrincipalStatement(payload: {
    year: number;
    quarter: number;
    agent_type: EnasarcoAgentType;
    agent_types?: EnasarcoAgentType[];
  }): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/enasarco/principal-statements`, payload);
  }

  // --- Payroll ---

  getPayrollSettings(): Observable<{ data: PayrollSettings }> {
    return this.http.get<{ data: PayrollSettings }>(`${this.base}/payroll-settings`);
  }

  updatePayrollSettings(payload: LedgerPayrollSettingsPayload): Observable<{ data: PayrollSettings }> {
    return this.http.put<{ data: PayrollSettings }>(`${this.base}/payroll-settings`, payload);
  }

  getPayrollPostings(status?: string): Observable<{ data: PayrollPosting[] }> {
    return this.http.get<{ data: PayrollPosting[] }>(`${this.base}/payroll-postings`, {
      params: status ? toHttpParams({ status }) : undefined,
    });
  }

  postPayrollRun(runId: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/payroll-postings/${runId}/post`, {});
  }

  // --- VAT ---

  getVatSettings(): Observable<{ data: VatSettings }> {
    return this.http.get<{ data: VatSettings }>(`${this.base}/tax-settings`);
  }

  updateVatSettings(payload: VatSettingsPayload): Observable<{ message: string; data: VatSettings }> {
    return this.http.put<{ message: string; data: VatSettings }>(`${this.base}/tax-settings`, payload);
  }

  downloadLipe(settlementId: string): Observable<Blob> {
    return this.http.get(`${this.base}/tax-settlements/${settlementId}/lipe`, { responseType: 'blob' });
  }

  getVatSettlementF24(settlementId: string): Observable<{ data: VatSettlementF24 }> {
    return this.http.get<{ data: VatSettlementF24 }>(`${this.base}/tax-settlements/${settlementId}/f24`);
  }

  downloadMwstStatement(settlementId: string): Observable<Blob> {
    return this.http.get(`${this.base}/tax-settlements/${settlementId}/statement`, { responseType: 'blob' });
  }

  downloadSwissEstvXml(settlementId: string): Observable<Blob> {
    return this.http.get(`${this.base}/tax-settlements/${settlementId}/swiss-xml`, { responseType: 'blob' });
  }

  getVatAnnualReconciliation(year: number): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.base}/vat-annual-reconciliation`, {
      params: toHttpParams({ year }),
    });
  }

  getSwissAnhang(fiscalYearId: string): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.base}/financial-statements/swiss-anhang/${fiscalYearId}`);
  }

  updateSwissAnhang(fiscalYearId: string, payload: Record<string, unknown>): Observable<{ data: Record<string, unknown> }> {
    return this.http.put<{ data: Record<string, unknown> }>(`${this.base}/financial-statements/swiss-anhang/${fiscalYearId}`, payload);
  }

  // --- Withholding ---

  getWithholdingSettlements(params?: { year?: string; status?: string }): Observable<{ data: WithholdingSettlement[] }> {
    return this.http.get<{ data: WithholdingSettlement[] }>(`${this.base}/withholding-settlements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getWithholdingSettlement(id: string): Observable<{ data: WithholdingSettlement }> {
    return this.http.get<{ data: WithholdingSettlement }>(`${this.base}/withholding-settlements/${id}`);
  }

  calculateWithholdingSettlement(payload: { year: number; month: number }): Observable<{ data: WithholdingSettlement }> {
    return this.http.post<{ data: WithholdingSettlement }>(`${this.base}/withholding-settlements/calculate`, payload);
  }

  getWithholdingF24(id: string): Observable<{ data: WithholdingF24 }> {
    return this.http.get<{ data: WithholdingF24 }>(`${this.base}/withholding-settlements/${id}/f24`);
  }

  payWithholdingSettlement(
    id: string,
    payload: { payment_date: string; bank_account_id?: string | null },
  ): Observable<{ data: WithholdingSettlement }> {
    return this.http.post<{ data: WithholdingSettlement }>(`${this.base}/withholding-settlements/${id}/pay`, payload);
  }

  exportWithholdingCertifications(year: number): Observable<Blob> {
    return this.http.get(`${this.base}/withholding-settlements/certification-export`, {
      params: toHttpParams({ year }),
      responseType: 'blob',
    });
  }

  // --- Reclassified statements and analysis ---

  getStatementSchemes(): Observable<ApiResponse<StatementScheme[]>> {
    return this.http.get<ApiResponse<StatementScheme[]>>(`${this.base}/statement-schemes`);
  }

  createStatementScheme(payload: StatementSchemePayload): Observable<ApiResponse<StatementScheme>> {
    return this.http.post<ApiResponse<StatementScheme>>(`${this.base}/statement-schemes`, payload);
  }

  deleteStatementScheme(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/statement-schemes/${id}`);
  }

  getComparativeStatements(fiscalYearId: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/financial-statements/comparative`, {
      params: toHttpParams({ fiscal_year_id: fiscalYearId }),
    });
  }

  getReclassifiedStatement(schemeId: string, fiscalYearId: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/financial-statements/reclassified`, {
      params: toHttpParams({ scheme_id: schemeId, fiscal_year_id: fiscalYearId }),
    });
  }

  /** Cash flow statement (indirect method data); amounts are decimal strings. */
  getCashFlowStatement(fiscalYearId: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/financial-statements/cash-flow-statement`, {
      params: toHttpParams({ fiscal_year_id: fiscalYearId }),
    });
  }

  getFinancialRatios(fiscalYearId: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/financial-statements/ratios`, {
      params: toHttpParams({ fiscal_year_id: fiscalYearId }),
    });
  }

  /** Period balance sheet: decimal strings, cumulative to the end of the period. */
  getPeriodBalanceSheet(fiscalPeriodId?: string): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.base}/financial-statements/balance-sheet`, {
      params: fiscalPeriodId ? toHttpParams({ fiscal_period_id: fiscalPeriodId }) : undefined,
    });
  }

  /** Period income statement: decimal strings. */
  getPeriodIncomeStatement(fiscalPeriodId?: string): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.base}/financial-statements/income-statement`, {
      params: fiscalPeriodId ? toHttpParams({ fiscal_period_id: fiscalPeriodId }) : undefined,
    });
  }

  /** Data to prepare the cash flow statement of a period: decimal strings. */
  getPeriodCashFlow(fiscalPeriodId?: string): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(`${this.base}/financial-statements/cash-flow`, {
      params: fiscalPeriodId ? toHttpParams({ fiscal_period_id: fiscalPeriodId }) : undefined,
    });
  }

  // --- Subledger reconciliations and open items ---

  getLedgerReconciliations(): Observable<{ data: LedgerReconciliation[] }> {
    return this.http.get<{ data: LedgerReconciliation[] }>(`${this.base}/reconciliations`);
  }

  getLedgerReconciliation(id: string): Observable<{ data: LedgerReconciliation }> {
    return this.http.get<{ data: LedgerReconciliation }>(`${this.base}/reconciliations/${id}`);
  }

  createLedgerReconciliation(payload: {
    reconciliation_type: LedgerReconciliationType;
    fiscal_period_id: string;
  }): Observable<{ message: string; data: LedgerReconciliation }> {
    return this.http.post<{ message: string; data: LedgerReconciliation }>(`${this.base}/reconciliations`, payload);
  }

  getCustomerSubledger(params?: { customer_id?: string; status?: string }): Observable<{ data: SubledgerPage }> {
    return this.http.get<{ data: SubledgerPage }>(`${this.base}/subledgers/customers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSupplierSubledger(params?: { supplier_id?: string; status?: string }): Observable<{ data: SubledgerPage }> {
    return this.http.get<{ data: SubledgerPage }>(`${this.base}/subledgers/suppliers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // --- Accounting ledger preview and exports ---

  getLedgerPreview(
    params: LedgerPreviewParams,
  ): Observable<ApiResponse<{ entries: unknown[]; totals: LedgerPreviewTotals; pagination: Record<string, unknown> }>> {
    return this.http.get<ApiResponse<{ entries: unknown[]; totals: LedgerPreviewTotals; pagination: Record<string, unknown> }>>(
      `${this.accountingBase}/general-ledger`,
      { params: toHttpParams({ ...params, format: 'json' }) },
    );
  }

  exportLedger(params: LedgerPreviewParams & { format?: 'csv' | 'json' }): Observable<Blob> {
    return this.http.get(`${this.accountingBase}/general-ledger/export`, {
      params: toHttpParams({ format: 'csv', ...params }),
      responseType: 'blob',
    });
  }

  getVendorAging(params?: { as_of_date?: string; supplier_id?: string }): Observable<ApiResponse<VendorAging>> {
    return this.http.get<ApiResponse<VendorAging>>(`${this.accountingBase}/vendor-aging`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }
}
