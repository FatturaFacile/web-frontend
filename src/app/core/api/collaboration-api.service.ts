import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CollaborationActivity,
  CollaborationAttachTagRequest,
  CollaborationComment,
  CollaborationCommentRequest,
  CollaborationMentionableUser,
  CollaborationRecordType,
  CollaborationRecordTypeKey,
  CollaborationResponse,
  CollaborationSearchFilters,
  CollaborationSearchResult,
  CollaborationTag,
  CollaborationTagRequest,
} from '../models';

@Service()
export class CollaborationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/collaboration`;

  // Global search
  search(filters: CollaborationSearchFilters): Observable<CollaborationResponse<CollaborationSearchResult[]>> {
    let params = new HttpParams().set('q', filters.q);

    for (const type of filters.types ?? []) {
      params = params.append('types[]', type);
    }

    if (filters.limit !== undefined) {
      params = params.set('limit', filters.limit);
    }

    return this.http.get<CollaborationResponse<CollaborationSearchResult[]>>(`${this.base}/search`, { params });
  }

  getRecordTypes(): Observable<CollaborationResponse<CollaborationRecordType[]>> {
    return this.http.get<CollaborationResponse<CollaborationRecordType[]>>(`${this.base}/record-types`);
  }

  getMentionableUsers(q?: string): Observable<CollaborationResponse<CollaborationMentionableUser[]>> {
    const params = q ? new HttpParams().set('q', q) : new HttpParams();
    return this.http.get<CollaborationResponse<CollaborationMentionableUser[]>>(`${this.base}/mentionable-users`, { params });
  }

  // Comments
  getComments(type: CollaborationRecordTypeKey, recordId: string): Observable<CollaborationResponse<CollaborationComment[]>> {
    return this.http.get<CollaborationResponse<CollaborationComment[]>>(`${this.recordUrl(type, recordId)}/comments`);
  }

  createComment(type: CollaborationRecordTypeKey, recordId: string, payload: CollaborationCommentRequest): Observable<CollaborationResponse<CollaborationComment>> {
    return this.http.post<CollaborationResponse<CollaborationComment>>(`${this.recordUrl(type, recordId)}/comments`, payload);
  }

  updateComment(id: string, payload: CollaborationCommentRequest): Observable<CollaborationResponse<CollaborationComment>> {
    return this.http.put<CollaborationResponse<CollaborationComment>>(`${this.base}/comments/${id}`, payload);
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/comments/${id}`);
  }

  // Tags
  getTags(q?: string): Observable<CollaborationResponse<CollaborationTag[]>> {
    const params = q ? new HttpParams().set('q', q) : new HttpParams();
    return this.http.get<CollaborationResponse<CollaborationTag[]>>(`${this.base}/tags`, { params });
  }

  createTag(payload: CollaborationTagRequest): Observable<CollaborationResponse<CollaborationTag>> {
    return this.http.post<CollaborationResponse<CollaborationTag>>(`${this.base}/tags`, payload);
  }

  updateTag(id: string, payload: Partial<CollaborationTagRequest>): Observable<CollaborationResponse<CollaborationTag>> {
    return this.http.put<CollaborationResponse<CollaborationTag>>(`${this.base}/tags/${id}`, payload);
  }

  deleteTag(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tags/${id}`);
  }

  getTagRecords(id: string, type?: CollaborationRecordTypeKey): Observable<CollaborationResponse<CollaborationSearchResult[]>> {
    const params = type ? new HttpParams().set('type', type) : new HttpParams();
    return this.http.get<CollaborationResponse<CollaborationSearchResult[]>>(`${this.base}/tags/${id}/records`, { params });
  }

  getRecordTags(type: CollaborationRecordTypeKey, recordId: string): Observable<CollaborationResponse<CollaborationTag[]>> {
    return this.http.get<CollaborationResponse<CollaborationTag[]>>(`${this.recordUrl(type, recordId)}/tags`);
  }

  attachTag(type: CollaborationRecordTypeKey, recordId: string, payload: CollaborationAttachTagRequest): Observable<CollaborationResponse<CollaborationTag[]>> {
    return this.http.post<CollaborationResponse<CollaborationTag[]>>(`${this.recordUrl(type, recordId)}/tags`, payload);
  }

  detachTag(type: CollaborationRecordTypeKey, recordId: string, tagId: string): Observable<void> {
    return this.http.delete<void>(`${this.recordUrl(type, recordId)}/tags/${tagId}`);
  }

  // Activity
  getActivity(type: CollaborationRecordTypeKey, recordId: string): Observable<CollaborationResponse<CollaborationActivity[]>> {
    return this.http.get<CollaborationResponse<CollaborationActivity[]>>(`${this.recordUrl(type, recordId)}/activity`);
  }

  private recordUrl(type: CollaborationRecordTypeKey, recordId: string): string {
    return `${this.base}/records/${encodeURIComponent(type)}/${encodeURIComponent(recordId)}`;
  }
}
