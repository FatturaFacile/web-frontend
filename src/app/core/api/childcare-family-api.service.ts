import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  FamilyAttendanceDay,
  FamilyChild,
  FamilyDailyReport,
  FamilyData,
  FamilyDocument,
  FamilyDocumentSigned,
  FamilyDocumentSignRequest,
  FamilyInvoice,
  FamilyMessage,
  FamilyMessageRequest,
} from '../models';

/** Family portal of the childcare module. The guardian token travels in the `X-Family-Token` header, never in the URL. */
@Service()
export class ChildcareFamilyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/childcare-family`;

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ 'X-Family-Token': token });
  }

  getChildren(token: string): Observable<FamilyData<FamilyChild[]>> {
    return this.http.get<FamilyData<FamilyChild[]>>(`${this.base}/children`, { headers: this.headers(token) });
  }

  /** `month` is `YYYY-MM`. */
  getAttendance(token: string, childId: string, month: string): Observable<FamilyData<FamilyAttendanceDay[]>> {
    return this.http.get<FamilyData<FamilyAttendanceDay[]>>(`${this.base}/children/${childId}/attendance`, {
      headers: this.headers(token),
      params: new HttpParams().set('month', month),
    });
  }

  /** `date` is `YYYY-MM-DD`. */
  getDailyReport(token: string, childId: string, date: string): Observable<FamilyData<FamilyDailyReport>> {
    return this.http.get<FamilyData<FamilyDailyReport>>(`${this.base}/children/${childId}/daily-report`, {
      headers: this.headers(token),
      params: new HttpParams().set('date', date),
    });
  }

  getInvoices(token: string): Observable<FamilyData<FamilyInvoice[]>> {
    return this.http.get<FamilyData<FamilyInvoice[]>>(`${this.base}/invoices`, { headers: this.headers(token) });
  }

  getDocuments(token: string): Observable<FamilyData<FamilyDocument[]>> {
    return this.http.get<FamilyData<FamilyDocument[]>>(`${this.base}/documents`, { headers: this.headers(token) });
  }

  downloadDocument(token: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/documents/${documentId}/download`, {
      headers: this.headers(token),
      responseType: 'blob',
    });
  }

  /** Signs a document: the typed name, the time and the guardian are recorded. */
  signDocument(token: string, documentId: string, payload: FamilyDocumentSignRequest): Observable<FamilyData<FamilyDocumentSigned>> {
    return this.http.post<FamilyData<FamilyDocumentSigned>>(`${this.base}/documents/${documentId}/sign`, payload, {
      headers: this.headers(token),
    });
  }

  /** Reading the messages marks those from the kindergarten as read. */
  getMessages(token: string): Observable<FamilyData<FamilyMessage[]>> {
    return this.http.get<FamilyData<FamilyMessage[]>>(`${this.base}/messages`, { headers: this.headers(token) });
  }

  sendMessage(token: string, payload: FamilyMessageRequest): Observable<FamilyData<{ id: string }>> {
    return this.http.post<FamilyData<{ id: string }>>(`${this.base}/messages`, payload, { headers: this.headers(token) });
  }
}
