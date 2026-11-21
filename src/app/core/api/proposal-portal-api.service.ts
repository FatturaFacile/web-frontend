import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';

export type ProposalLineType =
  'product' | 'service_fixed' | 'service_time_and_material' | 'text_note' | 'subtotal';
export type ProposalSelectionMode = 'mandatory' | 'optional' | 'alternative_group';
export type ProposalSignatureLevel = 'ses_otp' | 'aes' | 'qes';

/** A line of the customer-facing proposal. Unit costs and margins never reach this model: the server strips them. */
export interface ProposalLine {
  id: string;
  section_id: string | null;
  line_type: ProposalLineType;
  selection_mode: ProposalSelectionMode;
  alternative_group: string | null;
  sku: string | null;
  description: string;
  long_description: string | null;
  uom: string | null;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  selected: boolean;
  net: string;
}

export interface ProposalSection {
  id: string;
  title: string;
  description: string | null;
  page_break_before: boolean;
  subtotal: string;
}

export interface ProposalTaxRow {
  rate: string;
  net: string;
  tax: string;
}

export interface ProposalTotals {
  net: string;
  tax: string;
  gross: string;
  rounding: string;
  payable: string;
}

export interface ProposalView {
  quote_number: string;
  status: string;
  currency: string;
  locale: string;
  customer_name: string | null;
  valid_until: string | null;
  payment_terms: string | null;
  incoterms: string | null;
  cover_letter: string | null;
  terms_and_conditions: string | null;
  signature_level: ProposalSignatureLevel;
  sections: ProposalSection[];
  lines: ProposalLine[];
  tax_breakdown: ProposalTaxRow[];
  totals: ProposalTotals;
  has_signed_document: boolean;
  comments?: {
    author_type: string;
    author_name: string | null;
    body: string;
    created_at: string;
  }[];
}

export interface ProposalSignatureStep {
  envelope_id: string;
  otp_sent?: boolean;
  channel?: 'email' | 'sms';
  expires_at?: string;
  redirect_url?: string;
  provider_reference?: string;
}

export interface ProposalSignatureResult {
  quote_number: string;
  status: string;
  signed_document_hash: string | null;
  audit_certificate_hash: string | null;
}

export interface ProposalSignerDetails {
  signer_name: string;
  signer_role?: string;
  signer_email?: string;
  signer_phone?: string;
  otp_channel: 'email' | 'sms';
  consent: boolean;
}

/**
 * Public proposal portal (no login): the unguessable token of the link is the credential and, when the quote has a PIN, the
 * session returned by `verifyPin` travels in the `X-Proposal-Session` header.
 */
@Service()
export class ProposalPortalApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/public/proposals`;

  get(token: string, session: string | null): Observable<ApiResponse<ProposalView>> {
    return this.http.get<ApiResponse<ProposalView>>(`${this.base}/${token}`, {
      headers: this.headers(session),
    });
  }

  verifyPin(token: string, pin: string): Observable<ApiResponse<{ session: string }>> {
    return this.http.post<ApiResponse<{ session: string }>>(`${this.base}/${token}/verify-pin`, {
      pin,
    });
  }

  /** Persists the toggles and returns the proposal recalculated by the server (the authority on prices and tax). */
  updateSelections(
    token: string,
    session: string | null,
    selections: Record<string, boolean>,
  ): Observable<ApiResponse<ProposalView>> {
    return this.http.put<ApiResponse<ProposalView>>(
      `${this.base}/${token}/selections`,
      { selections },
      { headers: this.headers(session) },
    );
  }

  initiateSignature(
    token: string,
    session: string | null,
    signer: ProposalSignerDetails,
  ): Observable<ApiResponse<ProposalSignatureStep>> {
    return this.http.post<ApiResponse<ProposalSignatureStep>>(
      `${this.base}/${token}/signature`,
      signer,
      { headers: this.headers(session) },
    );
  }

  completeSignature(
    token: string,
    session: string | null,
    envelopeId: string,
    otp: string,
  ): Observable<ApiResponse<ProposalSignatureResult>> {
    return this.http.post<ApiResponse<ProposalSignatureResult>>(
      `${this.base}/${token}/signature/complete`,
      { envelope_id: envelopeId, otp },
      { headers: this.headers(session) },
    );
  }

  reject(
    token: string,
    session: string | null,
    reason: string,
  ): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.base}/${token}/reject`,
      { reason },
      { headers: this.headers(session) },
    );
  }

  comment(
    token: string,
    session: string | null,
    body: string,
    authorName?: string,
  ): Observable<ApiResponse<{ id: string }>> {
    return this.http.post<ApiResponse<{ id: string }>>(
      `${this.base}/${token}/comments`,
      { body, author_name: authorName },
      { headers: this.headers(session) },
    );
  }

  /** Blob download (a plain link cannot carry the PIN session header). */
  downloadDocument(
    token: string,
    session: string | null,
    kind: 'proposal' | 'certificate',
  ): Observable<Blob> {
    return this.http.get(`${this.base}/${token}/documents/${kind}`, {
      headers: this.headers(session),
      responseType: 'blob',
    });
  }

  private headers(session: string | null): HttpHeaders {
    return session === null
      ? new HttpHeaders()
      : new HttpHeaders({ 'X-Proposal-Session': session });
  }
}
