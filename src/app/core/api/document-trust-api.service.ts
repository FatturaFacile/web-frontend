import { HttpClient, HttpParams } from '@angular/common/http';
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
  PreservationRecord,
  PreserveDocumentRequest,
  SendEDocumentRequest,
  SignDocumentRequest,
  UpdateDocumentSigningSettingsRequest,
  VerifySignatureResult,
} from '../models';

@Service()
export class DocumentTrustApiService {
  private readonly http = inject(HttpClient);
  private readonly edocBase = `${environment.apiBaseUrl}/edocument-networks`;
  private readonly trustBase = `${environment.apiBaseUrl}/document-trust`;

  getNetworks(): Observable<ApiResponse<EDocumentNetworkStatus[]>> {
    return this.http.get<ApiResponse<EDocumentNetworkStatus[]>>(this.edocBase);
  }

  getTransmissions(filters?: {
    network?: string;
    status?: string;
    document_reference?: string;
    per_page?: number;
  }): Observable<ApiResponse<EDocumentTransmission[]>> {
    let params = new HttpParams();
    if (filters?.network) {
      params = params.set('network', filters.network);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.document_reference) {
      params = params.set('document_reference', filters.document_reference);
    }
    if (filters?.per_page) {
      params = params.set('per_page', filters.per_page.toString());
    }
    return this.http.get<ApiResponse<EDocumentTransmission[]>>(`${this.edocBase}/transmissions`, { params });
  }

  getTransmission(id: string): Observable<ApiResponse<EDocumentTransmission>> {
    return this.http.get<ApiResponse<EDocumentTransmission>>(`${this.edocBase}/transmissions/${id}`);
  }

  sendDocument(network: EDocumentNetworkType, payload: SendEDocumentRequest): Observable<ApiResponse<EDocumentTransmission>> {
    return this.http.post<ApiResponse<EDocumentTransmission>>(`${this.edocBase}/${network}/transmissions`, payload);
  }

  getSignatures(documentId: string): Observable<ApiResponse<DocumentSignature[]>> {
    const params = new HttpParams().set('document_id', documentId);
    return this.http.get<ApiResponse<DocumentSignature[]>>(`${this.trustBase}/signatures`, { params });
  }

  signDocument(payload: SignDocumentRequest): Observable<ApiResponse<DocumentSignature>> {
    return this.http.post<ApiResponse<DocumentSignature>>(`${this.trustBase}/signatures`, payload);
  }

  verifySignature(signatureId: string): Observable<ApiResponse<VerifySignatureResult>> {
    return this.http.post<ApiResponse<VerifySignatureResult>>(`${this.trustBase}/signatures/${signatureId}/verify`, {});
  }

  getPreservationRecords(documentId: string): Observable<ApiResponse<PreservationRecord[]>> {
    const params = new HttpParams().set('document_id', documentId);
    return this.http.get<ApiResponse<PreservationRecord[]>>(`${this.trustBase}/preservation`, { params });
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
