import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';

/** Envelope of the supplier self-service answers: records are loosely typed objects, the shape is owned by the API. */
export interface SupplierSelfServiceResponse<T> {
  data: T;
}

export type SupplierSelfServiceRecord = Record<string, unknown>;

/** Body of `POST /supplier-self-service/registration` (RegistrationRequest). */
export interface SupplierRegistrationPayload {
  legal_name: string;
  country: 'IT' | 'CH';
  vat_number: string;
  tax_code?: string | null;
  address_line: string;
  postal_code: string;
  city: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
}

/** Fields of the multipart body of `POST /supplier-self-service/documents` (PortalDocumentRequest). */
export interface SupplierPortalDocumentPayload {
  requirement_id: string;
  file: File;
  reference?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}

export interface SupplierPortalQuoteLine {
  rfq_line_id: string;
  unit_price: number;
  quantity?: number | null;
  tax_rate?: number | null;
  lead_time_days?: number | null;
}

/** Body of `POST /supplier-self-service/rfqs/{id}/quote` (PortalQuoteRequest). */
export interface SupplierPortalQuotePayload {
  quote_reference?: string | null;
  valid_until?: string | null;
  lead_time_days?: number | null;
  notes?: string | null;
  lines: SupplierPortalQuoteLine[];
}

/** Body of `POST /supplier-self-service/bank-changes` (BankChangeSubmitRequest). */
export interface SupplierPortalBankChangePayload {
  account_holder: string;
  iban: string;
  bic?: string | null;
  bank_name?: string | null;
  reason?: string | null;
}

type Envelope<T> = SupplierSelfServiceResponse<T>;
type Rec = SupplierSelfServiceRecord;

/**
 * Supplier side of the supplier portal. The personal token of the invitation mail selects tenant and supplier: it is sent in
 * the `X-Supplier-Token` header (never in the URL), so every call takes it as its first argument.
 */
@Service()
export class SupplierSelfServiceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/supplier-self-service`;

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({ 'X-Supplier-Token': token });
  }

  getMe(token: string): Observable<Envelope<Rec>> {
    return this.http.get<Envelope<Rec>>(`${this.base}/me`, { headers: this.headers(token) });
  }

  submitRegistration(token: string, payload: SupplierRegistrationPayload): Observable<Envelope<{ status: string; country: string }>> {
    return this.http.post<Envelope<{ status: string; country: string }>>(`${this.base}/registration`, payload, { headers: this.headers(token) });
  }

  uploadDocument(token: string, payload: SupplierPortalDocumentPayload): Observable<Envelope<Rec>> {
    const form = new FormData();
    form.append('requirement_id', payload.requirement_id);
    form.append('file', payload.file);
    for (const key of ['reference', 'issued_at', 'expires_at', 'notes'] as const) {
      const value = payload[key];
      if (value !== undefined && value !== null && value !== '') {
        form.append(key, value);
      }
    }
    return this.http.post<Envelope<Rec>>(`${this.base}/documents`, form, { headers: this.headers(token) });
  }

  submitForReview(token: string): Observable<Envelope<{ status: string }>> {
    return this.http.post<Envelope<{ status: string }>>(`${this.base}/submit-for-review`, {}, { headers: this.headers(token) });
  }

  getPurchaseOrders(token: string): Observable<Envelope<Rec[]>> {
    return this.http.get<Envelope<Rec[]>>(`${this.base}/purchase-orders`, { headers: this.headers(token) });
  }

  getPurchaseOrder(token: string, id: string): Observable<Envelope<Rec>> {
    return this.http.get<Envelope<Rec>>(`${this.base}/purchase-orders/${id}`, { headers: this.headers(token) });
  }

  getRfqs(token: string): Observable<Envelope<Rec[]>> {
    return this.http.get<Envelope<Rec[]>>(`${this.base}/rfqs`, { headers: this.headers(token) });
  }

  getRfq(token: string, id: string): Observable<Envelope<Rec>> {
    return this.http.get<Envelope<Rec>>(`${this.base}/rfqs/${id}`, { headers: this.headers(token) });
  }

  submitQuote(token: string, id: string, payload: SupplierPortalQuotePayload): Observable<Envelope<Rec>> {
    return this.http.post<Envelope<Rec>>(`${this.base}/rfqs/${id}/quote`, payload, { headers: this.headers(token) });
  }

  declineRfq(token: string, id: string): Observable<{ declined: boolean }> {
    return this.http.post<{ declined: boolean }>(`${this.base}/rfqs/${id}/decline`, {}, { headers: this.headers(token) });
  }

  getInvoices(token: string): Observable<Envelope<Rec[]>> {
    return this.http.get<Envelope<Rec[]>>(`${this.base}/invoices`, { headers: this.headers(token) });
  }

  getBankChanges(token: string): Observable<Envelope<Rec[]>> {
    return this.http.get<Envelope<Rec[]>>(`${this.base}/bank-changes`, { headers: this.headers(token) });
  }

  requestBankChange(token: string, payload: SupplierPortalBankChangePayload): Observable<Envelope<Rec>> {
    return this.http.post<Envelope<Rec>>(`${this.base}/bank-changes`, payload, { headers: this.headers(token) });
  }
}
