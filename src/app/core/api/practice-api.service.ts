import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  QueryFilterParams,
  PracticeActivityControlResponse,
  PracticeActivityItem,
  PracticeAppliedRetainer,
  PracticeChecklistRequest,
  PracticeCloseRequest,
  PracticeClosing,
  PracticeClosingOverview,
  PracticeClosingRequest,
  PracticeFeeNoteRequest,
  PracticeRetainer,
  PracticeRetainerApplyRequest,
  PracticeRetainerBalance,
  PracticeRetainerRequest,
  PracticeCaseParty,
  PracticeCasePartyRequest,
  PracticeConflictCheck,
  PracticeConflictCheckRequest,
  PracticeExpense,
  PracticeExpenseRequest,
  PracticeFeeProposal,
  PracticeFeeProposalAcceptRequest,
  PracticeFeeProposalRequest,
  PracticeTrustBalance,
  PracticeTrustPostRequest,
  PracticeTrustPosting,
  PracticeTrustTransaction,
  PracticeTrustTransactionRequest,
} from '../models';

@Service()
export class PracticeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/practice`;

  getActivityControl(params: {
    from: string;
    to: string;
    user_id?: string;
    stale_days?: number;
  }): Observable<ApiResponse<PracticeActivityControlResponse>> {
    let httpParams = new HttpParams().set('from', params.from).set('to', params.to);
    if (params.user_id) httpParams = httpParams.set('user_id', params.user_id);
    if (params.stale_days !== undefined) httpParams = httpParams.set('stale_days', params.stale_days.toString());
    return this.http.get<ApiResponse<PracticeActivityControlResponse>>(`${this.base}/activity-control`, {
      params: httpParams,
    });
  }

  createFeeNoteFromActivities(
    payload: PracticeFeeNoteRequest,
  ): Observable<ApiResponse<{ id: string; status: string }>> {
    return this.http.post<ApiResponse<{ id: string; status: string }>>(
      `${this.base}/fee-notes/from-activities`,
      payload,
    );
  }

  getFeeNoteActivities(feeNoteId: string): Observable<ApiResponse<PracticeActivityItem[]>> {
    return this.http.get<ApiResponse<PracticeActivityItem[]>>(
      `${this.base}/fee-notes/${feeNoteId}/activities`,
    );
  }

  getClosingOverview(params: {
    from: string;
    to: string;
  }): Observable<ApiResponse<PracticeClosingOverview>> {
    const httpParams = new HttpParams().set('from', params.from).set('to', params.to);
    return this.http.get<ApiResponse<PracticeClosingOverview>>(`${this.base}/closing-overview`, {
      params: httpParams,
    });
  }

  openClosing(payload: PracticeClosingRequest): Observable<ApiResponse<PracticeClosing>> {
    return this.http.post<ApiResponse<PracticeClosing>>(`${this.base}/closings`, payload);
  }

  updateClosingChecklist(
    id: string,
    payload: PracticeChecklistRequest,
  ): Observable<ApiResponse<PracticeClosing>> {
    return this.http.put<ApiResponse<PracticeClosing>>(
      `${this.base}/closings/${id}/checklist`,
      payload,
    );
  }

  closePeriod(
    id: string,
    payload: PracticeCloseRequest = {},
  ): Observable<ApiResponse<PracticeClosing>> {
    return this.http.post<ApiResponse<PracticeClosing>>(
      `${this.base}/closings/${id}/close`,
      payload,
    );
  }

  reopenPeriod(id: string): Observable<ApiResponse<PracticeClosing>> {
    return this.http.post<ApiResponse<PracticeClosing>>(
      `${this.base}/closings/${id}/reopen`,
      {},
    );
  }

  /** Retainers, paged on the server; `client_id` and `status` narrow the list, the rest are grid parameters. */
  getRetainers(
    params?: QueryFilterParams & { client_id?: string; status?: string },
  ): Observable<PaginatedResponse<PracticeRetainer>> {
    return this.http.get<PaginatedResponse<PracticeRetainer>>(`${this.base}/retainers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createRetainer(payload: PracticeRetainerRequest): Observable<ApiResponse<PracticeRetainer>> {
    return this.http.post<ApiResponse<PracticeRetainer>>(`${this.base}/retainers`, payload);
  }

  getRetainerBalances(clientId?: string): Observable<ApiResponse<PracticeRetainerBalance[]>> {
    let httpParams = new HttpParams();
    if (clientId) httpParams = httpParams.set('client_id', clientId);
    return this.http.get<ApiResponse<PracticeRetainerBalance[]>>(`${this.base}/retainers/balances`, {
      params: httpParams,
    });
  }

  applyRetainer(
    retainerId: string,
    payload: PracticeRetainerApplyRequest,
  ): Observable<ApiResponse<PracticeAppliedRetainer>> {
    return this.http.post<ApiResponse<PracticeAppliedRetainer>>(
      `${this.base}/retainers/${retainerId}/apply`,
      payload,
    );
  }

  voidRetainer(retainerId: string): Observable<ApiResponse<{ id: string; status: string }>> {
    return this.http.post<ApiResponse<{ id: string; status: string }>>(
      `${this.base}/retainers/${retainerId}/void`,
      {},
    );
  }

  getFeeNoteRetainers(feeNoteId: string): Observable<ApiResponse<PracticeAppliedRetainer[]>> {
    return this.http.get<ApiResponse<PracticeAppliedRetainer[]>>(
      `${this.base}/fee-notes/${feeNoteId}/retainers`,
    );
  }

  // --- Matter expenses ---
  getExpenses(params?: QueryFilterParams & { legal_case_id?: string; is_billed?: boolean }): Observable<PaginatedResponse<PracticeExpense>> {
    return this.http.get<PaginatedResponse<PracticeExpense>>(`${this.base}/expenses`, { params: params ? toHttpParams(params) : undefined });
  }

  createExpense(payload: PracticeExpenseRequest): Observable<ApiResponse<PracticeExpense>> {
    return this.http.post<ApiResponse<PracticeExpense>>(`${this.base}/expenses`, payload);
  }

  updateExpense(id: string, payload: PracticeExpenseRequest): Observable<ApiResponse<PracticeExpense>> {
    return this.http.put<ApiResponse<PracticeExpense>>(`${this.base}/expenses/${id}`, payload);
  }

  deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/expenses/${id}`);
  }

  /** Attaches the receipt (PDF or image, up to 10 MB) of an expense; a new one replaces the previous. */
  uploadExpenseReceipt(id: string, file: File): Observable<ApiResponse<PracticeExpense>> {
    const body = new FormData();
    body.append('receipt', file);
    return this.http.post<ApiResponse<PracticeExpense>>(`${this.base}/expenses/${id}/receipt`, body);
  }

  downloadExpenseReceipt(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/expenses/${id}/receipt`, { responseType: 'blob' });
  }

  deleteExpenseReceipt(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/expenses/${id}/receipt`);
  }

  // --- Client funds (trust) ledger ---
  getTrustLedger(params?: QueryFilterParams & { client_id?: string; legal_case_id?: string }): Observable<PaginatedResponse<PracticeTrustTransaction>> {
    return this.http.get<PaginatedResponse<PracticeTrustTransaction>>(`${this.base}/trust-ledger`, { params: params ? toHttpParams(params) : undefined });
  }

  getTrustBalances(): Observable<ApiResponse<PracticeTrustBalance[]>> {
    return this.http.get<ApiResponse<PracticeTrustBalance[]>>(`${this.base}/trust-ledger/balances`);
  }

  postTrustTransaction(payload: PracticeTrustTransactionRequest): Observable<ApiResponse<PracticeTrustTransaction>> {
    return this.http.post<ApiResponse<PracticeTrustTransaction>>(`${this.base}/trust-ledger`, payload);
  }

  reverseTrustTransaction(id: string, description?: string | null): Observable<ApiResponse<PracticeTrustTransaction>> {
    return this.http.post<ApiResponse<PracticeTrustTransaction>>(`${this.base}/trust-ledger/${id}/reverse`, { description: description ?? null });
  }

  /** Posts a client funds row to the general ledger on the chosen accounts. */
  postTrustTransactionToLedger(id: string, payload: PracticeTrustPostRequest): Observable<ApiResponse<PracticeTrustPosting>> {
    return this.http.post<ApiResponse<PracticeTrustPosting>>(`${this.base}/trust-ledger/${id}/post`, payload);
  }

  reconcileTrustTransaction(id: string, bankStatementLineId: string): Observable<ApiResponse<PracticeTrustPosting>> {
    return this.http.post<ApiResponse<PracticeTrustPosting>>(`${this.base}/trust-ledger/${id}/reconcile`, { bank_statement_line_id: bankStatementLineId });
  }

  // --- Conflicts of interest ---
  runConflictCheck(payload: PracticeConflictCheckRequest): Observable<ApiResponse<PracticeConflictCheck>> {
    return this.http.post<ApiResponse<PracticeConflictCheck>>(`${this.base}/conflict-checks`, payload);
  }

  getConflictChecks(params?: QueryFilterParams): Observable<PaginatedResponse<PracticeConflictCheck>> {
    return this.http.get<PaginatedResponse<PracticeConflictCheck>>(`${this.base}/conflict-checks`, { params: params ? toHttpParams(params) : undefined });
  }

  getCaseParties(params?: QueryFilterParams & { legal_case_id?: string }): Observable<PaginatedResponse<PracticeCaseParty>> {
    return this.http.get<PaginatedResponse<PracticeCaseParty>>(`${this.base}/case-parties`, { params: params ? toHttpParams(params) : undefined });
  }

  createCaseParty(payload: PracticeCasePartyRequest): Observable<ApiResponse<PracticeCaseParty>> {
    return this.http.post<ApiResponse<PracticeCaseParty>>(`${this.base}/case-parties`, payload);
  }

  deleteCaseParty(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/case-parties/${id}`);
  }

  // --- Fee proposals ---
  getFeeProposals(params?: QueryFilterParams & { client_id?: string; status?: string }): Observable<PaginatedResponse<PracticeFeeProposal>> {
    return this.http.get<PaginatedResponse<PracticeFeeProposal>>(`${this.base}/fee-proposals`, { params: params ? toHttpParams(params) : undefined });
  }

  createFeeProposal(payload: PracticeFeeProposalRequest): Observable<ApiResponse<PracticeFeeProposal>> {
    return this.http.post<ApiResponse<PracticeFeeProposal>>(`${this.base}/fee-proposals`, payload);
  }

  updateFeeProposal(id: string, payload: PracticeFeeProposalRequest): Observable<ApiResponse<PracticeFeeProposal>> {
    return this.http.put<ApiResponse<PracticeFeeProposal>>(`${this.base}/fee-proposals/${id}`, payload);
  }

  sendFeeProposal(id: string): Observable<ApiResponse<PracticeFeeProposal>> {
    return this.http.post<ApiResponse<PracticeFeeProposal>>(`${this.base}/fee-proposals/${id}/send`, {});
  }

  acceptFeeProposal(id: string, payload: PracticeFeeProposalAcceptRequest): Observable<ApiResponse<PracticeFeeProposal>> {
    return this.http.post<ApiResponse<PracticeFeeProposal>>(`${this.base}/fee-proposals/${id}/accept`, payload);
  }

  downloadFeeProposalPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/fee-proposals/${id}/pdf`, { responseType: 'blob' });
  }

  /** Marks as expired every sent proposal past its validity date; returns how many. */
  expireFeeProposals(): Observable<ApiResponse<{ expired: number }>> {
    return this.http.post<ApiResponse<{ expired: number }>>(`${this.base}/fee-proposals/expire`, {});
  }

  declineFeeProposal(id: string, notes?: string | null): Observable<ApiResponse<PracticeFeeProposal>> {
    return this.http.post<ApiResponse<PracticeFeeProposal>>(`${this.base}/fee-proposals/${id}/decline`, { notes: notes ?? null });
  }
}
