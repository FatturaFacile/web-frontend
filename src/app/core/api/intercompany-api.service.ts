import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  IcApiEnvelope,
  IcCashFlow,
  IcEliminationLedger,
  IcLookups,
  IcMatrix,
  IcMirrorMode,
  IcNciSchedule,
  IcNettingPayload,
  IcNettingRun,
  IcNettingStatus,
  IcPackage,
  IcPackageFormat,
  IcPartyLink,
  IcPartyLinkPayload,
  IcPeriodRate,
  IcPeriodRateFilters,
  IcPeriodRatePayload,
  IcReconciliationBatch,
  IcReconciliationItem,
  IcReconciliationItemFilters,
  IcRunStatus,
  IcRunWorkflow,
  IcScanResult,
  IcScopeValidation,
  IcSettings,
  IcSettingsPayload,
  IcShareholdings,
  IcStandard,
  IcStatementKind,
  IcStatements,
  IcTransaction,
  IcTransactionFilters,
  IcTransactionMeta,
} from '../models';

type Envelope<T, M = Record<string, never>> = Observable<IcApiEnvelope<T, M>>;

/** Intercompany mirror postings, reciprocal reconciliation, period rates, run workflow and consolidated package (`/intercompany`). */
@Service()
export class IntercompanyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/intercompany`;

  getLookups(): Envelope<IcLookups> {
    return this.http.get<IcApiEnvelope<IcLookups>>(`${this.base}/lookups`);
  }

  // --- Settings, party links, period rates ---

  getSettings(groupId: string): Envelope<IcSettings> {
    return this.http.get<IcApiEnvelope<IcSettings>>(`${this.base}/groups/${groupId}/settings`);
  }

  saveSettings(groupId: string, payload: IcSettingsPayload): Envelope<IcSettings> {
    return this.http.put<IcApiEnvelope<IcSettings>>(
      `${this.base}/groups/${groupId}/settings`,
      payload,
    );
  }

  getPartyLinks(groupId: string): Envelope<IcPartyLink[]> {
    return this.http.get<IcApiEnvelope<IcPartyLink[]>>(
      `${this.base}/groups/${groupId}/party-links`,
    );
  }

  createPartyLink(groupId: string, payload: IcPartyLinkPayload): Envelope<IcPartyLink> {
    return this.http.post<IcApiEnvelope<IcPartyLink>>(
      `${this.base}/groups/${groupId}/party-links`,
      payload,
    );
  }

  deletePartyLink(id: string): Envelope<null> {
    return this.http.delete<IcApiEnvelope<null>>(`${this.base}/party-links/${id}`);
  }

  getPeriodRates(groupId: string, filters: IcPeriodRateFilters = {}): Envelope<IcPeriodRate[]> {
    return this.http.get<IcApiEnvelope<IcPeriodRate[]>>(
      `${this.base}/groups/${groupId}/period-rates`,
      {
        params: toHttpParams(filters),
      },
    );
  }

  savePeriodRate(groupId: string, payload: IcPeriodRatePayload): Envelope<IcPeriodRate> {
    return this.http.post<IcApiEnvelope<IcPeriodRate>>(
      `${this.base}/groups/${groupId}/period-rates`,
      payload,
    );
  }

  deletePeriodRate(id: string): Envelope<null> {
    return this.http.delete<IcApiEnvelope<null>>(`${this.base}/period-rates/${id}`);
  }

  // --- Transactions (mirror postings) ---

  getTransactions(
    groupId: string,
    filters: IcTransactionFilters = {},
  ): Envelope<IcTransaction[], IcTransactionMeta> {
    return this.http.get<IcApiEnvelope<IcTransaction[], IcTransactionMeta>>(
      `${this.base}/groups/${groupId}/transactions`,
      {
        params: toHttpParams(filters),
      },
    );
  }

  getTransaction(id: string): Envelope<IcTransaction> {
    return this.http.get<IcApiEnvelope<IcTransaction>>(`${this.base}/transactions/${id}`);
  }

  scanTransactions(
    groupId: string,
    range: { from?: string; to?: string } = {},
  ): Envelope<IcScanResult> {
    return this.http.post<IcApiEnvelope<IcScanResult>>(
      `${this.base}/groups/${groupId}/transactions/scan`,
      range,
    );
  }

  mirrorTransaction(
    id: string,
    body: { mode?: IcMirrorMode; expected_version?: number } = {},
  ): Envelope<IcTransaction> {
    return this.http.post<IcApiEnvelope<IcTransaction>>(
      `${this.base}/transactions/${id}/mirror`,
      body,
    );
  }

  confirmTransaction(id: string, expectedVersion?: number): Envelope<IcTransaction> {
    return this.http.post<IcApiEnvelope<IcTransaction>>(`${this.base}/transactions/${id}/confirm`, {
      expected_version: expectedVersion,
    });
  }

  reverseTransaction(
    id: string,
    reason: string,
    expectedVersion?: number,
  ): Envelope<IcTransaction> {
    return this.http.post<IcApiEnvelope<IcTransaction>>(`${this.base}/transactions/${id}/reverse`, {
      reason,
      expected_version: expectedVersion,
    });
  }

  syncPayment(id: string): Envelope<IcTransaction> {
    return this.http.post<IcApiEnvelope<IcTransaction>>(
      `${this.base}/transactions/${id}/sync-payment`,
      {},
    );
  }

  // --- Netting ---

  getNettingRuns(groupId: string, status?: IcNettingStatus): Envelope<IcNettingRun[]> {
    return this.http.get<IcApiEnvelope<IcNettingRun[]>>(`${this.base}/groups/${groupId}/netting`, {
      params: toHttpParams({ status }),
    });
  }

  proposeNetting(groupId: string, payload: IcNettingPayload): Envelope<IcNettingRun> {
    return this.http.post<IcApiEnvelope<IcNettingRun>>(
      `${this.base}/groups/${groupId}/netting`,
      payload,
    );
  }

  confirmNetting(id: string, expectedVersion?: number): Envelope<IcNettingRun> {
    return this.http.post<IcApiEnvelope<IcNettingRun>>(`${this.base}/netting/${id}/confirm`, {
      expected_version: expectedVersion,
    });
  }

  cancelNetting(id: string, reason: string): Envelope<IcNettingRun> {
    return this.http.post<IcApiEnvelope<IcNettingRun>>(`${this.base}/netting/${id}/cancel`, {
      reason,
    });
  }

  // --- Reciprocal reconciliation ---

  getBatches(groupId: string): Envelope<IcReconciliationBatch[]> {
    return this.http.get<IcApiEnvelope<IcReconciliationBatch[]>>(
      `${this.base}/groups/${groupId}/reconciliation/batches`,
    );
  }

  createBatch(
    groupId: string,
    asOfDate: string,
    autoMatch = true,
  ): Envelope<IcReconciliationBatch> {
    return this.http.post<IcApiEnvelope<IcReconciliationBatch>>(
      `${this.base}/groups/${groupId}/reconciliation/batches`,
      {
        as_of_date: asOfDate,
        auto_match: autoMatch,
      },
    );
  }

  getBatch(id: string, filters: IcReconciliationItemFilters = {}): Envelope<IcReconciliationBatch> {
    return this.http.get<IcApiEnvelope<IcReconciliationBatch>>(
      `${this.base}/reconciliation/batches/${id}`,
      {
        params: toHttpParams(filters),
      },
    );
  }

  getMatrix(groupId: string, asOfDate?: string): Envelope<IcMatrix> {
    return this.http.get<IcApiEnvelope<IcMatrix>>(
      `${this.base}/groups/${groupId}/reconciliation/matrix`,
      {
        params: toHttpParams({ as_of_date: asOfDate }),
      },
    );
  }

  matchItem(id: string, counterpartDocumentId: string): Envelope<IcReconciliationItem> {
    return this.http.post<IcApiEnvelope<IcReconciliationItem>>(
      `${this.base}/reconciliation/items/${id}/match`,
      {
        counterpart_document_id: counterpartDocumentId,
      },
    );
  }

  unmatchItem(id: string): Envelope<IcReconciliationItem> {
    return this.http.post<IcApiEnvelope<IcReconciliationItem>>(
      `${this.base}/reconciliation/items/${id}/unmatch`,
      {},
    );
  }

  disputeItem(id: string, reason: string): Envelope<IcReconciliationItem> {
    return this.http.post<IcApiEnvelope<IcReconciliationItem>>(
      `${this.base}/reconciliation/items/${id}/dispute`,
      { reason },
    );
  }

  writeOffItem(id: string, reason: string): Envelope<IcReconciliationItem> {
    return this.http.post<IcApiEnvelope<IcReconciliationItem>>(
      `${this.base}/reconciliation/items/${id}/write-off`,
      { reason },
    );
  }

  adjustItem(id: string, reason: string, adjustmentAmount: string): Envelope<IcReconciliationItem> {
    return this.http.post<IcApiEnvelope<IcReconciliationItem>>(
      `${this.base}/reconciliation/items/${id}/adjust`,
      {
        reason,
        adjustment_amount: adjustmentAmount,
      },
    );
  }

  // --- Run workflow and analytics ---

  getWorkflow(runId: string): Envelope<IcRunWorkflow> {
    return this.http.get<IcApiEnvelope<IcRunWorkflow>>(`${this.base}/runs/${runId}/workflow`);
  }

  advanceRun(
    runId: string,
    to: Exclude<IcRunStatus, 'draft'>,
    expectedVersion: number,
  ): Envelope<IcRunWorkflow> {
    return this.http.post<IcApiEnvelope<IcRunWorkflow>>(
      `${this.base}/runs/${runId}/workflow/advance`,
      {
        to,
        expected_version: expectedVersion,
      },
    );
  }

  reopenRun(runId: string, reason: string, expectedVersion: number): Envelope<IcRunWorkflow> {
    return this.http.post<IcApiEnvelope<IcRunWorkflow>>(`${this.base}/runs/${runId}/reopen`, {
      reason,
      expected_version: expectedVersion,
    });
  }

  getScopeValidation(runId: string): Envelope<IcScopeValidation> {
    return this.http.get<IcApiEnvelope<IcScopeValidation>>(
      `${this.base}/runs/${runId}/scope-validation`,
    );
  }

  getEliminationLedger(
    runId: string,
    filters: { type?: string; entity_tenant_id?: string } = {},
  ): Envelope<IcEliminationLedger> {
    return this.http.get<IcApiEnvelope<IcEliminationLedger>>(
      `${this.base}/runs/${runId}/elimination-ledger`,
      {
        params: toHttpParams(filters),
      },
    );
  }

  getNciSchedule(runId: string): Envelope<IcNciSchedule> {
    return this.http.get<IcApiEnvelope<IcNciSchedule>>(`${this.base}/runs/${runId}/nci-schedule`);
  }

  getShareholdings(runId: string): Envelope<IcShareholdings> {
    return this.http.get<IcApiEnvelope<IcShareholdings>>(
      `${this.base}/runs/${runId}/shareholdings`,
    );
  }

  getStatements(
    runId: string,
    standard: IcStandard,
    statement: IcStatementKind = 'all',
  ): Envelope<IcStatements> {
    return this.http.get<IcApiEnvelope<IcStatements>>(`${this.base}/runs/${runId}/statements`, {
      params: toHttpParams({ standard, statement }),
    });
  }

  getCashFlow(runId: string, standard?: IcStandard): Envelope<IcCashFlow> {
    return this.http.get<IcApiEnvelope<IcCashFlow>>(`${this.base}/runs/${runId}/cash-flow`, {
      params: toHttpParams({ standard }),
    });
  }

  // --- Consolidated package ---

  getPackages(runId: string): Envelope<IcPackage[]> {
    return this.http.get<IcApiEnvelope<IcPackage[]>>(`${this.base}/runs/${runId}/packages`);
  }

  createPackage(runId: string, standard: IcStandard): Envelope<IcPackage> {
    return this.http.post<IcApiEnvelope<IcPackage>>(`${this.base}/runs/${runId}/packages`, {
      standard,
    });
  }

  getPackage(id: string): Envelope<IcPackage> {
    return this.http.get<IcApiEnvelope<IcPackage>>(`${this.base}/packages/${id}`);
  }

  downloadPackage(id: string, format: IcPackageFormat): Observable<Blob> {
    return this.http.get(`${this.base}/packages/${id}/download`, {
      params: toHttpParams({ format }),
      responseType: 'blob',
    });
  }
}
