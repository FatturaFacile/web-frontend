import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CustomsAssessmentDecisionResource,
  CustomsAssessmentParams,
  CustomsDeclarationParams,
  CustomsDeclarationRequest,
  CustomsDeclarationResource,
  CustomsDossierParams,
  CustomsDossierRequest,
  CustomsDossierResource,
  CustomsProfitabilityResource,
  CustomsShipmentRequestResource,
  CustomsTariffGridRequest,
  CustomsTariffGridResource,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class CustomsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- DOSSIERS ---
  getDossiers(params?: CustomsDossierParams): Observable<PaginatedResponse<CustomsDossierResource>> {
    return this.http.get<PaginatedResponse<CustomsDossierResource>>(`${this.base}/customs/dossiers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDossier(id: string): Observable<ApiResponse<CustomsDossierResource>> {
    return this.http.get<ApiResponse<CustomsDossierResource>>(`${this.base}/customs/dossiers/${id}`);
  }

  createDossier(payload: CustomsDossierRequest): Observable<ApiResponse<CustomsDossierResource>> {
    return this.http.post<ApiResponse<CustomsDossierResource>>(`${this.base}/customs/dossiers`, payload);
  }

  updateDossier(
    id: string,
    payload: Partial<CustomsDossierRequest>,
  ): Observable<ApiResponse<CustomsDossierResource>> {
    return this.http.put<ApiResponse<CustomsDossierResource>>(
      `${this.base}/customs/dossiers/${id}`,
      payload,
    );
  }

  getDossierProfitability(id: string): Observable<ApiResponse<CustomsProfitabilityResource>> {
    return this.http.get<ApiResponse<CustomsProfitabilityResource>>(
      `${this.base}/customs/dossiers/${id}/profitability`,
    );
  }

  invoiceDossier(id: string): Observable<ApiResponse<{ invoice_id: string }>> {
    return this.http.post<ApiResponse<{ invoice_id: string }>>(
      `${this.base}/customs/dossiers/${id}/invoice`,
      {},
    );
  }

  // --- DECLARATIONS ---
  getDeclarations(
    params?: CustomsDeclarationParams,
  ): Observable<PaginatedResponse<CustomsDeclarationResource>> {
    return this.http.get<PaginatedResponse<CustomsDeclarationResource>>(
      `${this.base}/customs/declarations`,
      {
        params: params ? toHttpParams(params) : undefined,
      },
    );
  }

  getDeclaration(id: string): Observable<ApiResponse<CustomsDeclarationResource>> {
    return this.http.get<ApiResponse<CustomsDeclarationResource>>(
      `${this.base}/customs/declarations/${id}`,
    );
  }

  createDeclaration(
    payload: CustomsDeclarationRequest,
  ): Observable<ApiResponse<CustomsDeclarationResource>> {
    return this.http.post<ApiResponse<CustomsDeclarationResource>>(
      `${this.base}/customs/declarations`,
      payload,
    );
  }

  updateDeclaration(
    id: string,
    payload: Partial<CustomsDeclarationRequest>,
  ): Observable<ApiResponse<CustomsDeclarationResource>> {
    return this.http.put<ApiResponse<CustomsDeclarationResource>>(
      `${this.base}/customs/declarations/${id}`,
      payload,
    );
  }

  deleteDeclaration(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/customs/declarations/${id}`);
  }

  validateDeclaration(
    id: string,
  ): Observable<ApiResponse<{ status: string; warnings: string[] }>> {
    return this.http.post<ApiResponse<{ status: string; warnings: string[] }>>(
      `${this.base}/customs/declarations/${id}/validate`,
      {},
    );
  }

  submitDeclaration(id: string): Observable<ApiResponse<{ mrn: string; status: string }>> {
    return this.http.post<ApiResponse<{ mrn: string; status: string }>>(
      `${this.base}/customs/declarations/${id}/submit`,
      {},
    );
  }

  cancelDeclaration(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.base}/customs/declarations/${id}/cancel`,
      {},
    );
  }

  downloadDeclarationPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/customs/declarations/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  // --- ASSESSMENT DECISIONS (eVV) ---
  getAssessmentDecisions(
    params?: CustomsAssessmentParams,
  ): Observable<PaginatedResponse<CustomsAssessmentDecisionResource>> {
    return this.http.get<PaginatedResponse<CustomsAssessmentDecisionResource>>(
      `${this.base}/customs/assessment-decisions`,
      {
        params: params ? toHttpParams(params) : undefined,
      },
    );
  }

  getAssessmentDecision(id: string): Observable<ApiResponse<CustomsAssessmentDecisionResource>> {
    return this.http.get<ApiResponse<CustomsAssessmentDecisionResource>>(
      `${this.base}/customs/assessment-decisions/${id}`,
    );
  }

  uploadAssessmentDecision(file: File): Observable<ApiResponse<CustomsAssessmentDecisionResource>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<CustomsAssessmentDecisionResource>>(
      `${this.base}/customs/assessment-decisions/upload`,
      formData,
    );
  }

  retrieveAssessmentDecisions(): Observable<ApiResponse<{ retrieved_count: number }>> {
    return this.http.post<ApiResponse<{ retrieved_count: number }>>(
      `${this.base}/customs/assessment-decisions/retrieve`,
      {},
    );
  }

  downloadAssessmentPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/customs/assessment-decisions/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  // --- TARIFF GRIDS & SHIPMENTS ---
  getTariffGrids(): Observable<ApiResponse<CustomsTariffGridResource[]>> {
    return this.http.get<ApiResponse<CustomsTariffGridResource[]>>(
      `${this.base}/customs/tariff-grids`,
    );
  }

  createTariffGrid(
    payload: CustomsTariffGridRequest,
  ): Observable<ApiResponse<CustomsTariffGridResource>> {
    return this.http.post<ApiResponse<CustomsTariffGridResource>>(
      `${this.base}/customs/tariff-grids`,
      payload,
    );
  }

  deleteTariffGrid(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.base}/customs/tariff-grids/${id}`);
  }

  getShipmentRequests(): Observable<ApiResponse<CustomsShipmentRequestResource[]>> {
    return this.http.get<ApiResponse<CustomsShipmentRequestResource[]>>(
      `${this.base}/customs/shipment-requests`,
    );
  }

  acceptShipmentRequest(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.base}/customs/shipment-requests/${id}/accept`,
      {},
    );
  }

  refuseShipmentRequest(id: string): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.base}/customs/shipment-requests/${id}/refuse`,
      {},
    );
  }
}
