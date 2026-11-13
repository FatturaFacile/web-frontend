import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  BankAccountBalanceReport,
  BankBalanceSnapshot,
  BankChargePayload,
  BankReconciliation,
  CashRegister,
  CashRegisterClosePayload,
  CashRegisterClosing,
  CashRegisterMovement,
  CashRegisterMovementPayload,
  CreateCashRegisterPayload,
  CreatePaymentProposalPayload,
  CreateRibaBatchPayload,
  DunningReadiness,
  ForecastScenario,
  ForecastScenarioPayload,
  FxBankRevaluation,
  FxBankRevaluationPayload,
  IbanCheckResult,
  IntercompanyTransfer,
  IntercompanyTransferPayload,
  LiquidityBuffer,
  LiquidityForecast,
  LiquidityForecastParams,
  ManualReconciliationMatchPayload,
  PaginatedResponse,
  QueryFilterParams,
  PaymentProposal,
  PaymentProposalExcluded,
  PaymentProposalStatus,
  ReceivableCollection,
  ReconciliationRule,
  ReconciliationRulePayload,
  RecurringCashItem,
  RecurringCashItemPayload,
  RibaBatchDetail,
  RibaBatchSummary,
  RibaPortfolio,
  TransferPayload,
  TreasuryCashPosition,
  TreasuryKpis,
  TreasuryMovement,
  TreasuryMovementType,
  WorkingCapitalMetrics,
} from '../models';

