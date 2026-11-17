import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse } from '../models';
import {
  ExtraListResponse,
  ExtraObject,
  ExtraParams,
  ExtraPayload,
  ExtraRecord,
  ExtraUploadFields,
} from './extra-api.types';

/** Associations: meetings, ballots, minutes, legal books, protocol, shifts, reimbursement attachments and privacy (GDPR). */
@Service()
export class AssociationsGovernanceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/associations`;

  getMeeting(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  updateMeeting(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}`, payload);
  }

  deleteMeeting(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meetings/${id}`);
  }

  addAgendaItem(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/agenda-items`, payload);
  }

  deleteAgendaItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/agenda-items/${id}`);
  }

  recordAgendaDecision(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/agenda-items/${id}/decision`, payload);
  }

  uploadMeetingAttachment(id: string, fields: ExtraUploadFields, file: File): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/attachments`, this.toFormData(fields, file));
  }

  downloadMeetingAttachment(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/meeting-attachments/${id}/download`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  addMeetingParticipant(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/participants`, payload);
  }

  removeMeetingParticipant(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meeting-participants/${id}`);
  }

  removeParticipantProxy(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meeting-participants/${id}/proxy`);
  }

  sendMeetingNotices(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/notices`, payload);
  }

  getMeetingDeliveries(id: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/meetings/${id}/deliveries`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadMeetingLetter(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/meetings/${id}/letter`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  recordMeetingAttendance(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/attendance`, payload);
  }

  addMeetingProxy(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/proxies`, payload);
  }

  getMeetingQuorum(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/meetings/${id}/quorum`, { params: params ? toHttpParams(params) : undefined });
  }

  holdMeeting(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/hold`, payload);
  }

  closeMeeting(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/close`, payload);
  }

  cancelMeeting(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/cancel`, payload);
  }

  createBallot(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/ballots`, payload);
  }

  getBallot(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/ballots/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  openBallot(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/ballots/${id}/open`, {});
  }

  closeBallot(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/ballots/${id}/close`, {});
  }

  recordBallotVote(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/ballots/${id}/votes`, payload);
  }

  createMinutes(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/meetings/${id}/minutes`, payload);
  }

  getMinutes(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/minutes/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  updateMinutes(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/minutes/${id}`, payload);
  }

  approveMinutes(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/minutes/${id}/approve`, payload);
  }

  downloadMinutesPdf(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/minutes/${id}/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  distributeMinutes(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/minutes/${id}/distribute`, payload);
  }

  getMinutesDeliveries(id: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/minutes/${id}/deliveries`, { params: params ? toHttpParams(params) : undefined });
  }

  getBook(book: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/books/${book}`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadBookCsv(book: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/books/${book}/csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  downloadBookPdf(book: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/books/${book}/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getArchive(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/archive`, { params: params ? toHttpParams(params) : undefined });
  }

  getProtocol(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/protocol`, { params: params ? toHttpParams(params) : undefined });
  }

  registerProtocolEntry(fields: ExtraUploadFields = {}, file: File | null = null): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/protocol`, this.toFormData(fields, file));
  }

  cancelProtocolEntry(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/protocol/${id}/cancel`, payload);
  }

  downloadProtocolEntry(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/protocol/${id}/download`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getShiftsNeedingAttention(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/shifts/attention`, { params: params ? toHttpParams(params) : undefined });
  }

  setShiftAvailability(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/shifts/${id}/availability`, payload);
  }

  assignShift(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/shifts/${id}/assignments`, payload);
  }

  getShiftCoverage(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/shifts/${id}/coverage`, { params: params ? toHttpParams(params) : undefined });
  }

  requestShiftSubstitution(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/shift-assignments/${id}/substitution-request`, payload);
  }

  assignShiftSubstitute(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/shift-assignments/${id}/substitute`, payload);
  }

  uploadReimbursementAttachment(id: string, fields: ExtraUploadFields, file: File): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/reimbursements/${id}/attachments`, this.toFormData(fields, file));
  }

  downloadReimbursementAttachment(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/reimbursement-attachments/${id}/download`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getPrivacyActivities(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/privacy/activities`, { params: params ? toHttpParams(params) : undefined });
  }

  createPrivacyActivity(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/activities`, payload);
  }

  updatePrivacyActivity(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/privacy/activities/${id}`, payload);
  }

  finalizePrivacyActivity(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/activities/${id}/finalize`, payload);
  }

  addPrivacyActivityVersion(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/activities/${id}/versions`, payload);
  }

  getPrivacyActivityNotice(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/privacy/activities/${id}/notice`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadPrivacyActivityNoticePdf(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/privacy/activities/${id}/notice/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getPrivacyRegister(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/privacy/register`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadPrivacyRegisterCsv(params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/privacy/register/csv`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  downloadPrivacyRegisterPdf(params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/privacy/register/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  downloadPrivacyAppointment(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/privacy/subjects/${id}/appointment`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getPrivacyConsents(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/privacy/consents`, { params: params ? toHttpParams(params) : undefined });
  }

  recordPrivacyConsent(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/consents`, payload);
  }

  withdrawPrivacyConsent(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/consents/${id}/withdraw`, payload);
  }

  getPrivacyRequests(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/privacy/requests`, { params: params ? toHttpParams(params) : undefined });
  }

  createPrivacyRequest(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/requests`, payload);
  }

  extendPrivacyRequest(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/requests/${id}/extend`, payload);
  }

  getPrivacyErasurePreview(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/privacy/requests/${id}/erasure-preview`, { params: params ? toHttpParams(params) : undefined });
  }

  completePrivacyRequest(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/requests/${id}/complete`, payload);
  }

  rejectPrivacyRequest(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/privacy/requests/${id}/reject`, payload);
  }

  getPrivacyRequestExport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/privacy/requests/${id}/export`, { params: params ? toHttpParams(params) : undefined });
  }

  private toFormData(fields: ExtraUploadFields, file: File | null): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }
    if (file) {
      formData.append('file', file);
    }
    return formData;
  }
}
