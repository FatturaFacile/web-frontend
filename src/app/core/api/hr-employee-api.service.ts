import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  DepartmentPayload,
  DepartmentResource,
  EmployeeDocumentResource,
  EmployeeLifecycleEventResource,
  EmploymentContractResource,
  NewContractPayload,
  PaginatedResponse,
  PayrollForecast,
  PositionPayload,
  PositionReadinessLevel,
  PositionResource,
  QueryFilterParams,
  SalaryComponentPayload,
  SalaryComponentResource,
  TransferEmployeePayload,
  UpdateContractPayload,
  UploadEmployeeDocumentPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Personnel file (contracts, salary components, documents, transfer) and org chart (departments, positions). */
@Service()
export class HrEmployeeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr`;

  // --- Employment contracts ---

  getContracts(employeeId: string, params?: QueryFilterParams): Observable<PaginatedResponse<EmploymentContractResource>> {
    return this.http.get<PaginatedResponse<EmploymentContractResource>>(`${this.base}/employees/${employeeId}/contracts`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  /** The new contract supersedes the active one. */
  createContract(employeeId: string, payload: NewContractPayload): Observable<ApiResponse<EmploymentContractResource>> {
    return this.http.post<ApiResponse<EmploymentContractResource>>(
      `${this.base}/employees/${employeeId}/contracts`,
      payload,
    );
  }

  updateContract(id: string, payload: UpdateContractPayload): Observable<ApiResponse<EmploymentContractResource>> {
    return this.http.put<ApiResponse<EmploymentContractResource>>(`${this.base}/contracts/${id}`, payload);
  }

  addSalaryComponent(contractId: string, payload: SalaryComponentPayload): Observable<ApiResponse<SalaryComponentResource>> {
    return this.http.post<ApiResponse<SalaryComponentResource>>(
      `${this.base}/contracts/${contractId}/salary-components`,
      payload,
    );
  }

  updateSalaryComponent(id: string, payload: SalaryComponentPayload): Observable<ApiResponse<SalaryComponentResource>> {
    return this.http.put<ApiResponse<SalaryComponentResource>>(`${this.base}/salary-components/${id}`, payload);
  }

  deleteSalaryComponent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/salary-components/${id}`);
  }

  // --- Employee documents ---

  getEmployeeDocuments(employeeId: string, params?: QueryFilterParams): Observable<PaginatedResponse<EmployeeDocumentResource>> {
    return this.http.get<PaginatedResponse<EmployeeDocumentResource>>(`${this.base}/employees/${employeeId}/documents`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  uploadEmployeeDocument(
    employeeId: string,
    payload: UploadEmployeeDocumentPayload,
  ): Observable<ApiResponse<EmployeeDocumentResource>> {
    const body = new FormData();
    body.append('file', payload.file);
    body.append('document_type', payload.document_type);
    body.append('title', payload.title);
    for (const key of ['issue_date', 'expiry_date', 'retention_until'] as const) {
      const value = payload[key];
      if (value) {
        body.append(key, value);
      }
    }
    for (const key of ['contains_health_data', 'is_confidential', 'visible_to_employee'] as const) {
      const value = payload[key];
      if (value !== undefined) {
        body.append(key, value ? '1' : '0');
      }
    }
    return this.http.post<ApiResponse<EmployeeDocumentResource>>(`${this.base}/employees/${employeeId}/documents`, body);
  }

  downloadEmployeeDocument(id: string, inline = false): Observable<Blob> {
    return this.http.get(`${this.base}/employee-documents/${id}/download`, {
      params: toHttpParams({ inline: inline ? 1 : undefined }),
      responseType: 'blob',
    });
  }

  deleteEmployeeDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/employee-documents/${id}`);
  }

  // --- Lifecycle ---

  transferEmployee(id: string, payload: TransferEmployeePayload): Observable<ApiResponse<EmployeeLifecycleEventResource>> {
    return this.http.post<ApiResponse<EmployeeLifecycleEventResource>>(`${this.base}/employees/${id}/transfer`, payload);
  }

  // --- Org chart ---

  getDepartments(params?: QueryFilterParams): Observable<PaginatedResponse<DepartmentResource>> {
    return this.http.get<PaginatedResponse<DepartmentResource>>(`${this.base}/departments`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createDepartment(payload: DepartmentPayload): Observable<ApiResponse<DepartmentResource>> {
    return this.http.post<ApiResponse<DepartmentResource>>(`${this.base}/departments`, payload);
  }

  /** The server rejects cycles in the department tree with 422. */
  updateDepartment(id: string, payload: DepartmentPayload): Observable<ApiResponse<DepartmentResource>> {
    return this.http.put<ApiResponse<DepartmentResource>>(`${this.base}/departments/${id}`, payload);
  }

  getPositions(params?: QueryFilterParams): Observable<PaginatedResponse<PositionResource>> {
    return this.http.get<PaginatedResponse<PositionResource>>(`${this.base}/positions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createPosition(payload: PositionPayload): Observable<ApiResponse<PositionResource>> {
    return this.http.post<ApiResponse<PositionResource>>(`${this.base}/positions`, payload);
  }

  updatePosition(id: string, payload: PositionPayload): Observable<ApiResponse<PositionResource>> {
    return this.http.put<ApiResponse<PositionResource>>(`${this.base}/positions/${id}`, payload);
  }

  /** Assigns the successor of a position with the readiness level (the employee must belong to the company). */
  assignPositionSuccessor(
    positionId: string,
    payload: { successor_employee_id: string; readiness_level?: PositionReadinessLevel },
  ): Observable<ApiResponse<PositionResource>> {
    return this.http.patch<ApiResponse<PositionResource>>(`${this.base}/positions/${positionId}/successor`, payload);
  }

  /** Generates the cost and payroll forecast of a month (`YYYY-MM`, the current month when omitted). */
  generatePayrollForecast(periodCode?: string): Observable<ApiResponse<PayrollForecast>> {
    return this.http.post<ApiResponse<PayrollForecast>>(
      `${this.base}/payroll-forecast`,
      periodCode ? { period_code: periodCode } : {},
    );
  }

  getOrgChart(): Observable<ApiResponse<Record<string, unknown>[]>> {
    return this.http.get<ApiResponse<Record<string, unknown>[]>>(`${this.base}/org-chart`);
  }
}
