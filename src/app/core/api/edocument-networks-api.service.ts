import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';

/** A network of the e-document exchange (`GET /edocument-networks`). */
export interface EDocumentNetworkInfo {
  network: 'ebill' | 'peppol' | 'nso' | string;
  label: string;
  driver: string;
  is_available: boolean;
}

/**
 * Networks list and Peppol UBL export of the e-document networks. Transmissions, retry and send are in `DocumentTrustApiService`.
 */
@Service()
export class EDocumentNetworksApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/edocument-networks`;

  getNetworks(): Observable<ApiResponse<EDocumentNetworkInfo[]>> {
    return this.http.get<ApiResponse<EDocumentNetworkInfo[]>>(this.base);
  }

  /** UBL 2.1 XML of an invoice for Peppol. */
  downloadPeppolUbl(invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.base}/peppol/invoices/${invoiceId}/ubl`, { responseType: 'blob' });
  }
}
