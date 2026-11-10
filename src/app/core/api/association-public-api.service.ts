import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, AssociationApplicationStatus, AssociationPublicForm, AssociationPublicSubmission } from '../models';

/** Public enrolment form of an association: the token of the link identifies the form, no login is needed. */
@Service()
export class AssociationPublicApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/association-public/enrolment`;

  getForm(token: string): Observable<ApiResponse<AssociationPublicForm>> {
    return this.http.get<ApiResponse<AssociationPublicForm>>(`${this.base}/${token}`);
  }

  /** Sends the application as multipart form data (`extra[code]` and `documents[documentId]` carry the custom parts). */
  submit(token: string, payload: FormData): Observable<ApiResponse<AssociationPublicSubmission>> {
    return this.http.post<ApiResponse<AssociationPublicSubmission>>(`${this.base}/${token}`, payload);
  }

  downloadTemplate(token: string, documentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${token}/documents/${documentId}`, { responseType: 'blob' });
  }

  trackApplication(token: string, trackingCode: string): Observable<ApiResponse<{ status: AssociationApplicationStatus }>> {
    return this.http.get<ApiResponse<{ status: AssociationApplicationStatus }>>(
      `${this.base}/${token}/applications/${encodeURIComponent(trackingCode)}`,
    );
  }
}