/** Treasury endpoints beyond `TreasuryApiService`: balances, movements, cash registers, proposals, FX, liquidity, Ri.Ba., collections. */
@Service()
export class TreasuryOpsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/treasury`;
  private readonly bankingBase = `${environment.apiBaseUrl}/banking`;

  // --- Balances and movements ---

  getBalances(date?: string): Observable<ApiResponse<BankBalanceSnapshot[]>> {
    return this.http.get<ApiResponse<BankBalanceSnapshot[]>>(`${this.base}/balances`, {
      params: date ? toHttpParams({ date }) : undefined,
    });
  }

  getBankAccountBalances(
    id: string,
    params?: { from_date?: string | null; to_date?: string | null },
  ): Observable<ApiResponse<BankAccountBalanceReport>> {
    return this.http.get<ApiResponse<BankAccountBalanceReport>>(`${this.base}/bank-accounts/${id}/balances`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMovements(params?: QueryFilterParams & { movement_type?: TreasuryMovementType; bank_account_id?: string }): Observable<PaginatedResponse<TreasuryMovement>> {
    return this.http.get<PaginatedResponse<TreasuryMovement>>(`${this.base}/movements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  transfer(payload: TransferPayload): Observable<ApiResponse<TreasuryMovement>> {
    return this.http.post<ApiResponse<TreasuryMovement>>(`${this.base}/transfers`, payload);
  }

  postBankCharge(bankAccountId: string, payload: BankChargePayload): Observable<ApiResponse<TreasuryMovement>> {
    return this.http.post<ApiResponse<TreasuryMovement>>(`${this.base}/bank-accounts/${bankAccountId}/charges`, payload);
  }

  // --- Cash registers ---

  getCashRegisters(params?: QueryFilterParams): Observable<PaginatedResponse<CashRegister>> {
    return this.http.get<PaginatedResponse<CashRegister>>(`${this.base}/cash-registers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCashRegister(id: string): Observable<ApiResponse<CashRegister>> {
    return this.http.get<ApiResponse<CashRegister>>(`${this.base}/cash-registers/${id}`);
  }

  createCashRegister(payload: CreateCashRegisterPayload): Observable<ApiResponse<CashRegister>> {
    return this.http.post<ApiResponse<CashRegister>>(`${this.base}/cash-registers`, payload);
  }

  getCashRegisterMovements(id: string, params?: QueryFilterParams): Observable<PaginatedResponse<CashRegisterMovement>> {
    return this.http.get<PaginatedResponse<CashRegisterMovement>>(`${this.base}/cash-registers/${id}/movements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  addCashRegisterMovement(
    id: string,
    payload: CashRegisterMovementPayload,
  ): Observable<ApiResponse<CashRegisterMovement>> {
    return this.http.post<ApiResponse<CashRegisterMovement>>(`${this.base}/cash-registers/${id}/movements`, payload);
  }

  closeCashRegisterDay(id: string, payload: CashRegisterClosePayload): Observable<ApiResponse<CashRegisterClosing>> {
    return this.http.post<ApiResponse<CashRegisterClosing>>(`${this.base}/cash-registers/${id}/close`, payload);
  }

  getCashRegisterClosings(id: string, params?: QueryFilterParams): Observable<PaginatedResponse<CashRegisterClosing>> {
    return this.http.get<PaginatedResponse<CashRegisterClosing>>(`${this.base}/cash-registers/${id}/closings`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // --- Payment proposals ---

  getPaymentProposals(params?: QueryFilterParams & { status?: PaymentProposalStatus }): Observable<PaginatedResponse<PaymentProposal>> {
    return this.http.get<PaginatedResponse<PaymentProposal>>(`${this.base}/payment-proposals`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getPaymentProposal(id: string): Observable<ApiResponse<PaymentProposal>> {
    return this.http.get<ApiResponse<PaymentProposal>>(`${this.base}/payment-proposals/${id}`);
  }

  createPaymentProposal(
    payload: CreatePaymentProposalPayload,
  ): Observable<ApiResponse<PaymentProposal> & { meta: { excluded: PaymentProposalExcluded[] } }> {
    return this.http.post<ApiResponse<PaymentProposal> & { meta: { excluded: PaymentProposalExcluded[] } }>(
      `${this.base}/payment-proposals`,
      payload,
    );
  }

  /** The approver must differ from the author of the proposal (403 otherwise). */
  approvePaymentProposal(id: string): Observable<ApiResponse<PaymentProposal>> {
    return this.http.post<ApiResponse<PaymentProposal>>(`${this.base}/payment-proposals/${id}/approve`, {});
  }

  rejectPaymentProposal(id: string, reason: string): Observable<ApiResponse<PaymentProposal>> {
    return this.http.post<ApiResponse<PaymentProposal>>(`${this.base}/payment-proposals/${id}/reject`, { reason });
  }

  confirmPaymentBatch(
    id: string,
    payload: { bank_reference: string; value_date?: string | null },
  ): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/payment-batches/${id}/confirm`, payload);
  }

  applyPain002(id: string, xml: string): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/payment-batches/${id}/pain002`, { xml });
  }

  // --- Reconciliation ---

  getReconciliationRules(params?: QueryFilterParams): Observable<PaginatedResponse<ReconciliationRule>> {
    return this.http.get<PaginatedResponse<ReconciliationRule>>(`${this.bankingBase}/reconciliation-rules`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createReconciliationRule(payload: ReconciliationRulePayload): Observable<ApiResponse<ReconciliationRule>> {
    return this.http.post<ApiResponse<ReconciliationRule>>(`${this.bankingBase}/reconciliation-rules`, payload);
  }

  updateReconciliationRule(
    ruleId: string,
    payload: ReconciliationRulePayload,
  ): Observable<ApiResponse<ReconciliationRule>> {
    return this.http.put<ApiResponse<ReconciliationRule>>(`${this.bankingBase}/reconciliation-rules/${ruleId}`, payload);
  }

  deleteReconciliationRule(ruleId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.bankingBase}/reconciliation-rules/${ruleId}`);
  }

  getReconciliations(): Observable<unknown> {
    return this.http.get<unknown>(`${this.base}/reconciliations`);
  }

  autoReconcileStatement(bankStatementId: string): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(`${this.base}/reconciliations/auto-reconcile`, {
      bank_statement_id: bankStatementId,
    });
  }

  matchReconciliationLine(lineId: string, payload: ManualReconciliationMatchPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/reconciliations/lines/${lineId}/match`, payload);
  }

  approveReconciliation(id: string): Observable<BankReconciliation> {
    return this.http.post<BankReconciliation>(`${this.base}/reconciliations/${id}/approve`, {});
  }

  // --- FX ---

  getFxExposure(params?: { as_of_date?: string; company_id?: string }): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/fx/exposure`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** Revalues the foreign-currency bank accounts at a period end. The API refuses a client-sent `spot_rate` (422). */
  revalueBankAccounts(payload: FxBankRevaluationPayload): Observable<ApiResponse<FxBankRevaluation[]>> {
    return this.http.post<ApiResponse<FxBankRevaluation[]>>(`${this.base}/fx/revalue`, payload);
  }

  // --- Liquidity ---

  getLiquidityForecast(params?: LiquidityForecastParams, scenarios: string[] = []): Observable<ApiResponse<LiquidityForecast>> {
    let httpParams: HttpParams = params ? toHttpParams(params) : new HttpParams();
    for (const code of scenarios) {
      httpParams = httpParams.append('scenarios[]', code);
    }
    return this.http.get<ApiResponse<LiquidityForecast>>(`${this.base}/liquidity/forecast`, { params: httpParams });
  }

  getForecastScenarios(params?: QueryFilterParams): Observable<PaginatedResponse<ForecastScenario>> {
    return this.http.get<PaginatedResponse<ForecastScenario>>(`${this.base}/forecast-scenarios`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createForecastScenario(payload: ForecastScenarioPayload): Observable<ApiResponse<ForecastScenario>> {
    return this.http.post<ApiResponse<ForecastScenario>>(`${this.base}/forecast-scenarios`, payload);
  }

  getRecurringItems(params?: QueryFilterParams): Observable<PaginatedResponse<RecurringCashItem>> {
    return this.http.get<PaginatedResponse<RecurringCashItem>>(`${this.base}/recurring-items`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createRecurringItem(payload: RecurringCashItemPayload): Observable<ApiResponse<RecurringCashItem>> {
    return this.http.post<ApiResponse<RecurringCashItem>>(`${this.base}/recurring-items`, payload);
  }

  deleteRecurringItem(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/recurring-items/${id}`);
  }

  evaluateForecastDeficits(id: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/cash-forecasts/${id}/evaluate-deficits`);
  }

  getKpis(params?: { as_of_date?: string | null; period_days?: number | null; currency?: string | null }): Observable<ApiResponse<TreasuryKpis>> {
    return this.http.get<ApiResponse<TreasuryKpis>>(`${this.base}/kpis`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCashPosition(): Observable<ApiResponse<TreasuryCashPosition>> {
    return this.http.get<ApiResponse<TreasuryCashPosition>>(`${this.base}/positions/cash`);
  }

  getIntradayPosition(params?: { company_id?: string; currency?: string }): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/positions/intraday`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getLiquidityBuffer(companyId?: string): Observable<LiquidityBuffer> {
    return this.http.get<LiquidityBuffer>(`${this.base}/positions/buffer`, {
      params: companyId ? toHttpParams({ company_id: companyId }) : undefined,
    });
  }

  getWorkingCapital(params?: { metric_date?: string; company_id?: string }): Observable<WorkingCapitalMetrics> {
    return this.http.get<WorkingCapitalMetrics>(`${this.base}/liquidity/working-capital`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  sweepCashPool(poolId: string): Observable<{ message: string; transfers_count: number; transfers: IntercompanyTransfer[] }> {
    return this.http.post<{ message: string; transfers_count: number; transfers: IntercompanyTransfer[] }>(
      `${this.base}/liquidity/pools/${poolId}/sweep`,
      {},
    );
  }

  intercompanyTransfer(payload: IntercompanyTransferPayload): Observable<IntercompanyTransfer> {
    return this.http.post<IntercompanyTransfer>(`${this.base}/liquidity/intercompany-transfer`, payload);
  }

  checkIban(iban: string): Observable<ApiResponse<IbanCheckResult>> {
    return this.http.post<ApiResponse<IbanCheckResult>>(`${this.base}/iban/check`, { iban });
  }

  // --- Statement import (JSON) ---

  importStatementLines(payload: Record<string, unknown>): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/statements/import`, payload);
  }

  // --- Open banking ---

  createOpenBankingConsent(iban: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/open-banking/consents`, { iban });
  }

  getOpenBankingConsentAccount(id: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/open-banking/consents/${id}/account`);
  }

  createOpenBankingPayment(payload: {
    consent_id: string;
    creditor_iban: string;
    creditor_name: string;
    amount: number;
    currency: string;
    remittance_information?: string | null;
    passive_invoice_id?: string | null;
  }): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/open-banking/payments`, payload);
  }

  getOpenBankingPayment(id: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/open-banking/payments/${id}`);
  }

  // --- Ri.Ba. ---

  getRibaBatches(params?: QueryFilterParams & { status?: string | null; bank_account_id?: string | null }): Observable<PaginatedResponse<RibaBatchSummary>> {
    return this.http.get<PaginatedResponse<RibaBatchSummary>>(`${this.base}/riba/batches`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getRibaBatch(id: string): Observable<ApiResponse<RibaBatchDetail>> {
    return this.http.get<ApiResponse<RibaBatchDetail>>(`${this.base}/riba/batches/${id}`);
  }

  createRibaBatch(payload: CreateRibaBatchPayload): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/riba/batches`, payload);
  }

  exportRibaBatch(id: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/riba/batches/${id}/export`, {});
  }

  downloadRibaBatchFile(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/riba/batches/${id}/file`, { responseType: 'blob' });
  }

  markRibaReceiptPaid(id: string, paidAt: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/riba/receipts/${id}/paid`, { paid_at: paidAt });
  }

  markRibaReceiptUnpaid(
    id: string,
    payload: { reason: string; unpaid_at: string; fee?: number | null },
  ): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/riba/receipts/${id}/unpaid`, payload);
  }

  getRibaPortfolio(params?: {
    bank_account_id?: string | null;
    due_from?: string | null;
    due_to?: string | null;
  }): Observable<ApiResponse<RibaPortfolio>> {
    return this.http.get<ApiResponse<RibaPortfolio>>(`${this.base}/riba/portfolio`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // --- Receivable collections ---

  getCollections(params?: QueryFilterParams & { status?: string; customer_id?: string }): Observable<PaginatedResponse<ReceivableCollection>> {
    return this.http.get<PaginatedResponse<ReceivableCollection>>(`${this.base}/collections`, { params: params ? toHttpParams(params) : undefined });
  }

  getCollectionsAging(companyId?: string): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/collections/aging`, {
      params: companyId ? toHttpParams({ company_id: companyId }) : undefined,
    });
  }

  getDunningReadiness(): Observable<DunningReadiness> {
    return this.http.get<DunningReadiness>(`${this.base}/collections/dunning-readiness`);
  }

  recordCollection(id: string, payload: { amount: number; collection_date?: string | null }): Observable<ReceivableCollection> {
    return this.http.post<ReceivableCollection>(`${this.base}/collections/${id}/record`, payload);
  }
}
