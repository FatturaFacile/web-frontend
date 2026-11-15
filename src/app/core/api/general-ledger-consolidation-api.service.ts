import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  ChartAccountDetail,
  ConsolidatedBalanceSheet,
  ConsolidatedIncomeStatement,
  ConsolidatedReclassifiedStatement,
  ConsolidatedTrialBalance,
  ConsolidationAcquisition,
  ConsolidationAcquisitionPayload,
  ConsolidationAccountMapping,
  ConsolidationAccountMappingPayload,
  ConsolidationGroup,
  ConsolidationGroupPayload,
  ConsolidationMemberPayload,
  ConsolidationRun,
  ConsolidationRunVerification,
  GoodwillImpairmentPayload,
  GoodwillSchedule,
  IntercompanyMapping,
  IntercompanyMappingPayload,
  IntercompanyReconciliation,
  IntercompanyRelation,
  IntercompanyRelationPayload,
  IntragroupDividend,
  IntragroupDividendPayload,
  IntragroupTransaction,
  IntragroupTransactionPayload,
  PaginatedResponse,
} from '../models';

/** Consolidation endpoints of the general ledger: groups, members, intercompany relations, inputs, runs and consolidated statements. */
@Service()
export class GeneralLedgerConsolidationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/general-ledger/consolidation`;
  private readonly ledgerBase = `${environment.apiBaseUrl}/general-ledger`;

  // --- Groups and members ---

  getGroups(): Observable<ApiResponse<ConsolidationGroup[]>> {
    return this.http.get<ApiResponse<ConsolidationGroup[]>>(`${this.base}/groups`);
  }

  getGroup(id: string): Observable<ApiResponse<ConsolidationGroup>> {
    return this.http.get<ApiResponse<ConsolidationGroup>>(`${this.base}/groups/${id}`);
  }

  createGroup(payload: ConsolidationGroupPayload): Observable<ApiResponse<ConsolidationGroup>> {
    return this.http.post<ApiResponse<ConsolidationGroup>>(`${this.base}/groups`, payload);
  }

  updateGroup(id: string, payload: ConsolidationGroupPayload): Observable<ApiResponse<ConsolidationGroup>> {
    return this.http.put<ApiResponse<ConsolidationGroup>>(`${this.base}/groups/${id}`, payload);
  }

  deleteGroup(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/groups/${id}`);
  }

  addMember(groupId: string, payload: ConsolidationMemberPayload): Observable<ApiResponse<ConsolidationGroup>> {
    return this.http.post<ApiResponse<ConsolidationGroup>>(`${this.base}/groups/${groupId}/members`, payload);
  }

  updateMember(groupId: string, memberId: string, payload: ConsolidationMemberPayload): Observable<ApiResponse<ConsolidationGroup>> {
    return this.http.put<ApiResponse<ConsolidationGroup>>(`${this.base}/groups/${groupId}/members/${memberId}`, payload);
  }

  removeMember(groupId: string, memberId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/groups/${groupId}/members/${memberId}`);
  }

  // --- Intercompany relations and their account mappings ---

  createRelation(groupId: string, payload: IntercompanyRelationPayload): Observable<ApiResponse<IntercompanyRelation>> {
    return this.http.post<ApiResponse<IntercompanyRelation>>(`${this.base}/groups/${groupId}/relations`, payload);
  }

  deleteRelation(relationId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/relations/${relationId}`);
  }

  createRelationMapping(relationId: string, payload: IntercompanyMappingPayload): Observable<ApiResponse<IntercompanyMapping>> {
    return this.http.post<ApiResponse<IntercompanyMapping>>(`${this.base}/relations/${relationId}/mappings`, payload);
  }

  deleteRelationMapping(mappingId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/mappings/${mappingId}`);
  }

  // --- Inputs: account mappings, acquisitions, intragroup transactions and dividends ---

  getAccountMappings(groupId: string): Observable<ApiResponse<ConsolidationAccountMapping[]>> {
    return this.http.get<ApiResponse<ConsolidationAccountMapping[]>>(`${this.base}/groups/${groupId}/account-mappings`);
  }

  createAccountMapping(groupId: string, payload: ConsolidationAccountMappingPayload): Observable<ApiResponse<ConsolidationAccountMapping>> {
    return this.http.post<ApiResponse<ConsolidationAccountMapping>>(`${this.base}/groups/${groupId}/account-mappings`, payload);
  }

  deleteAccountMapping(mappingId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/account-mappings/${mappingId}`);
  }

  getAcquisitions(groupId: string): Observable<ApiResponse<ConsolidationAcquisition[]>> {
    return this.http.get<ApiResponse<ConsolidationAcquisition[]>>(`${this.base}/groups/${groupId}/acquisitions`);
  }

  createAcquisition(groupId: string, payload: ConsolidationAcquisitionPayload): Observable<ApiResponse<ConsolidationAcquisition>> {
    return this.http.post<ApiResponse<ConsolidationAcquisition>>(`${this.base}/groups/${groupId}/acquisitions`, payload);
  }

  createGoodwillImpairment(acquisitionId: string, payload: GoodwillImpairmentPayload): Observable<ApiResponse<ConsolidationAcquisition>> {
    return this.http.post<ApiResponse<ConsolidationAcquisition>>(`${this.base}/acquisitions/${acquisitionId}/impairments`, payload);
  }

  deleteAcquisition(acquisitionId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/acquisitions/${acquisitionId}`);
  }

  getIntragroupTransactions(groupId: string): Observable<ApiResponse<IntragroupTransaction[]>> {
    return this.http.get<ApiResponse<IntragroupTransaction[]>>(`${this.base}/groups/${groupId}/intragroup-transactions`);
  }

  createIntragroupTransaction(groupId: string, payload: IntragroupTransactionPayload): Observable<ApiResponse<IntragroupTransaction>> {
    return this.http.post<ApiResponse<IntragroupTransaction>>(`${this.base}/groups/${groupId}/intragroup-transactions`, payload);
  }

  deleteIntragroupTransaction(transactionId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/intragroup-transactions/${transactionId}`);
  }

  getIntragroupDividends(groupId: string): Observable<ApiResponse<IntragroupDividend[]>> {
    return this.http.get<ApiResponse<IntragroupDividend[]>>(`${this.base}/groups/${groupId}/intragroup-dividends`);
  }

  createIntragroupDividend(groupId: string, payload: IntragroupDividendPayload): Observable<ApiResponse<IntragroupDividend>> {
    return this.http.post<ApiResponse<IntragroupDividend>>(`${this.base}/groups/${groupId}/intragroup-dividends`, payload);
  }

  deleteIntragroupDividend(dividendId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/intragroup-dividends/${dividendId}`);
  }

  // --- Intercompany reconciliation and runs ---

  getIntercompanyReconciliation(groupId: string, fiscalPeriodId: string): Observable<ApiResponse<IntercompanyReconciliation>> {
    return this.http.get<ApiResponse<IntercompanyReconciliation>>(`${this.base}/groups/${groupId}/intercompany-reconciliation`, {
      params: toHttpParams({ fiscal_period_id: fiscalPeriodId }),
    });
  }

  getRuns(groupId: string, fiscalPeriodId?: string | null): Observable<ApiResponse<ConsolidationRun[]>> {
    return this.http.get<ApiResponse<ConsolidationRun[]>>(`${this.base}/groups/${groupId}/runs`, {
      params: fiscalPeriodId ? toHttpParams({ fiscal_period_id: fiscalPeriodId }) : undefined,
    });
  }

  runConsolidation(groupId: string, fiscalPeriodId: string): Observable<ApiResponse<ConsolidationRun>> {
    return this.http.post<ApiResponse<ConsolidationRun>>(`${this.base}/groups/${groupId}/runs`, { fiscal_period_id: fiscalPeriodId });
  }

  getRun(runId: string): Observable<ApiResponse<ConsolidationRun>> {
    return this.http.get<ApiResponse<ConsolidationRun>>(`${this.base}/runs/${runId}`);
  }

  verifyRun(runId: string): Observable<ApiResponse<ConsolidationRunVerification>> {
    return this.http.get<ApiResponse<ConsolidationRunVerification>>(`${this.base}/runs/${runId}/verify`);
  }

  lockRun(runId: string): Observable<ApiResponse<ConsolidationRun>> {
    return this.http.post<ApiResponse<ConsolidationRun>>(`${this.base}/runs/${runId}/lock`, {});
  }

  deleteRun(runId: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/runs/${runId}`);
  }

  // --- Consolidated statements of a run ---

  getRunTrialBalance(runId: string): Observable<ApiResponse<ConsolidatedTrialBalance>> {
    return this.http.get<ApiResponse<ConsolidatedTrialBalance>>(`${this.base}/runs/${runId}/trial-balance`);
  }

  getRunBalanceSheet(runId: string): Observable<ApiResponse<ConsolidatedBalanceSheet>> {
    return this.http.get<ApiResponse<ConsolidatedBalanceSheet>>(`${this.base}/runs/${runId}/balance-sheet`);
  }

  getRunIncomeStatement(runId: string): Observable<ApiResponse<ConsolidatedIncomeStatement>> {
    return this.http.get<ApiResponse<ConsolidatedIncomeStatement>>(`${this.base}/runs/${runId}/income-statement`);
  }

  getRunGoodwillSchedule(runId: string): Observable<ApiResponse<GoodwillSchedule>> {
    return this.http.get<ApiResponse<GoodwillSchedule>>(`${this.base}/runs/${runId}/goodwill-schedule`);
  }

  getRunReclassified(runId: string, schemeId: string): Observable<ApiResponse<ConsolidatedReclassifiedStatement>> {
    return this.http.get<ApiResponse<ConsolidatedReclassifiedStatement>>(`${this.base}/runs/${runId}/reclassified`, {
      params: toHttpParams({ scheme_id: schemeId }),
    });
  }

  // --- Chart of accounts of a member entity ---

  /** The chart of accounts of another entity of the group: the accounts of a mapping or of an intragroup entry belong to it. */
  getMemberAccounts(tenantId: string): Observable<PaginatedResponse<ChartAccountDetail>> {
    return this.http.get<PaginatedResponse<ChartAccountDetail>>(`${this.ledgerBase}/accounts`, {
      params: toHttpParams({ per_page: 500 }),
      headers: new HttpHeaders({ 'X-Tenant-Id': tenantId }),
    });
  }
}
