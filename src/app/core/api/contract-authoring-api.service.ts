import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ContractDocumentVersionResource, ContractKind } from '../models';
import { DataEnvelope, DataListEnvelope, ExtraParams, ExtraRecord } from './extra-api.types';

export type ContractClauseStatus = 'draft' | 'approved' | 'retired';
export type ContractRoundOutcome = 'agreed' | 'countered' | 'rejected' | 'withdrawn';

export interface ContractClauseRequest {
  code: string;
  title: string;
  category?: string | null;
  /** Body of the first version (create only). */
  body?: string;
}

export interface ContractClauseVersionRequest {
  body: string;
  change_note?: string | null;
}

export interface ContractClauseFallbackRequest {
  title: string;
  body: string;
  rank?: number | null;
  requires_approval?: boolean;
}

export interface ContractTemplateVariable {
  key: string;
  label?: string | null;
  required?: boolean;
  default?: string | null;
}

export interface ContractTemplateRequest {
  name: string;
  contract_kind?: ContractKind | null;
  status?: string;
  variables?: ContractTemplateVariable[] | null;
  clauses: { clause_id: string; is_optional?: boolean }[];
}

export interface ContractTemplatePreviewRequest {
  template_id?: string;
  variables?: Record<string, string | null>;
  include_optional?: string[];
  fallback_ranks?: Record<string, number>;
}

export interface ContractVersionFromTemplateRequest extends ContractTemplatePreviewRequest {
  template_id: string;
}

export interface ContractDocumentVersionRequest {
  body: string;
  source?: 'edit' | 'counterparty';
  notes?: string | null;
}

export interface ContractSignerRequest {
  name: string;
  email: string;
}

export interface ContractSignatureRequestPayload {
  document_version_id: string;
  provider?: string;
  order_mode?: 'sequential' | 'parallel';
  expires_on?: string | null;
  signers: ContractSignerRequest[];
}

/** Clauses library, templates, document versions, negotiation rounds and e-signature requests. */
@Service()
export class ContractAuthoringApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/contract-authoring`;

  // --- CLAUSES ---
  getClauses(params?: ExtraParams): Observable<DataListEnvelope<ExtraRecord>> {
    return this.http.get<DataListEnvelope<ExtraRecord>>(`${this.base}/clauses`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getClause(id: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.get<DataEnvelope<ExtraRecord>>(`${this.base}/clauses/${id}`);
  }

  createClause(payload: ContractClauseRequest): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/clauses`, payload);
  }

  updateClause(id: string, payload: ContractClauseRequest): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.put<DataEnvelope<ExtraRecord>>(`${this.base}/clauses/${id}`, payload);
  }

  addClauseVersion(id: string, payload: ContractClauseVersionRequest): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/clauses/${id}/versions`, payload);
  }

  setClauseStatus(id: string, status: ContractClauseStatus): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/clauses/${id}/status`, { status });
  }

  addClauseFallback(id: string, payload: ContractClauseFallbackRequest): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/clauses/${id}/fallbacks`, payload);
  }

  deleteClauseFallback(id: string, fallbackId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/clauses/${id}/fallbacks/${fallbackId}`);
  }

  // --- TEMPLATES ---
  getTemplates(params?: ExtraParams): Observable<DataListEnvelope<ExtraRecord>> {
    return this.http.get<DataListEnvelope<ExtraRecord>>(`${this.base}/templates`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getTemplate(id: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.get<DataEnvelope<ExtraRecord>>(`${this.base}/templates/${id}`);
  }

  createTemplate(payload: ContractTemplateRequest): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/templates`, payload);
  }

  updateTemplate(id: string, payload: ContractTemplateRequest): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.put<DataEnvelope<ExtraRecord>>(`${this.base}/templates/${id}`, payload);
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }

  previewTemplate(
    id: string,
    payload: ContractTemplatePreviewRequest = {},
  ): Observable<DataEnvelope<{ body: string } & Record<string, unknown>>> {
    return this.http.post<DataEnvelope<{ body: string } & Record<string, unknown>>>(
      `${this.base}/templates/${id}/preview`,
      payload,
    );
  }

  // --- DOCUMENT VERSIONS ---
  createDocumentVersion(
    kind: ContractKind,
    contractId: string,
    payload: ContractDocumentVersionRequest,
  ): Observable<DataEnvelope<ContractDocumentVersionResource>> {
    return this.http.post<DataEnvelope<ContractDocumentVersionResource>>(
      `${this.base}/contracts/${kind}/${contractId}/versions`,
      payload,
    );
  }

  createDocumentVersionFromTemplate(
    kind: ContractKind,
    contractId: string,
    payload: ContractVersionFromTemplateRequest,
  ): Observable<DataEnvelope<ContractDocumentVersionResource>> {
    return this.http.post<DataEnvelope<ContractDocumentVersionResource>>(
      `${this.base}/contracts/${kind}/${contractId}/versions/from-template`,
      payload,
    );
  }

  getDocumentVersion(id: string): Observable<DataEnvelope<ContractDocumentVersionResource>> {
    return this.http.get<DataEnvelope<ContractDocumentVersionResource>>(`${this.base}/document-versions/${id}`);
  }

  // --- NEGOTIATION ROUNDS ---
  getRounds(kind: ContractKind, contractId: string): Observable<DataListEnvelope<ExtraRecord>> {
    return this.http.get<DataListEnvelope<ExtraRecord>>(`${this.base}/contracts/${kind}/${contractId}/rounds`);
  }

  openRound(kind: ContractKind, contractId: string, summary?: string | null): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/contracts/${kind}/${contractId}/rounds`, {
      summary: summary ?? null,
    });
  }

  closeRound(id: string, outcome: ContractRoundOutcome, summary?: string | null): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/negotiation-rounds/${id}/close`, {
      outcome,
      summary: summary ?? null,
    });
  }

  // --- E-SIGNATURE ---
  getSignatureProviders(): Observable<DataListEnvelope<ExtraRecord>> {
    return this.http.get<DataListEnvelope<ExtraRecord>>(`${this.base}/signature-providers`);
  }

  getSignatureRequests(kind: ContractKind, contractId: string): Observable<DataListEnvelope<ExtraRecord>> {
    return this.http.get<DataListEnvelope<ExtraRecord>>(
      `${this.base}/contracts/${kind}/${contractId}/signature-requests`,
    );
  }

  createSignatureRequest(
    kind: ContractKind,
    contractId: string,
    payload: ContractSignatureRequestPayload,
  ): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(
      `${this.base}/contracts/${kind}/${contractId}/signature-requests`,
      payload,
    );
  }

  getSignatureRequest(id: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.get<DataEnvelope<ExtraRecord>>(`${this.base}/signature-requests/${id}`);
  }

  sendSignatureRequest(id: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/signature-requests/${id}/send`, {});
  }

  signSignatureRequest(id: string, token: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/signature-requests/${id}/sign`, { token });
  }

  declineSignatureRequest(id: string, token: string, reason: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/signature-requests/${id}/decline`, {
      token,
      reason,
    });
  }

  cancelSignatureRequest(id: string): Observable<DataEnvelope<ExtraRecord>> {
    return this.http.post<DataEnvelope<ExtraRecord>>(`${this.base}/signature-requests/${id}/cancel`, {});
  }
}
