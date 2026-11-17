import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, DocumentEmailRecord, DocumentEmailType, SendDocumentEmailPayload } from '../models';

/** Generic PDF and e-mail endpoints shared by every sales document (`/documents/{type}/{id}/...`). */
@Service()
export class DocumentsExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/documents`;

  /** PDF stream of an invoice, quote, order, delivery note or work order (`inline` renders it in the browser). */
  downloadPdf(type: DocumentEmailType, id: string, inline = false): Observable<Blob> {
    return this.http.get(`${this.base}/${type}/${id}/pdf`, {
      params: toHttpParams({ inline }),
      responseType: 'blob',
    });
  }

  sendByEmail(type: DocumentEmailType, id: string, payload: SendDocumentEmailPayload = {}): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/${type}/${id}/email`, payload);
  }

  getEmails(type: DocumentEmailType, id: string): Observable<ApiResponse<DocumentEmailRecord[]>> {
    return this.http.get<ApiResponse<DocumentEmailRecord[]>>(`${this.base}/${type}/${id}/emails`);
  }
}
