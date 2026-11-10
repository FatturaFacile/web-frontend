import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CalculatePayrollRunPayload,
  FamilyAllowanceRatePayload,
  FamilyAllowanceRateRecord,
  PaginatedResponse,
  PayrollCostAllocation,
  PaymentBatchAllocation,
  PayrollPaymentBatch,
  PayslipDeliveryResult,
  PayrollRecordFilterParams,
  PayrollRunRecord,
  PayrollSettingsPayload,
  PayrollSettingsRecord,
  PayrollYearEndReport,
  PayslipRecord,
  SalaryCertificateRecord,
  WageTypeRecord,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export type PayrollExportName =
  | 'f24'
  | 'uniemens'
  | 'cu'
  | 'salary-declaration'
  | 'frontier-exchange'
  | 'withholding-statement'
  | 'joint-commission-report';

/** Payroll runs, payslips, wage types, certificates, settings and CSV exports. */
@Service()
export class PayrollApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payroll`;
  private readonly settingsUrls: Record<'swiss' | 'italian', string> = {
    swiss: `${this.base}/settings/swiss`,
    italian: `${this.base}/settings/italian`,
  };
  private readonly exportUrls: Record<PayrollExportName, string> = {
    f24: `${this.base}/exports/f24`,
    uniemens: `${this.base}/exports/uniemens`,
    cu: `${this.base}/exports/cu`,
    'salary-declaration': `${this.base}/exports/salary-declaration`,
    'frontier-exchange': `${this.base}/exports/frontier-exchange`,
    'withholding-statement': `${this.base}/exports/withholding-statement`,
    'joint-commission-report': `${this.base}/exports/joint-commission-report`,
  };

  // --- Runs ---

  getRuns(params?: { year?: number; per_page?: number; page?: number }): Observable<PaginatedResponse<PayrollRunRecord>> {
    return this.http.get<PaginatedResponse<PayrollRunRecord>>(`${this.base}/runs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** The run with its payslips and history. */
  getRun(id: string): Observable<ApiResponse<PayrollRunRecord>> {
    return this.http.get<ApiResponse<PayrollRunRecord>>(`${this.base}/runs/${id}`);
  }

  /** Creates or recalculates the run of a month (a run in `Approved` returns 409). */
  calculateRun(payload: CalculatePayrollRunPayload): Observable<ApiResponse<PayrollRunRecord>> {
    return this.http.post<ApiResponse<PayrollRunRecord>>(`${this.base}/runs/calculate`, payload);
  }

  /** Runs the monthly engine without saving anything. */
  simulateRun(payload: { year: number; month: number; employee_id?: string | null }): Observable<ApiResponse<unknown[]>> {
    return this.http.post<ApiResponse<unknown[]>>(`${this.base}/runs/simulate`, payload);
  }

  /** Estimates the monthly pay of an employee from the annual salary. */
  previewPay(payload: { employee_id: string; target_month?: string | null }): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/runs/preview`, payload);
  }

  approveRun(id: string): Observable<ApiResponse<PayrollRunRecord>> {
    return this.http.post<ApiResponse<PayrollRunRecord>>(`${this.base}/runs/${id}/approve`, {});
  }

  /** Requires `Approved` (422 otherwise). */
  finalizeRun(id: string): Observable<ApiResponse<PayrollRunRecord>> {
    return this.http.post<ApiResponse<PayrollRunRecord>>(`${this.base}/runs/${id}/finalize`, {});
  }

  /** On an approved run it revokes the approval (back to `Calculated`). The reason is recorded. */
  reopenRun(id: string, reason: string): Observable<ApiResponse<PayrollRunRecord>> {
    return this.http.post<ApiResponse<PayrollRunRecord>>(`${this.base}/runs/${id}/reopen`, { reason });
  }

  /** Tells the employees that their payslips are ready (an employee without e-mail or birth date is skipped). */
  deliverPayslips(id: string): Observable<ApiResponse<PayslipDeliveryResult>> {
    return this.http.post<ApiResponse<PayslipDeliveryResult>>(`${this.base}/runs/${id}/deliver-payslips`, {});
  }

  /** Creates the payment files of a run, one per bank account allocation. */
  createPaymentBatches(id: string, allocations: PaymentBatchAllocation[]): Observable<ApiResponse<PayrollPaymentBatch[]>> {
    return this.http.post<ApiResponse<PayrollPaymentBatch[]>>(`${this.base}/runs/${id}/payment-batches`, { allocations });
  }

  getCostAllocation(id: string): Observable<ApiResponse<PayrollCostAllocation>> {
    return this.http.get<ApiResponse<PayrollCostAllocation>>(`${this.base}/runs/${id}/cost-allocation`);
  }

  downloadLabourBook(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/runs/${id}/labour-book`, { responseType: 'blob' });
  }

  getYearEndReport(year: number): Observable<ApiResponse<PayrollYearEndReport>> {
    return this.http.get<ApiResponse<PayrollYearEndReport>>(`${this.base}/reports/year-end`, {
      params: toHttpParams({ year }),
    });
  }

  downloadYearEndReportCsv(year: number): Observable<Blob> {
    return this.http.get(`${this.base}/reports/year-end`, {
      params: toHttpParams({ year }),
      headers: { Accept: 'text/csv' },
      responseType: 'blob',
    });
  }

  // --- Payslips ---

  getPayslips(params?: PayrollRecordFilterParams): Observable<PaginatedResponse<PayslipRecord>> {
    return this.http.get<PaginatedResponse<PayslipRecord>>(`${this.base}/payslips`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getPayslip(id: string): Observable<ApiResponse<PayslipRecord>> {
    return this.http.get<ApiResponse<PayslipRecord>>(`${this.base}/payslips/${id}`);
  }

  downloadPayslipPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/payslips/${id}/pdf`, { responseType: 'blob' });
  }

  // --- Wage types ---

  getWageTypes(): Observable<PaginatedResponse<WageTypeRecord>> {
    return this.http.get<PaginatedResponse<WageTypeRecord>>(`${this.base}/wage-types`, {
      params: toHttpParams({ per_page: 200 }),
    });
  }

  createWageType(payload: Partial<WageTypeRecord>): Observable<ApiResponse<WageTypeRecord>> {
    return this.http.post<ApiResponse<WageTypeRecord>>(`${this.base}/wage-types`, payload);
  }

  updateWageType(id: string, payload: Partial<WageTypeRecord>): Observable<ApiResponse<WageTypeRecord>> {
    return this.http.put<ApiResponse<WageTypeRecord>>(`${this.base}/wage-types/${id}`, payload);
  }

  deleteWageType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/wage-types/${id}`);
  }

  // --- Salary certificates ---

  getSalaryCertificates(params?: PayrollRecordFilterParams): Observable<PaginatedResponse<SalaryCertificateRecord>> {
    return this.http.get<PaginatedResponse<SalaryCertificateRecord>>(`${this.base}/salary-certificates`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSalaryCertificate(id: string): Observable<ApiResponse<SalaryCertificateRecord>> {
    return this.http.get<ApiResponse<SalaryCertificateRecord>>(`${this.base}/salary-certificates/${id}`);
  }

  /** Generates the certificates of a year from the closed runs. */
  generateSalaryCertificates(year: number): Observable<ApiResponse<SalaryCertificateRecord[]>> {
    return this.http.post<ApiResponse<SalaryCertificateRecord[]>>(`${this.base}/salary-certificates/generate`, { year });
  }

  downloadSalaryCertificatePdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/salary-certificates/${id}/pdf`, { responseType: 'blob' });
  }

  // --- Family allowances ---

  getFamilyAllowanceRates(): Observable<PaginatedResponse<FamilyAllowanceRateRecord>> {
    return this.http.get<PaginatedResponse<FamilyAllowanceRateRecord>>(`${this.base}/family-allowance-rates`, {
      params: toHttpParams({ per_page: 200 }),
    });
  }

  createFamilyAllowanceRate(payload: FamilyAllowanceRatePayload): Observable<ApiResponse<FamilyAllowanceRateRecord>> {
    return this.http.post<ApiResponse<FamilyAllowanceRateRecord>>(`${this.base}/family-allowance-rates`, payload);
  }

  updateFamilyAllowanceRate(
    id: string,
    payload: FamilyAllowanceRatePayload,
  ): Observable<ApiResponse<FamilyAllowanceRateRecord>> {
    return this.http.put<ApiResponse<FamilyAllowanceRateRecord>>(`${this.base}/family-allowance-rates/${id}`, payload);
  }

  deleteFamilyAllowanceRate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/family-allowance-rates/${id}`);
  }

  // --- Settings ---

  /** Creates what a Swiss company needs to start (wage types, settings). */
  setup(): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/setup`, {});
  }

  getSettings(country: 'swiss' | 'italian'): Observable<ApiResponse<PayrollSettingsRecord>> {
    return this.http.get<ApiResponse<PayrollSettingsRecord>>(this.settingsUrls[country]);
  }

  saveSettings(country: 'swiss' | 'italian', payload: PayrollSettingsPayload): Observable<ApiResponse<PayrollSettingsRecord>> {
    return this.http.put<ApiResponse<PayrollSettingsRecord>>(this.settingsUrls[country], payload);
  }

  // --- CSV exports & Swissdec ELM / Permit Compliance ---

  downloadExport(name: PayrollExportName, params: Record<string, string | number | undefined>): Observable<Blob> {
    return this.http.get(this.exportUrls[name], { params: toHttpParams(params), responseType: 'blob' });
  }

  getPermitAlerts(params?: { as_of?: string; warning_days?: number }): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>(`${this.base}/compliance/permit-alerts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  downloadSwissdecElmXml(year: number, version: '5.0' | '6.0' = '5.0'): Observable<Blob> {
    return this.http.get(`${this.base}/compliance/salary-declaration/xml`, {
      params: toHttpParams({ year, version }),
      responseType: 'blob',
    });
  }

  validateSwissdecElmXml(payload: {
    year?: number;
    xml?: string;
    version?: '5.0' | '6.0';
  }): Observable<ApiResponse<{ is_valid: boolean; errors: string[]; domain_warnings: string[] }>> {
    return this.http.post<ApiResponse<{ is_valid: boolean; errors: string[]; domain_warnings: string[] }>>(
      `${this.base}/compliance/salary-declaration/validate`,
      payload,
    );
  }
}
