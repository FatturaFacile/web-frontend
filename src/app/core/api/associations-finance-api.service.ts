import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse } from '../models';
import {
  ExtraListResponse,
  ExtraObject,
  ExtraParams,
  ExtraPayload,
  ExtraRecord,
  ExtraUploadFields,
} from './extra-api.types';

/** Associations: donation receipts, fundraising campaigns, 5 per mille, sponsors, statements and filings, Lex 398 and sport work compensation. */
@Service()
export class AssociationsFinanceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/associations`;

  cancelDonationReceipt(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/donation-receipts/${id}/cancel`, payload);
  }

  downloadDonationReceiptPdf(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/donation-receipts/${id}/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  addCampaignExpense(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/campaigns/${id}/expenses`, payload);
  }

  getCampaignReport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/campaigns/${id}/report`, { params: params ? toHttpParams(params) : undefined });
  }

  createFivePerMille(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/five-per-mille`, payload);
  }

  addFivePerMilleExpense(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/five-per-mille/${id}/expenses`, payload);
  }

  getFivePerMilleReport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/five-per-mille/${id}/report`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadFivePerMilleCsv(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/five-per-mille/${id}/csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  attachSponsorContractDocument(id: string, fields: ExtraUploadFields, file: File): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/sponsor-contracts/${id}/document`, this.toFormData(fields, file));
  }

  downloadSponsorContractDocument(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/sponsor-contracts/${id}/document`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getStatementSchemes(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/statements/schemes`, { params: params ? toHttpParams(params) : undefined });
  }

  getStatementMappings(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/statements/mappings`, { params: params ? toHttpParams(params) : undefined });
  }

  createStatementMapping(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/statements/mappings`, payload);
  }

  updateStatementMapping(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/statements/mappings/${id}`, payload);
  }

  deleteStatementMapping(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/statements/mappings/${id}`);
  }

  getStatementFilings(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/statements/filings`, { params: params ? toHttpParams(params) : undefined });
  }

  getManagementReport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/statements/${id}/management-report`, { params: params ? toHttpParams(params) : undefined });
  }

  getBalanceSheet(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/statements/${id}/balance-sheet`, { params: params ? toHttpParams(params) : undefined });
  }

  getCashReport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/statements/${id}/cash-report`, { params: params ? toHttpParams(params) : undefined });
  }

  getStatementChecks(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/statements/${id}/checks`, { params: params ? toHttpParams(params) : undefined });
  }

  getMissionReport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/statements/${id}/mission-report`, { params: params ? toHttpParams(params) : undefined });
  }

  updateMissionReport(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraObject>> {
    return this.http.put<ApiResponse<ExtraObject>>(`${this.base}/statements/${id}/mission-report`, payload);
  }

  createStatementFiling(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/statements/${id}/filings`, payload);
  }

  markStatementFilingFiled(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/statement-filings/${id}/filed`, payload);
  }

  downloadStatementFilingCsv(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/statement-filings/${id}/csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  downloadStatementFilingPdf(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/statement-filings/${id}/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getLex398Monitor(year: string | number, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/lex398/${year}/monitor`, { params: params ? toHttpParams(params) : undefined });
  }

  getLex398Register(year: string | number, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/lex398/${year}/register`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadLex398RegisterCsv(year: string | number, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/lex398/${year}/register/csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  recordLex398Entry(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/lex398/entries`, payload);
  }

  syncLex398Invoices(year: string | number, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraObject>> {
    return this.http.post<ApiResponse<ExtraObject>>(`${this.base}/lex398/${year}/sync-invoices`, payload);
  }

  getSportCompensations(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/sport/compensations`, { params: params ? toHttpParams(params) : undefined });
  }

  createSportCompensation(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/sport/compensations`, payload);
  }

  getSportExpiries(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/sport/expiries`, { params: params ? toHttpParams(params) : undefined });
  }

  getSportThresholds(year: string | number, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/sport/${year}/thresholds`, { params: params ? toHttpParams(params) : undefined });
  }

  getSportSingleBook(year: string | number, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/sport/${year}/single-book`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadSportSingleBookCsv(year: string | number, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/sport/${year}/single-book/csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  downloadSportAccountantCsv(year: string | number, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/sport/${year}/accountant-csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  downloadSportRegistryCsv(year: string | number, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/sport/${year}/registry-csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  attachSportContractDocument(id: string, fields: ExtraUploadFields, file: File): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/sport-contracts/${id}/document`, this.toFormData(fields, file));
  }

  downloadSportContractDocument(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/sport-contracts/${id}/document`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getSectionReport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/sections/${id}/report`, { params: params ? toHttpParams(params) : undefined });
  }

  getNetworkStatements(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/network/statements/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  private toFormData(fields: ExtraUploadFields, file: File | null): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    if (file) {
      formData.append('file', file);
    }
    return formData;
  }
}
