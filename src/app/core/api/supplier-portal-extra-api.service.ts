import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  SupplierBankChange,
  SupplierCheck,
  SupplierDocument,
  SupplierDocumentRequirement,
  SupplierQualificationAssessment,
} from '../models';

export interface SupplierDocumentRequirementPayload {
  code: string;
  name: string;
  country?: 'IT' | 'CH' | null;
  is_mandatory?: boolean;
  requires_expiry?: boolean;
  validity_days?: number | null;
  alert_days?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface SupplierCheckFilterParams {
  supplier_id?: string;
  check_type?: string;
  result?: string;
  page?: number;
  per_page?: number;
}

export interface SupplierInternalDocumentPayload {
  supplier_id: string;
  requirement_id: string;
  reference?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
  file?: File | null;
}

/** Supplier-portal endpoints not covered by `SupplierPortalApiService`. */
@Service()
export class SupplierPortalExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/supplier-portal`;

  createDocumentRequirement(payload: SupplierDocumentRequirementPayload): Observable<ApiResponse<SupplierDocumentRequirement>> {
    return this.http.post<ApiResponse<SupplierDocumentRequirement>>(`${this.base}/document-requirements`, payload);
  }

  updateDocumentRequirement(
    id: string,
    payload: Partial<SupplierDocumentRequirementPayload>,
  ): Observable<ApiResponse<SupplierDocumentRequirement>> {
    return this.http.put<ApiResponse<SupplierDocumentRequirement>>(`${this.base}/document-requirements/${id}`, payload);
  }

  /** Registers a document on behalf of a supplier (back-office upload, multipart). */
  submitDocument(payload: SupplierInternalDocumentPayload): Observable<ApiResponse<SupplierDocument>> {
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      form.append(key, value instanceof File ? value : String(value));
    }
    return this.http.post<ApiResponse<SupplierDocument>>(`${this.base}/documents`, form);
  }

  getAssessment(id: string): Observable<ApiResponse<SupplierQualificationAssessment>> {
    return this.http.get<ApiResponse<SupplierQualificationAssessment>>(`${this.base}/qualification-assessments/${id}`);
  }

  getChecks(filters?: SupplierCheckFilterParams): Observable<PaginatedResponse<SupplierCheck>> {
    return this.http.get<PaginatedResponse<SupplierCheck>>(`${this.base}/checks`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getBankChange(id: string): Observable<ApiResponse<SupplierBankChange>> {
    return this.http.get<ApiResponse<SupplierBankChange>>(`${this.base}/bank-changes/${id}`);
  }
}
