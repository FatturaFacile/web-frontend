import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ExmAciRate,
  ExmAciRateFilters,
  ExmApprovePayload,
  ExmBalance,
  ExmCardAccount,
  ExmCardFilters,
  ExmCardTransaction,
  ExmEnvelope,
  ExmExportPayoutPayload,
  ExmLinePayload,
  ExmLineResult,
  ExmLookups,
  ExmMileagePayload,
  ExmMileageQuote,
  ExmMileageQuotePayload,
  ExmPage,
  ExmPayout,
  ExmPerDiem,
  ExmPerDiemPayload,
  ExmReceiptScan,
  ExmReconcilePayload,
  ExmReport,
  ExmReportDetail,
  ExmReportFilters,
  ExmReportPayload,
  ExmReportTotals,
  ExmViolationFilters,
  ExmViolationRow,
} from '../models';

type Envelope<T> = Observable<ExmEnvelope<T>>;

/** Endpoints of the expense and travel management module (Mod 075). */
@Service()
export class ExpenseManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/expense-management`;

  getLookups(): Envelope<ExmLookups> {
    return this.http.get<ExmEnvelope<ExmLookups>>(`${this.base}/lookups`);
  }

  // --- Reports ---

  listReports(filters: ExmReportFilters = {}): Observable<ExmPage<ExmReport>> {
    return this.http.get<ExmPage<ExmReport>>(`${this.base}/reports`, {
      params: toHttpParams(filters),
    });
  }

  getReport(id: string): Envelope<ExmReportDetail> {
    return this.http.get<ExmEnvelope<ExmReportDetail>>(`${this.base}/reports/${id}`);
  }

  createReport(payload: ExmReportPayload): Envelope<ExmReport> {
    return this.http.post<ExmEnvelope<ExmReport>>(`${this.base}/reports`, payload);
  }

  updateReport(id: string, payload: ExmReportPayload): Envelope<ExmReport> {
    return this.http.put<ExmEnvelope<ExmReport>>(`${this.base}/reports/${id}`, payload);
  }

  deleteReport(id: string): Envelope<null> {
    return this.http.delete<ExmEnvelope<null>>(`${this.base}/reports/${id}`);
  }

  // --- Lines, mileage, per diem ---

  addLine(reportId: string, payload: ExmLinePayload): Envelope<ExmLineResult> {
    return this.http.post<ExmEnvelope<ExmLineResult>>(
      `${this.base}/reports/${reportId}/lines`,
      payload,
    );
  }

  updateLine(reportId: string, lineId: string, payload: ExmLinePayload): Envelope<ExmLineResult> {
    return this.http.put<ExmEnvelope<ExmLineResult>>(
      `${this.base}/reports/${reportId}/lines/${lineId}`,
      payload,
    );
  }

  removeLine(reportId: string, lineId: string): Envelope<{ report_totals: ExmReportTotals }> {
    return this.http.delete<ExmEnvelope<{ report_totals: ExmReportTotals }>>(
      `${this.base}/reports/${reportId}/lines/${lineId}`,
    );
  }

  addMileageClaim(reportId: string, payload: ExmMileagePayload): Envelope<ExmLineResult> {
    return this.http.post<ExmEnvelope<ExmLineResult>>(
      `${this.base}/reports/${reportId}/mileage-claims`,
      payload,
    );
  }

  quoteMileage(payload: ExmMileageQuotePayload): Envelope<ExmMileageQuote> {
    return this.http.post<ExmEnvelope<ExmMileageQuote>>(
      `${this.base}/mileage-claims/quote`,
      payload,
    );
  }

  addPerDiem(reportId: string, payload: ExmPerDiemPayload): Envelope<ExmPerDiem> {
    return this.http.post<ExmEnvelope<ExmPerDiem>>(
      `${this.base}/reports/${reportId}/per-diems`,
      payload,
    );
  }

  previewPerDiem(payload: ExmPerDiemPayload): Envelope<ExmPerDiem> {
    return this.http.post<ExmEnvelope<ExmPerDiem>>(`${this.base}/per-diems/preview`, payload);
  }

  removePerDiem(reportId: string, perDiemId: string): Envelope<null> {
    return this.http.delete<ExmEnvelope<null>>(
      `${this.base}/reports/${reportId}/per-diems/${perDiemId}`,
    );
  }

  // --- Workflow ---

  submit(id: string): Envelope<ExmReport> {
    return this.http.post<ExmEnvelope<ExmReport>>(`${this.base}/reports/${id}/submit`, {});
  }

  approve(id: string, payload: ExmApprovePayload = {}): Envelope<ExmReport> {
    return this.http.post<ExmEnvelope<ExmReport>>(`${this.base}/reports/${id}/approve`, payload);
  }

  reject(id: string, reason: string): Envelope<ExmReport> {
    return this.http.post<ExmEnvelope<ExmReport>>(`${this.base}/reports/${id}/reject`, { reason });
  }

  exportPayout(id: string, payload: ExmExportPayoutPayload): Envelope<ExmPayout> {
    return this.http.post<ExmEnvelope<ExmPayout>>(
      `${this.base}/reports/${id}/export-payout`,
      payload,
    );
  }

  confirmReimbursement(id: string): Envelope<ExmReport> {
    return this.http.post<ExmEnvelope<ExmReport>>(
      `${this.base}/reports/${id}/confirm-reimbursement`,
      {},
    );
  }

  cancel(id: string): Envelope<ExmReport> {
    return this.http.post<ExmEnvelope<ExmReport>>(`${this.base}/reports/${id}/cancel`, {});
  }

  downloadPayout(reportId: string, payoutId: string): Observable<Blob> {
    return this.http.get(`${this.base}/reports/${reportId}/payouts/${payoutId}/file`, {
      responseType: 'blob',
    });
  }

  // --- Receipts ---

  scanReceipt(file: File, ocrText?: string, reportId?: string): Envelope<ExmReceiptScan> {
    const body = new FormData();
    body.append('file', file);
    if (ocrText) {
      body.append('ocr_text', ocrText);
    }
    if (reportId) {
      body.append('expense_report_id', reportId);
    }
    return this.http.post<ExmEnvelope<ExmReceiptScan>>(`${this.base}/receipts/scan`, body);
  }

  receiptFile(receiptId: string): Observable<Blob> {
    return this.http.get(`${this.base}/receipts/${receiptId}/file`, { responseType: 'blob' });
  }

  // --- Rates, balance, cards, violations ---

  listAciRates(filters: ExmAciRateFilters = {}): Envelope<ExmAciRate[]> {
    return this.http.get<ExmEnvelope<ExmAciRate[]>>(`${this.base}/aci-rates`, {
      params: toHttpParams(filters),
    });
  }

  getBalance(employeeId?: string): Envelope<ExmBalance> {
    return this.http.get<ExmEnvelope<ExmBalance>>(`${this.base}/balance`, {
      params: toHttpParams(employeeId ? { employee_id: employeeId } : {}),
    });
  }

  listCardAccounts(): Envelope<ExmCardAccount[]> {
    return this.http.get<ExmEnvelope<ExmCardAccount[]>>(`${this.base}/card-accounts`);
  }

  listCardTransactions(filters: ExmCardFilters = {}): Observable<ExmPage<ExmCardTransaction>> {
    return this.http.get<ExmPage<ExmCardTransaction>>(`${this.base}/card-transactions`, {
      params: toHttpParams(filters),
    });
  }

  reconcileCardTransaction(id: string, payload: ExmReconcilePayload): Envelope<ExmCardTransaction> {
    return this.http.post<ExmEnvelope<ExmCardTransaction>>(
      `${this.base}/card-transactions/${id}/reconcile`,
      payload,
    );
  }

  listViolations(filters: ExmViolationFilters = {}): Observable<ExmPage<ExmViolationRow>> {
    return this.http.get<ExmPage<ExmViolationRow>>(`${this.base}/policy-violations`, {
      params: toHttpParams(filters),
    });
  }
}
