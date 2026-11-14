import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  DocumentSignature,
  DocumentSigningSettings,
  EDocumentNetworkStatus,
  EDocumentNetworkType,
  EDocumentTransmission,
  PaginatedResponse,
  PreservationRecord,
  QueryFilterParams,
  PreserveDocumentRequest,
  SendEDocumentRequest,
  SignDocumentRequest,
  UpdateDocumentSigningSettingsRequest,
  VerifySignatureResult,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Query of the transmission grid: the toolbar filters plus the standard paging and grid parameters. */
export interface TransmissionListParams extends QueryFilterParams {
  network?: string;
  status?: string;
  document_reference?: string;
}

@Service()
export class DocumentTrustApiService {
  private readonly http = inject(HttpClient);
  private readonly edocBase = `${environment.apiBaseUrl}/edocument-networks`;
  private readonly trustBase = `${environment.apiBaseUrl}/document-trust`;

  getNetworks(): Observable<ApiResponse<EDocumentNetworkStatus[]>> {
    return this.http.get<ApiResponse<EDocumentNetworkStatus[]>>(this.edocBase);
  }

  getTransmissions(params?: TransmissionListParams): Observable<PaginatedResponse<EDocumentTransmission>> {
    return this.http.get<PaginatedResponse<EDocumentTransmission>>(`${this.edocBase}/transmissions`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getTransmission(id: string): Observable<ApiResponse<EDocumentTransmission>> {
    return this.http.get<ApiResponse<EDocumentTransmission>>(`${this.edocBase}/transmissions/${id}`);
  }

  sendDocument(network: EDocumentNetworkType, payload: SendEDocumentRequest): Observable<ApiResponse<EDocumentTransmission>> {
    return this.http.post<ApiResponse<EDocumentTransmission>>(`${this.edocBase}/${network}/transmissions`, payload);
  }

  getSignatures(documentId: string, query?: QueryFilterParams): Observable<PaginatedResponse<DocumentSignature>> {
    return this.http.get<PaginatedResponse<DocumentSignature>>(`${this.trustBase}/signatures`, {
      params: toHttpParams({ ...query, document_id: documentId }),
    });
  }

  signDocument(payload: SignDocumentRequest): Observable<ApiResponse<DocumentSignature>> {
    return this.http.post<ApiResponse<DocumentSignature>>(`${this.trustBase}/signatures`, payload);
  }

  verifySignature(signatureId: string): Observable<ApiResponse<VerifySignatureResult>> {
    return this.http.post<ApiResponse<VerifySignatureResult>>(`${this.trustBase}/signatures/${signatureId}/verify`, {});
  }

  getPreservationRecords(documentId: string, query?: QueryFilterParams): Observable<PaginatedResponse<PreservationRecord>> {
    return this.http.get<PaginatedResponse<PreservationRecord>>(`${this.trustBase}/preservation`, {
      params: toHttpParams({ ...query, document_id: documentId }),
    });
  }

  preserveDocument(payload: PreserveDocumentRequest): Observable<ApiResponse<PreservationRecord>> {
    return this.http.post<ApiResponse<PreservationRecord>>(`${this.trustBase}/preservation`, payload);
  }

  getSigningSettings(): Observable<ApiResponse<DocumentSigningSettings>> {
    return this.http.get<ApiResponse<DocumentSigningSettings>>(`${this.trustBase}/settings`);
  }

  updateSigningSettings(payload: UpdateDocumentSigningSettingsRequest): Observable<ApiResponse<DocumentSigningSettings>> {
    return this.http.put<ApiResponse<DocumentSigningSettings>>(`${this.trustBase}/settings`, payload);
  }
}
