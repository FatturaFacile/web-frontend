import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, PaginatedResponse } from '../models/api.models';
import {
  CsvProfile,
  F24Delegation,
  F24Payload,
  F24Section,
  F24TaxCode,
  F24ValidationResult,
  GeneratedPaymentFlow,
  OpenBankingConnection,
  OpenBankingStatus,
  OpenBankingSyncRun,
  PaymentFlowInfo,
  PaymentFlowPayload,
  ReconciliationProposal,
  SmartReconciliationFilters,
  SmartReconciliationLine,
  SmartReconciliationSummary,
  SmartRunResult,
  StatementImportOptions,
  StatementImportSummary,
} from '../models/treasury-banking.model';

/**
 * Treasury banking workspace (#268): outgoing payment files (pain.001.001.09 CH, pain.001.001.03 SEPA, CBI), Modello
 * F24 telematico, statement imports (camt.053, camt.054, CBI, CSV), PSD2 / SIX bLink synchronisation and the smart
 * reconciliation workbench.
 */
@Service()
export class TreasuryBankingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/treasury`;

  // Payment flows
  getPaymentFlows(): Observable<ApiResponse<PaymentFlowInfo[]>> {
    return this.http.get<ApiResponse<PaymentFlowInfo[]>>(`${this.base}/payment-flows`);
  }

  previewPaymentFlow(payload: PaymentFlowPayload): Observable<ApiResponse<GeneratedPaymentFlow>> {
    return this.http.post<ApiResponse<GeneratedPaymentFlow>>(
      `${this.base}/payment-flows/preview`,
      payload,
    );
  }

  createPaymentFlowBatch(
    payload: PaymentFlowPayload,
  ): Observable<ApiResponse<{ id: string; batch_reference: string; status: string }>> {
    return this.http.post<ApiResponse<{ id: string; batch_reference: string; status: string }>>(
      `${this.base}/payment-flows/batches`,
      payload,
    );
  }

  // Modello F24
  getF24TaxCodes(section?: F24Section): Observable<ApiResponse<F24TaxCode[]>> {
    return this.http.get<ApiResponse<F24TaxCode[]>>(`${this.base}/f24/tax-codes`, {
      params: section ? toHttpParams({ section }) : undefined,
    });
  }

  getF24Delegations(status?: string): Observable<ApiResponse<F24Delegation[]>> {
    return this.http.get<ApiResponse<F24Delegation[]>>(`${this.base}/f24/delegations`, {
      params: status ? toHttpParams({ status }) : undefined,
    });
  }

  getF24Delegation(id: string): Observable<ApiResponse<F24Delegation>> {
    return this.http.get<ApiResponse<F24Delegation>>(`${this.base}/f24/delegations/${id}`);
  }

  createF24Delegation(payload: F24Payload): Observable<ApiResponse<F24Delegation>> {
    return this.http.post<ApiResponse<F24Delegation>>(`${this.base}/f24/delegations`, payload);
  }

  updateF24Delegation(id: string, payload: F24Payload): Observable<ApiResponse<F24Delegation>> {
    return this.http.put<ApiResponse<F24Delegation>>(`${this.base}/f24/delegations/${id}`, payload);
  }

  deleteF24Delegation(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/f24/delegations/${id}`);
  }

  validateF24Delegation(id: string): Observable<ApiResponse<F24ValidationResult>> {
    return this.http.post<ApiResponse<F24ValidationResult>>(
      `${this.base}/f24/delegations/${id}/validate`,
      {},
    );
  }

  generateF24File(id: string): Observable<ApiResponse<F24Delegation>> {
    return this.http.post<ApiResponse<F24Delegation>>(
      `${this.base}/f24/delegations/${id}/generate`,
      {},
    );
  }

  downloadF24File(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/f24/delegations/${id}/download`, { responseType: 'blob' });
  }

  markF24Paid(id: string): Observable<ApiResponse<F24Delegation>> {
    return this.http.post<ApiResponse<F24Delegation>>(
      `${this.base}/f24/delegations/${id}/mark-paid`,
      {},
    );
  }

  // Statement imports
  importStatement(
    file: File,
    options: StatementImportOptions,
  ): Observable<ApiResponse<StatementImportSummary>> {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('format', options.format);
    body.append('auto_reconcile', options.autoReconcile ? '1' : '0');

    if (options.format === 'csv') {
      if (options.csvProfileId) {
        body.append('csv_profile_id', options.csvProfileId);
      } else if (options.csv) {
        const csv = options.csv;
        body.append('csv[account_iban]', csv.account_iban);
        body.append('csv[currency]', csv.currency);
        body.append('csv[delimiter]', csv.delimiter);
        body.append('csv[has_header]', csv.has_header ? '1' : '0');
        body.append('csv[date_format]', csv.date_format);
        body.append('csv[decimal_separator]', csv.decimal_separator);
        body.append('csv[thousands_separator]', csv.thousands_separator ?? '');
        for (const [field, column] of Object.entries(csv.columns)) {
          if (column) {
            body.append(`csv[columns][${field}]`, column);
          }
        }
      }
    }

    return this.http.post<ApiResponse<StatementImportSummary>>(
      `${this.base}/statement-imports`,
      body,
    );
  }

  getCsvProfiles(): Observable<ApiResponse<CsvProfile[]>> {
    return this.http.get<ApiResponse<CsvProfile[]>>(`${this.base}/csv-profiles`);
  }

  saveCsvProfile(
    name: string,
    mapping: CsvProfile | Omit<CsvProfile, 'id'>,
  ): Observable<ApiResponse<CsvProfile>> {
    return this.http.post<ApiResponse<CsvProfile>>(`${this.base}/csv-profiles`, {
      ...mapping,
      name,
    });
  }

  deleteCsvProfile(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/csv-profiles/${id}`);
  }

  // Open banking (PSD2 / SIX bLink)
  getOpenBankingStatus(): Observable<ApiResponse<OpenBankingStatus>> {
    return this.http.get<ApiResponse<OpenBankingStatus>>(`${this.base}/open-banking/status`);
  }

  getOpenBankingConnections(): Observable<ApiResponse<OpenBankingConnection[]>> {
    return this.http.get<ApiResponse<OpenBankingConnection[]>>(
      `${this.base}/open-banking/consents`,
    );
  }

  createOpenBankingConsent(
    iban: string,
  ): Observable<ApiResponse<{ id: string; iban: string; status: string }>> {
    return this.http.post<ApiResponse<{ id: string; iban: string; status: string }>>(
      `${this.base}/open-banking/consents`,
      { iban },
    );
  }

  syncOpenBanking(
    consentId: string,
    range: { from?: string | null; to?: string | null } = {},
  ): Observable<ApiResponse<OpenBankingSyncRun>> {
    return this.http.post<ApiResponse<OpenBankingSyncRun>>(
      `${this.base}/open-banking/consents/${consentId}/sync`,
      {
        from: range.from || null,
        to: range.to || null,
      },
    );
  }

  getOpenBankingSyncRuns(): Observable<ApiResponse<OpenBankingSyncRun[]>> {
    return this.http.get<ApiResponse<OpenBankingSyncRun[]>>(`${this.base}/open-banking/sync-runs`);
  }

  // Smart reconciliation
  getSmartSummary(): Observable<ApiResponse<SmartReconciliationSummary>> {
    return this.http.get<ApiResponse<SmartReconciliationSummary>>(
      `${this.base}/smart-reconciliation/summary`,
    );
  }

  getSmartLines(
    filters: SmartReconciliationFilters,
  ): Observable<PaginatedResponse<SmartReconciliationLine>> {
    return this.http.get<PaginatedResponse<SmartReconciliationLine>>(
      `${this.base}/smart-reconciliation/lines`,
      {
        params: toHttpParams({
          ...filters,
          with_proposals: filters.with_proposals ? 1 : undefined,
        }),
      },
    );
  }

  runSmartReconciliation(
    statementId: string,
    autoApply: boolean,
  ): Observable<ApiResponse<SmartRunResult>> {
    return this.http.post<ApiResponse<SmartRunResult>>(`${this.base}/smart-reconciliation/run`, {
      statement_id: statementId,
      auto_apply: autoApply,
    });
  }

  refreshSmartLine(lineId: string): Observable<ApiResponse<SmartReconciliationLine>> {
    return this.http.post<ApiResponse<SmartReconciliationLine>>(
      `${this.base}/smart-reconciliation/lines/${lineId}/refresh`,
      {},
    );
  }

  applyProposal(proposalId: string): Observable<ApiResponse<SmartReconciliationLine>> {
    return this.http.post<ApiResponse<SmartReconciliationLine>>(
      `${this.base}/smart-reconciliation/proposals/${proposalId}/apply`,
      {},
    );
  }

  rejectProposal(proposalId: string): Observable<ApiResponse<ReconciliationProposal>> {
    return this.http.post<ApiResponse<ReconciliationProposal>>(
      `${this.base}/smart-reconciliation/proposals/${proposalId}/reject`,
      {},
    );
  }

  unmatchSmartLine(lineId: string): Observable<ApiResponse<SmartReconciliationLine>> {
    return this.http.post<ApiResponse<SmartReconciliationLine>>(
      `${this.base}/smart-reconciliation/lines/${lineId}/unmatch`,
      {},
    );
  }
}
