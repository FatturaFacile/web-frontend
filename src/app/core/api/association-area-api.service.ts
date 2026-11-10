import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AssociationAreaCalendarEntry,
  AssociationAreaCard,
  AssociationAreaContact,
  AssociationAreaContactRequest,
  AssociationAreaFees,
  AssociationAreaInstructorCourse,
  AssociationAreaMe,
  AssociationAreaParticipant,
  AssociationAreaPaymentLink,
  AssociationAreaRecord,
  AssociationAttendanceRequest,
} from '../models';

/**
 * Member area of an association. It is not behind the session login: the personal token of the emailed
 * link travels in the `X-Area-Token` header and selects the person and the tenant.
 */
@Service()
export class AssociationAreaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/association-area`;

  /** Token of the personal link, kept in memory only. */
  readonly token = signal<string | null>(null);

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Area-Token': this.token() ?? '' });
  }

  me(): Observable<ApiResponse<AssociationAreaMe>> {
    return this.http.get<ApiResponse<AssociationAreaMe>>(`${this.base}/me`, { headers: this.headers });
  }

  updateContact(payload: AssociationAreaContactRequest): Observable<ApiResponse<AssociationAreaContact>> {
    return this.http.put<ApiResponse<AssociationAreaContact>>(`${this.base}/me/contact`, payload, { headers: this.headers });
  }

  updateWardContact(memberId: string, payload: AssociationAreaContactRequest): Observable<ApiResponse<AssociationAreaContact>> {
    return this.http.put<ApiResponse<AssociationAreaContact>>(`${this.base}/members/${memberId}/contact`, payload, {
      headers: this.headers,
    });
  }

  card(memberId: string): Observable<ApiResponse<AssociationAreaCard>> {
    return this.http.get<ApiResponse<AssociationAreaCard>>(`${this.base}/members/${memberId}/card`, { headers: this.headers });
  }

  cardPdf(memberId: string): Observable<Blob> {
    return this.http.get(`${this.base}/members/${memberId}/card/pdf`, { headers: this.headers, responseType: 'blob' });
  }

  fees(memberId: string): Observable<ApiResponse<AssociationAreaFees>> {
    return this.http.get<ApiResponse<AssociationAreaFees>>(`${this.base}/members/${memberId}/fees`, { headers: this.headers });
  }

  payInstalment(instalmentId: string): Observable<ApiResponse<AssociationAreaPaymentLink>> {
    return this.http.post<ApiResponse<AssociationAreaPaymentLink>>(`${this.base}/instalments/${instalmentId}/pay`, {}, {
      headers: this.headers,
    });
  }

  receipts(memberId: string): Observable<ApiResponse<AssociationAreaRecord[]>> {
    return this.http.get<ApiResponse<AssociationAreaRecord[]>>(`${this.base}/members/${memberId}/receipts`, { headers: this.headers });
  }

  receiptPdf(receiptId: string): Observable<Blob> {
    return this.http.get(`${this.base}/receipts/${receiptId}/pdf`, { headers: this.headers, responseType: 'blob' });
  }

  calendar(memberId: string): Observable<ApiResponse<AssociationAreaCalendarEntry[]>> {
    return this.http.get<ApiResponse<AssociationAreaCalendarEntry[]>>(`${this.base}/members/${memberId}/calendar`, {
      headers: this.headers,
    });
  }

  documents(memberId: string): Observable<ApiResponse<AssociationAreaRecord[]>> {
    return this.http.get<ApiResponse<AssociationAreaRecord[]>>(`${this.base}/members/${memberId}/documents`, { headers: this.headers });
  }

  downloadDocument(memberId: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/members/${memberId}/documents/${documentId}/download`, {
      headers: this.headers,
      responseType: 'blob',
    });
  }

  authorizations(memberId: string): Observable<ApiResponse<AssociationAreaRecord[]>> {
    return this.http.get<ApiResponse<AssociationAreaRecord[]>>(`${this.base}/members/${memberId}/authorizations`, {
      headers: this.headers,
    });
  }

  signAuthorization(memberId: string, authorizationId: string, signedName: string): Observable<ApiResponse<AssociationAreaRecord>> {
    return this.http.post<ApiResponse<AssociationAreaRecord>>(
      `${this.base}/members/${memberId}/authorizations/${authorizationId}/sign`,
      { signed_name: signedName },
      { headers: this.headers },
    );
  }

  instructorCourses(): Observable<ApiResponse<AssociationAreaInstructorCourse[]>> {
    return this.http.get<ApiResponse<AssociationAreaInstructorCourse[]>>(`${this.base}/instructor/courses`, { headers: this.headers });
  }

  instructorParticipants(courseId: string): Observable<ApiResponse<AssociationAreaParticipant[]>> {
    return this.http.get<ApiResponse<AssociationAreaParticipant[]>>(`${this.base}/instructor/courses/${courseId}/participants`, {
      headers: this.headers,
    });
  }

  recordInstructorAttendance(courseId: string, payload: AssociationAttendanceRequest): Observable<ApiResponse<AssociationAreaRecord[]>> {
    return this.http.post<ApiResponse<AssociationAreaRecord[]>>(`${this.base}/instructor/courses/${courseId}/attendance`, payload, {
      headers: this.headers,
    });
  }
}
