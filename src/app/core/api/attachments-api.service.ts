import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';
import { ExtraRecord } from './extra-api.types';

/** Record types an attachment can be linked to (`Attachment::TARGET_TYPES`). */
export type AttachableType =
  | 'contact'
  | 'invoice'
  | 'quote'
  | 'sales_order'
  | 'delivery_note'
  | 'work_order'
  | 'purchase_order'
  | 'supplier_invoice'
  | 'service_report'
  | 'ticket'
  | 'appointment'
  | 'expense';

/** Generic file attachments of business records (`/attachments`). */
@Service()
export class AttachmentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/attachments`;

  list(attachableType: AttachableType, attachableId: string): Observable<ApiResponse<ExtraRecord[]>> {
    return this.http.get<ApiResponse<ExtraRecord[]>>(this.base, {
      params: { attachable_type: attachableType, attachable_id: attachableId },
    });
  }

  /** Uploads a file (max 25 MB: pdf, images, office documents, csv, txt, xml, zip). */
  upload(attachableType: AttachableType, attachableId: string, file: File): Observable<ApiResponse<ExtraRecord>> {
    const formData = new FormData();
    formData.append('attachable_type', attachableType);
    formData.append('attachable_id', attachableId);
    formData.append('file', file);
    return this.http.post<ApiResponse<ExtraRecord>>(this.base, formData);
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/download`, { responseType: 'blob' });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
