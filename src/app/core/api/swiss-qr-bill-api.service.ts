import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';
import {
  GenerateQrBillPdfPayload,
  ParsedQrBill,
  QrReferenceCheck,
} from '../models/swiss-qr-bill.model';

/** SIX Swiss QR-bill endpoints: payment slip PDF, supplier QR-bill decoding and reference validation. */
@Service()
export class SwissQrBillApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/swiss-qr-bill`;

  generatePdf(payload: GenerateQrBillPdfPayload): Observable<Blob> {
    return this.http.post(`${this.url}/generate-pdf`, payload, { responseType: 'blob' });
  }

  /** Decodes the QR code of an uploaded PDF or image (PNG, JPG, WebP). */
  parseFile(file: File): Observable<ApiResponse<ParsedQrBill>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<ApiResponse<ParsedQrBill>>(`${this.url}/parse`, body);
  }

  parsePayload(payload: string): Observable<ApiResponse<ParsedQrBill>> {
    return this.http.post<ApiResponse<ParsedQrBill>>(`${this.url}/parse`, { payload });
  }

  validateReference(iban: string, reference: string | null): Observable<ApiResponse<QrReferenceCheck>> {
    return this.http.post<ApiResponse<QrReferenceCheck>>(`${this.url}/validate-reference`, { iban, reference });
  }
}
