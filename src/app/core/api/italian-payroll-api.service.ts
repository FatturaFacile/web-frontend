import { HttpClient, HttpEvent } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AccountingImportPayload,
  AccountingImportResult,
  ApiResponse,
  CedoliniImportResult,
  ConsultantFormat,
  CreateItalianPayrollPeriodPayload,
  F24Summary,
  FringeBenefitInput,
  GlAccountAssignment,
  ItalianPayrollPeriod,
  ItalianPayrollValidationResult,
  PayslipDownloadAuditRow,
  SepaSalaryPayload,
  TfrLedger,
} from '../models';

/** Monthly closing of the Italian payroll with the labour consultant (Mod 077). */
@Service()
export class ItalianPayrollApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/italian-payroll`;

  getPeriods(): Observable<ApiResponse<ItalianPayrollPeriod[]>> {
    return this.http.get<ApiResponse<ItalianPayrollPeriod[]>>(`${this.base}/periods`);
  }

  getPeriod(id: string): Observable<ApiResponse<ItalianPayrollPeriod>> {
    return this.http.get<ApiResponse<ItalianPayrollPeriod>>(`${this.base}/periods/${id}`);
  }

  /** Opens a month; the same month of the same legal entity twice answers 409. */
  createPeriod(
    payload: CreateItalianPayrollPeriodPayload,
  ): Observable<ApiResponse<ItalianPayrollPeriod>> {
    return this.http.post<ApiResponse<ItalianPayrollPeriod>>(`${this.base}/periods`, payload);
  }

  /** Rebuilds the attendance lines and checks them; with no error the month becomes `validated` and is frozen. */
  validateAttendance(
    id: string,
    fringeBenefits: FringeBenefitInput[] = [],
  ): Observable<ApiResponse<ItalianPayrollValidationResult>> {
    return this.http.post<ApiResponse<ItalianPayrollValidationResult>>(
      `${this.base}/periods/${id}/validate`,
      {
        fringe_benefits: fringeBenefits,
      },
    );
  }

  /** The attendance file in the layout of the consultant software (needs a validated month, else 422). */
  exportAttendance(id: string, format: ConsultantFormat, companyCode: string): Observable<Blob> {
    return this.http.post(
      `${this.base}/periods/${id}/export`,
      { consultant_format: format, company_code: companyCode },
      { responseType: 'blob' },
    );
  }

  /**
   * The bulk PDF of the payslips; the events carry the upload progress and, last, the result of the split and match.
   */
  importCedolini(id: string, file: File): Observable<HttpEvent<ApiResponse<CedoliniImportResult>>> {
    const body = new FormData();
    body.append('bundle_pdf', file, file.name);

    return this.http.post<ApiResponse<CedoliniImportResult>>(
      `${this.base}/periods/${id}/cedolini`,
      body,
      {
        observe: 'events',
        reportProgress: true,
      },
    );
  }

  /** Checks the summary, posts the journal entry and stores the net of each employee (422 when it does not reconcile). */
  importAccounting(
    id: string,
    payload: AccountingImportPayload,
  ): Observable<ApiResponse<AccountingImportResult>> {
    return this.http.post<ApiResponse<AccountingImportResult>>(
      `${this.base}/periods/${id}/accounting-import`,
      payload,
    );
  }

  /** The pain.001.001.03 salary file (SALA); refused unless the nets add up to the posted net payable. */
  generateSepa(id: string, payload: SepaSalaryPayload): Observable<Blob> {
    return this.http.post(`${this.base}/periods/${id}/sepa`, payload, { responseType: 'blob' });
  }

  markPaid(id: string): Observable<ApiResponse<ItalianPayrollPeriod>> {
    return this.http.post<ApiResponse<ItalianPayrollPeriod>>(
      `${this.base}/periods/${id}/mark-paid`,
      {},
    );
  }

  getF24(id: string): Observable<ApiResponse<F24Summary>> {
    return this.http.get<ApiResponse<F24Summary>>(`${this.base}/periods/${id}/f24`);
  }

  getDownloadAudit(
    id: string,
    employeeId?: string,
  ): Observable<ApiResponse<PayslipDownloadAuditRow[]>> {
    return this.http.get<ApiResponse<PayslipDownloadAuditRow[]>>(
      `${this.base}/periods/${id}/download-audit`,
      {
        params: employeeId ? { employee_id: employeeId } : undefined,
      },
    );
  }

  getTfrLedger(
    year: number,
    foiPercent?: number,
    legalEntityId?: string,
  ): Observable<ApiResponse<TfrLedger>> {
    const params: Record<string, string> = { year: String(year) };

    if (foiPercent !== undefined) {
      params['foi_percent'] = String(foiPercent);
    }

    if (legalEntityId) {
      params['legal_entity_id'] = legalEntityId;
    }

    return this.http.get<ApiResponse<TfrLedger>>(`${this.base}/tfr-ledger`, { params });
  }

  /** Maps each posting role of the payroll journal to an account of the chart of accounts. */
  saveGlAccounts(accounts: GlAccountAssignment[]): Observable<ApiResponse<Record<string, string>>> {
    return this.http.put<ApiResponse<Record<string, string>>>(`${this.base}/gl-accounts`, {
      accounts,
    });
  }

  saveCausalMappings(
    format: ConsultantFormat,
    mappings: { causal_code: string; external_code: string }[],
  ): Observable<ApiResponse<Record<string, string>>> {
    return this.http.put<ApiResponse<Record<string, string>>>(`${this.base}/causal-mappings`, {
      consultant_format: format,
      mappings,
    });
  }
}
