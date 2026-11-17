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

/** Associations: settings, catalogs, registry, memberships, enrolment, fees, courses, access control and network (endpoints not covered by `AssociationsApiService`). */
@Service()
export class AssociationsExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/associations`;

  getSettings(params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/settings`, { params: params ? toHttpParams(params) : undefined });
  }

  updateSettings(payload: ExtraPayload): Observable<ApiResponse<ExtraObject>> {
    return this.http.put<ApiResponse<ExtraObject>>(`${this.base}/settings`, payload);
  }

  listCatalog(catalog: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/catalogs/${catalog}`, { params: params ? toHttpParams(params) : undefined });
  }

  createCatalogEntry(catalog: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/catalogs/${catalog}`, payload);
  }

  getCatalogEntry(catalog: string, id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/catalogs/${catalog}/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  updateCatalogEntry(catalog: string, id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/catalogs/${catalog}/${id}`, payload);
  }

  deleteCatalogEntry(catalog: string, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/catalogs/${catalog}/${id}`);
  }

  exportMembers(params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/members/export`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  setMemberRegistryTypes(memberId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/members/${memberId}/registry-types`, payload);
  }

  setMemberSocialRoles(memberId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/members/${memberId}/social-roles`, payload);
  }

  createRegistryImport(fields: ExtraUploadFields, file: File): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/registry-imports`, this.toFormData(fields, file));
  }

  getRegistryImport(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/registry-imports/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  commitRegistryImport(id: string): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/registry-imports/${id}/commit`, {});
  }

  getMemberDocuments(memberId: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/members/${memberId}/documents`, { params: params ? toHttpParams(params) : undefined });
  }

  uploadMemberDocument(memberId: string, fields: ExtraUploadFields, file: File): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/members/${memberId}/documents`, this.toFormData(fields, file));
  }

  getExpiringMemberDocuments(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/member-documents/expiring`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadMemberDocument(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/member-documents/${id}/download`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  deleteMemberDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/member-documents/${id}`);
  }

  getMemberGuardians(memberId: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/members/${memberId}/guardians`, { params: params ? toHttpParams(params) : undefined });
  }

  addMemberGuardian(memberId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/members/${memberId}/guardians`, payload);
  }

  deleteGuardian(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/guardians/${id}`);
  }

  getMemberAuthorizations(memberId: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/members/${memberId}/authorizations`, { params: params ? toHttpParams(params) : undefined });
  }

  createMemberAuthorization(memberId: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/members/${memberId}/authorizations`, payload);
  }

  revokeAuthorization(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/authorizations/${id}/revoke`, payload);
  }

  createContactAreaLink(contactId: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraObject>> {
    return this.http.post<ApiResponse<ExtraObject>>(`${this.base}/contacts/${contactId}/area-link`, payload);
  }

  deleteContactAreaLink(contactId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/contacts/${contactId}/area-link`);
  }

  getMemberships(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/memberships`, { params: params ? toHttpParams(params) : undefined });
  }

  createMembership(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/memberships`, payload);
  }

  getMembership(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/memberships/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  activateMembership(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/memberships/${id}/activate`, payload);
  }

  renewMembership(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/memberships/${id}/renew`, payload);
  }

  suspendMembership(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/memberships/${id}/suspend`, payload);
  }

  ceaseMembership(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/memberships/${id}/cease`, payload);
  }

  downloadMembershipCard(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/memberships/${id}/card`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  issueMemberQr(memberId: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraObject>> {
    return this.http.post<ApiResponse<ExtraObject>>(`${this.base}/members/${memberId}/qr`, payload);
  }

  issueMemberBadge(memberId: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraObject>> {
    return this.http.post<ApiResponse<ExtraObject>>(`${this.base}/members/${memberId}/badges`, payload);
  }

  deleteCredential(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/credentials/${id}`);
  }

  getEnrolmentForms(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/enrolment-forms`, { params: params ? toHttpParams(params) : undefined });
  }

  createEnrolmentForm(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-forms`, payload);
  }

  getEnrolmentForm(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-forms/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  updateEnrolmentForm(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.put<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-forms/${id}`, payload);
  }

  deleteEnrolmentForm(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/enrolment-forms/${id}`);
  }

  addEnrolmentFormDocument(id: string, fields: ExtraUploadFields = {}, file: File | null = null): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-forms/${id}/documents`, this.toFormData(fields, file));
  }

  deleteEnrolmentFormDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/enrolment-form-documents/${id}`);
  }

  getEnrolmentApplications(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/enrolment-applications`, { params: params ? toHttpParams(params) : undefined });
  }

  getEnrolmentApplication(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-applications/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  approveEnrolmentApplication(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-applications/${id}/approve`, payload);
  }

  rejectEnrolmentApplication(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/enrolment-applications/${id}/reject`, payload);
  }

  downloadEnrolmentUpload(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/enrolment-uploads/${id}/download`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getInstalments(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/instalments`, { params: params ? toHttpParams(params) : undefined });
  }

  createInstalmentPaymentLink(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraObject>> {
    return this.http.post<ApiResponse<ExtraObject>>(`${this.base}/instalments/${id}/payment-link`, payload);
  }

  reverseFeePayment(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/fee-payments/${id}/reverse`, payload);
  }

  getReceipts(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/receipts`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadReceiptPdf(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/receipts/${id}/pdf`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  getCourse(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraRecord>> {
    return this.http.get<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}`, { params: params ? toHttpParams(params) : undefined });
  }

  getCourseCalendar(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/courses/${id}/calendar`, { params: params ? toHttpParams(params) : undefined });
  }

  addCourseSchedule(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/schedules`, payload);
  }

  deleteCourseSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/course-schedules/${id}`);
  }

  addCourseSuspension(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/suspensions`, payload);
  }

  deleteCourseSuspension(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/course-suspensions/${id}`);
  }

  addCourseInstructor(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/instructors`, payload);
  }

  deleteCourseInstructor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/course-instructors/${id}`);
  }

  withdrawCourseEnrolment(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/course-enrolments/${id}/withdraw`, payload);
  }

  getCourseAttendance(id: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/courses/${id}/attendance`, { params: params ? toHttpParams(params) : undefined });
  }

  recordCourseAttendance(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/attendance`, payload);
  }

  bookCourseLessons(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/book-lessons`, payload);
  }

  addCourseTicketType(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/ticket-types`, payload);
  }

  getCourseRegistrations(id: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/courses/${id}/registrations`, { params: params ? toHttpParams(params) : undefined });
  }

  checkInCourseEvent(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/courses/${id}/check-in`, payload);
  }

  registerForTicketType(id: string, payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/ticket-types/${id}/registrations`, payload);
  }

  cancelEventRegistration(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/event-registrations/${id}/cancel`, payload);
  }

  getBookings(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/bookings`, { params: params ? toHttpParams(params) : undefined });
  }

  createBooking(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/bookings`, payload);
  }

  cancelBooking(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/bookings/${id}/cancel`, payload);
  }

  getExpiredCertificates(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/certificates/expired`, { params: params ? toHttpParams(params) : undefined });
  }

  getExpiringCertificates(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/certificates/expiring`, { params: params ? toHttpParams(params) : undefined });
  }

  downloadCertificate(id: string, params?: ExtraParams): Observable<Blob> {
    return this.http.get(`${this.base}/certificates/${id}/download`, { params: params ? toHttpParams(params) : undefined, responseType: 'blob' });
  }

  deleteCertificate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/certificates/${id}`);
  }

  getMemberCertificates(memberId: string, params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/members/${memberId}/certificates`, { params: params ? toHttpParams(params) : undefined });
  }

  addMemberCertificate(memberId: string, fields: ExtraUploadFields = {}, file: File | null = null): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/members/${memberId}/certificates`, this.toFormData(fields, file));
  }

  getAccessDevices(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/access-devices`, { params: params ? toHttpParams(params) : undefined });
  }

  createAccessDevice(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/access-devices`, payload);
  }

  rotateAccessDeviceSecret(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraObject>> {
    return this.http.post<ApiResponse<ExtraObject>>(`${this.base}/access-devices/${id}/rotate-secret`, payload);
  }

  deactivateAccessDevice(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/access-devices/${id}/deactivate`, payload);
  }

  getAccessLogs(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/access-logs`, { params: params ? toHttpParams(params) : undefined });
  }

  getAccessAreaOccupancy(id: string, params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/access-areas/${id}/occupancy`, { params: params ? toHttpParams(params) : undefined });
  }

  getNetworkCode(params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/network/code`, { params: params ? toHttpParams(params) : undefined });
  }

  addNetworkAffiliate(payload: ExtraPayload): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/network/affiliates`, payload);
  }

  getNetworkConsents(params?: ExtraParams): Observable<ExtraListResponse> {
    return this.http.get<ExtraListResponse>(`${this.base}/network/consents`, { params: params ? toHttpParams(params) : undefined });
  }

  grantNetworkConsent(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/network/consents/${id}/grant`, payload);
  }

  withdrawNetworkConsent(id: string, payload: ExtraPayload = {}): Observable<ApiResponse<ExtraRecord>> {
    return this.http.post<ApiResponse<ExtraRecord>>(`${this.base}/network/consents/${id}/withdraw`, payload);
  }

  getNetworkFigures(params?: ExtraParams): Observable<ApiResponse<ExtraObject>> {
    return this.http.get<ApiResponse<ExtraObject>>(`${this.base}/network/figures`, { params: params ? toHttpParams(params) : undefined });
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
