import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  AnnualParameterRecord,
  AnnualParametersPayload,
  ApiResponse,
  ChildAllowanceRow,
  FrontierNightsPayload,
  HiringSimulationPayload,
  HiringSimulationResult,
  LabourCostGroupBy,
  LabourCostReport,
  LegalParameterRecord,
  LegalParametersPayload,
  PaginatedResponse,
  PayrollGenericRecord,
  QueryFilterParams,
  SwissdecDeclaration,
  SwissdecReadiness,
  SwissdecStatus,
  SwissdecTransmissionResult,
  SwissdecVersion,
  TariffSummaryRow,
  WithholdingStatementQuery,
  WithholdingStatementReport,
} from '../models';

/** Legal tables, withholding tax statements, Swissdec, labour cost and hiring simulation (`/payroll/*`). */
@Service()
export class PayrollComplianceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payroll`;

  // --- Legal tables ---

  getLegalParameters(params?: QueryFilterParams): Observable<PaginatedResponse<LegalParameterRecord>> {
    return this.http.get<PaginatedResponse<LegalParameterRecord>>(`${this.base}/legal-parameters`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** Sets the parameters of a topic (`frontier_italy`, `short_time_work`, `bad_weather`, `withholding_tax_statement`) for a year. */
  saveLegalParameters(
    topic: string,
    year: number,
    payload: LegalParametersPayload,
  ): Observable<ApiResponse<LegalParameterRecord>> {
    return this.http.put<ApiResponse<LegalParameterRecord>>(`${this.base}/legal-parameters/${topic}/${year}`, payload);
  }

  getAnnualParameters(params?: QueryFilterParams): Observable<PaginatedResponse<AnnualParameterRecord>> {
    return this.http.get<PaginatedResponse<AnnualParameterRecord>>(`${this.base}/annual-parameters`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** Saves the company parameters of a country (`CH`, `IT`) and year. */
  saveAnnualParameters(
    country: string,
    year: number,
    payload: AnnualParametersPayload,
  ): Observable<ApiResponse<AnnualParameterRecord>> {
    return this.http.put<ApiResponse<AnnualParameterRecord>>(`${this.base}/annual-parameters/${country}/${year}`, payload);
  }

  getWithholdingTaxTariffs(): Observable<ApiResponse<TariffSummaryRow[]>> {
    return this.http.get<ApiResponse<TariffSummaryRow[]>>(`${this.base}/withholding-tax-tariffs`);
  }

  /** Imports an ESTV tariff file (multipart `file`) or its text (`content`). */
  importWithholdingTaxTariffs(source: { file: File } | { content: string }): Observable<ApiResponse<{ imported: number }>> {
    if ('file' in source) {
      const body = new FormData();
      body.append('file', source.file);
      return this.http.post<ApiResponse<{ imported: number }>>(`${this.base}/withholding-tax-tariffs/import`, body);
    }
    return this.http.post<ApiResponse<{ imported: number }>>(`${this.base}/withholding-tax-tariffs/import`, {
      content: source.content,
    });
  }

  // --- Withholding statements and frontier workers ---

  getWithholdingStatements(query: WithholdingStatementQuery): Observable<ApiResponse<WithholdingStatementReport>> {
    return this.http.get<ApiResponse<WithholdingStatementReport>>(`${this.base}/withholding-statements`, {
      params: toHttpParams(query),
    });
  }

  /** Closes the statement of a period (422 when data is missing). */
  closeWithholdingStatement(query: WithholdingStatementQuery): Observable<ApiResponse<PayrollGenericRecord>> {
    return this.http.post<ApiResponse<PayrollGenericRecord>>(`${this.base}/withholding-statements`, query);
  }

  saveFrontierNights(employeeId: string, payload: FrontierNightsPayload): Observable<ApiResponse<PayrollGenericRecord>> {
    return this.http.put<ApiResponse<PayrollGenericRecord>>(`${this.base}/frontier-workers/${employeeId}/nights`, payload);
  }

  // --- Swissdec ---

  getSwissdecStatus(): Observable<ApiResponse<SwissdecStatus>> {
    return this.http.get<ApiResponse<SwissdecStatus>>(`${this.base}/swissdec/status`);
  }

  getSwissdecDeclaration(year: number, version?: SwissdecVersion): Observable<ApiResponse<SwissdecDeclaration>> {
    return this.http.get<ApiResponse<SwissdecDeclaration>>(`${this.base}/swissdec/declaration`, {
      params: toHttpParams({ year, version }),
    });
  }

  getSwissdecReadiness(year: number, version?: SwissdecVersion): Observable<ApiResponse<SwissdecReadiness>> {
    return this.http.get<ApiResponse<SwissdecReadiness>>(`${this.base}/swissdec/readiness`, {
      params: toHttpParams({ year, version }),
    });
  }

  /** The transmission to the Swissdec distributor is not available: expect 422. */
  transmitSwissdec(year: number, version?: SwissdecVersion): Observable<ApiResponse<SwissdecTransmissionResult>> {
    return this.http.post<ApiResponse<SwissdecTransmissionResult>>(`${this.base}/swissdec/transmissions`, {
      year,
      ...(version ? { version } : {}),
    });
  }

  // --- Reports and simulations ---

  getLabourCostReport(params: {
    year: number;
    month?: number | null;
    group_by?: LabourCostGroupBy | null;
  }): Observable<ApiResponse<LabourCostReport>> {
    return this.http.get<ApiResponse<LabourCostReport>>(`${this.base}/reports/labour-cost`, {
      params: toHttpParams(params),
    });
  }

  getChildAllowances(params: {
    year: number;
    month: number;
    employee_id?: string | null;
  }): Observable<ApiResponse<ChildAllowanceRow[]>> {
    return this.http.get<ApiResponse<ChildAllowanceRow[]>>(`${this.base}/children/allowances`, {
      params: toHttpParams(params),
    });
  }

  simulateHiring(payload: HiringSimulationPayload): Observable<ApiResponse<HiringSimulationResult>> {
    return this.http.post<ApiResponse<HiringSimulationResult>>(`${this.base}/hiring-simulations`, payload);
  }
}
