import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  PaginatedResponse,
  PayrollAbsencePayload,
  PayrollAbsenceRecord,
  PayrollChildPayload,
  PayrollChildRecord,
  PayrollEmployeeProfilePayload,
  PayrollEmployeeProfileRecord,
  PayrollInputPayload,
  PayrollInputRecord,
  PayrollRecordFilterParams,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Payroll data of an employee: profile, variable inputs, absences and children. */
@Service()
export class PayrollEmployeeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payroll`;

  getProfiles(params?: PayrollRecordFilterParams): Observable<PaginatedResponse<PayrollEmployeeProfileRecord>> {
    return this.http.get<PaginatedResponse<PayrollEmployeeProfileRecord>>(`${this.base}/employee-profiles`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getProfile(employeeId: string): Observable<ApiResponse<PayrollEmployeeProfileRecord>> {
    return this.http.get<ApiResponse<PayrollEmployeeProfileRecord>>(`${this.base}/employee-profiles/${employeeId}`);
  }

  saveProfile(employeeId: string, payload: PayrollEmployeeProfilePayload): Observable<ApiResponse<PayrollEmployeeProfileRecord>> {
    return this.http.put<ApiResponse<PayrollEmployeeProfileRecord>>(`${this.base}/employee-profiles/${employeeId}`, payload);
  }

  getInputs(params?: PayrollRecordFilterParams): Observable<PaginatedResponse<PayrollInputRecord>> {
    return this.http.get<PaginatedResponse<PayrollInputRecord>>(`${this.base}/inputs`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createInput(payload: PayrollInputPayload): Observable<ApiResponse<PayrollInputRecord>> {
    return this.http.post<ApiResponse<PayrollInputRecord>>(`${this.base}/inputs`, payload);
  }

  updateInput(id: string, payload: PayrollInputPayload): Observable<ApiResponse<PayrollInputRecord>> {
    return this.http.put<ApiResponse<PayrollInputRecord>>(`${this.base}/inputs/${id}`, payload);
  }

  deleteInput(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/inputs/${id}`);
  }

  getAbsences(params?: PayrollRecordFilterParams): Observable<PaginatedResponse<PayrollAbsenceRecord>> {
    return this.http.get<PaginatedResponse<PayrollAbsenceRecord>>(`${this.base}/absences`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createAbsence(payload: PayrollAbsencePayload): Observable<ApiResponse<PayrollAbsenceRecord>> {
    return this.http.post<ApiResponse<PayrollAbsenceRecord>>(`${this.base}/absences`, payload);
  }

  updateAbsence(id: string, payload: PayrollAbsencePayload): Observable<ApiResponse<PayrollAbsenceRecord>> {
    return this.http.put<ApiResponse<PayrollAbsenceRecord>>(`${this.base}/absences/${id}`, payload);
  }

  deleteAbsence(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/absences/${id}`);
  }

  getChildren(params?: PayrollRecordFilterParams): Observable<PaginatedResponse<PayrollChildRecord>> {
    return this.http.get<PaginatedResponse<PayrollChildRecord>>(`${this.base}/children`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createChild(payload: PayrollChildPayload): Observable<ApiResponse<PayrollChildRecord>> {
    return this.http.post<ApiResponse<PayrollChildRecord>>(`${this.base}/children`, payload);
  }

  updateChild(id: string, payload: PayrollChildPayload): Observable<ApiResponse<PayrollChildRecord>> {
    return this.http.put<ApiResponse<PayrollChildRecord>>(`${this.base}/children/${id}`, payload);
  }

  deleteChild(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/children/${id}`);
  }
}
