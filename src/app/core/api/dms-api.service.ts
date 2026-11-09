import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  DmsAiSettingsResource,
  DmsAuditEntry,
  DmsCheckOutRequest,
  DmsConfirmExtractionRequest,
  DmsDocumentParams,
  DmsDocumentResource,
  DmsDocumentVersionResource,
  DmsExtractionResource,
  DmsFolderResource,
  DmsImportAttachmentRequest,
  DmsLinkDocumentRequest,
  DmsPlaceLegalHoldRequest,
  DmsResolvedLink,
  DmsRetentionPolicyResource,
  DmsStoreDocumentRequest,
  DmsStoreFolderRequest,
  DmsStoreRetentionPolicyRequest,
  DmsStoreTagRequest,
  DmsTagResource,
  DmsUpdateAiSettingRequest,
  DmsUpdateDocumentRequest,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class DmsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- DOCUMENTS ---
  getDocuments(params?: DmsDocumentParams): Observable<PaginatedResponse<DmsDocumentResource>> {
    return this.http.get<PaginatedResponse<DmsDocumentResource>>(`${this.base}/dms/documents`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getDocument(id: string): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.get<ApiResponse<DmsDocumentResource>>(`${this.base}/dms/documents/${id}`);
  }

  createDocument(payload: DmsStoreDocumentRequest): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.post<ApiResponse<DmsDocumentResource>>(`${this.base}/dms/documents`, payload);
  }

  updateDocument(
    id: string,
    payload: DmsUpdateDocumentRequest,
  ): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.put<ApiResponse<DmsDocumentResource>>(`${this.base}/dms/documents/${id}`, payload);
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dms/documents/${id}`);
  }

  getDuplicates(params?: { sha256?: string; title?: string }): Observable<ApiResponse<DmsDocumentResource[]>> {
    return this.http.get<ApiResponse<DmsDocumentResource[]>>(`${this.base}/dms/documents/duplicates`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  importAttachment(payload: DmsImportAttachmentRequest): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.post<ApiResponse<DmsDocumentResource>>(
      `${this.base}/dms/documents/import-attachment`,
      payload,
    );
  }

  // --- CHECK-OUT / CHECK-IN ---
  checkOutDocument(
    id: string,
    payload?: DmsCheckOutRequest,
  ): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.post<ApiResponse<DmsDocumentResource>>(
      `${this.base}/dms/documents/${id}/check-out`,
      payload || {},
    );
  }

  checkInDocument(
    id: string,
    payload: { original_name: string; sha256: string; size: number },
  ): Observable<ApiResponse<DmsDocumentVersionResource>> {
    return this.http.post<ApiResponse<DmsDocumentVersionResource>>(
      `${this.base}/dms/documents/${id}/check-in`,
      payload,
    );
  }

  cancelCheckOut(id: string): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.delete<ApiResponse<DmsDocumentResource>>(
      `${this.base}/dms/documents/${id}/check-out`,
    );
  }

  // --- LEGAL HOLD ---
  placeLegalHold(
    id: string,
    payload: DmsPlaceLegalHoldRequest,
  ): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.post<ApiResponse<DmsDocumentResource>>(
      `${this.base}/dms/documents/${id}/legal-hold`,
      payload,
    );
  }

  releaseLegalHold(id: string): Observable<ApiResponse<DmsDocumentResource>> {
    return this.http.delete<ApiResponse<DmsDocumentResource>>(
      `${this.base}/dms/documents/${id}/legal-hold`,
    );
  }

  // --- AUDIT TRAIL ---
  getDocumentAuditTrail(id: string): Observable<ApiResponse<DmsAuditEntry[]>> {
    return this.http.get<ApiResponse<DmsAuditEntry[]>>(`${this.base}/dms/documents/${id}/audit-trail`);
  }

  // --- VERSIONS ---
  getDocumentVersions(id: string): Observable<ApiResponse<DmsDocumentVersionResource[]>> {
    return this.http.get<ApiResponse<DmsDocumentVersionResource[]>>(
      `${this.base}/dms/documents/${id}/versions`,
    );
  }

  createDocumentVersion(
    id: string,
    payload: { original_name: string; sha256: string; size: number },
  ): Observable<ApiResponse<DmsDocumentVersionResource>> {
    return this.http.post<ApiResponse<DmsDocumentVersionResource>>(
      `${this.base}/dms/documents/${id}/versions`,
      payload,
    );
  }

  downloadVersion(id: string, versionId: string): Observable<Blob> {
    return this.http.get(`${this.base}/dms/documents/${id}/versions/${versionId}/download`, {
      responseType: 'blob',
    });
  }

  verifyVersion(
    id: string,
    versionId: string,
  ): Observable<ApiResponse<{ is_valid: boolean; current_sha256: string; expected_sha256: string }>> {
    return this.http.get<
      ApiResponse<{ is_valid: boolean; current_sha256: string; expected_sha256: string }>
    >(`${this.base}/dms/documents/${id}/versions/${versionId}/verify`);
  }

  // --- LINKS ---
  getDocumentLinks(id: string): Observable<ApiResponse<DmsResolvedLink[]>> {
    return this.http.get<ApiResponse<DmsResolvedLink[]>>(`${this.base}/dms/documents/${id}/links`);
  }

  linkDocument(
    id: string,
    payload: DmsLinkDocumentRequest,
  ): Observable<ApiResponse<DmsResolvedLink>> {
    return this.http.post<ApiResponse<DmsResolvedLink>>(`${this.base}/dms/documents/${id}/links`, payload);
  }

  removeLink(id: string, linkId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dms/documents/${id}/links/${linkId}`);
  }

  // --- EXTRACTIONS (OCR / AI) ---
  getDocumentExtractions(id: string): Observable<ApiResponse<DmsExtractionResource[]>> {
    return this.http.get<ApiResponse<DmsExtractionResource[]>>(
      `${this.base}/dms/documents/${id}/extractions`,
    );
  }

  confirmExtraction(
    extractionId: string,
    payload?: DmsConfirmExtractionRequest,
  ): Observable<ApiResponse<DmsExtractionResource>> {
    return this.http.post<ApiResponse<DmsExtractionResource>>(
      `${this.base}/dms/extractions/${extractionId}/confirm`,
      payload || {},
    );
  }

  rejectExtraction(extractionId: string): Observable<ApiResponse<DmsExtractionResource>> {
    return this.http.post<ApiResponse<DmsExtractionResource>>(
      `${this.base}/dms/extractions/${extractionId}/reject`,
      {},
    );
  }

  // --- FOLDERS ---
  getFolders(): Observable<ApiResponse<DmsFolderResource[]>> {
    return this.http.get<ApiResponse<DmsFolderResource[]>>(`${this.base}/dms/folders`);
  }

  createFolder(payload: DmsStoreFolderRequest): Observable<ApiResponse<DmsFolderResource>> {
    return this.http.post<ApiResponse<DmsFolderResource>>(`${this.base}/dms/folders`, payload);
  }

  updateFolder(
    id: string,
    payload: Partial<DmsStoreFolderRequest>,
  ): Observable<ApiResponse<DmsFolderResource>> {
    return this.http.put<ApiResponse<DmsFolderResource>>(`${this.base}/dms/folders/${id}`, payload);
  }

  deleteFolder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dms/folders/${id}`);
  }

  // --- TAGS ---
  getTags(): Observable<ApiResponse<DmsTagResource[]>> {
    return this.http.get<ApiResponse<DmsTagResource[]>>(`${this.base}/dms/tags`);
  }

  createTag(payload: DmsStoreTagRequest): Observable<ApiResponse<DmsTagResource>> {
    return this.http.post<ApiResponse<DmsTagResource>>(`${this.base}/dms/tags`, payload);
  }

  deleteTag(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dms/tags/${id}`);
  }

  // --- RETENTION POLICIES ---
  getRetentionPolicies(): Observable<ApiResponse<DmsRetentionPolicyResource[]>> {
    return this.http.get<ApiResponse<DmsRetentionPolicyResource[]>>(
      `${this.base}/dms/retention-policies`,
    );
  }

  createRetentionPolicy(
    payload: DmsStoreRetentionPolicyRequest,
  ): Observable<ApiResponse<DmsRetentionPolicyResource>> {
    return this.http.post<ApiResponse<DmsRetentionPolicyResource>>(
      `${this.base}/dms/retention-policies`,
      payload,
    );
  }

  updateRetentionPolicy(
    id: string,
    payload: Partial<DmsStoreRetentionPolicyRequest>,
  ): Observable<ApiResponse<DmsRetentionPolicyResource>> {
    return this.http.put<ApiResponse<DmsRetentionPolicyResource>>(
      `${this.base}/dms/retention-policies/${id}`,
      payload,
    );
  }

  deleteRetentionPolicy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dms/retention-policies/${id}`);
  }

  // --- AI SETTINGS ---
  getAiSettings(): Observable<ApiResponse<DmsAiSettingsResource>> {
    return this.http.get<ApiResponse<DmsAiSettingsResource>>(`${this.base}/dms/ai-settings`);
  }

  updateAiSettings(
    payload: DmsUpdateAiSettingRequest,
  ): Observable<ApiResponse<DmsAiSettingsResource>> {
    return this.http.put<ApiResponse<DmsAiSettingsResource>>(`${this.base}/dms/ai-settings`, payload);
  }
}
