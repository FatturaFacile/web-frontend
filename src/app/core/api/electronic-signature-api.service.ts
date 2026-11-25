import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  EsigApiEnvelope,
  EsigChallenge,
  EsigConnectionTest,
  EsigDashboard,
  EsigDownloadKind,
  EsigEnvelope,
  EsigEnvelopeFilters,
  EsigEnvelopeMeta,
  EsigEnvelopePayload,
  EsigAuditEntry,
  EsigLookups,
  EsigPolicyAnswer,
  EsigPortalContext,
  EsigProviderConfig,
  EsigProviderPayload,
  EsigSignableType,
  EsigSignPayload,
  EsigSignResult,
  EsigTemplate,
  EsigTemplatePayload,
  EsigVerifyResult,
} from '../models';

type Envelope<T, M = Record<string, never>> = Observable<EsigApiEnvelope<T, M>>;

/** Appends a value to a FormData the way Laravel reads nested arrays (`recipients[0][email]`). */
export function appendFormValue(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }
  if (value instanceof File) {
    form.append(key, value);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => appendFormValue(form, `${key}[${index}]`, item));
  } else if (typeof value === 'object') {
    for (const [inner, innerValue] of Object.entries(value)) {
      appendFormValue(form, `${key}[${inner}]`, innerValue);
    }
  } else if (typeof value === 'boolean') {
    form.append(key, value ? '1' : '0');
  } else {
    form.append(key, String(value));
  }
}

/** A multipart body from a flat payload; the keys that hold arrays or objects are expanded. */
export function esigFormData(payload: object, spoofMethod?: 'PUT'): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    appendFormValue(form, key, value);
  }
  if (spoofMethod) {
    form.append('_method', spoofMethod);
  }
  return form;
}

/** Endpoints of the electronic signature module: staff screens, the public signing portal and the public verification. */
@Service()
export class ElectronicSignatureApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/signatures`;
  private readonly publicBase = `${environment.apiBaseUrl}/public`;

  // --- Reference data ---

  getLookups(): Envelope<EsigLookups> {
    return this.http.get<EsigApiEnvelope<EsigLookups>>(`${this.base}/lookups`);
  }

  getDashboard(): Envelope<EsigDashboard> {
    return this.http.get<EsigApiEnvelope<EsigDashboard>>(`${this.base}/dashboard`);
  }

  /** The tier a document of this type and amount needs at least. */
  getPolicy(documentType: EsigSignableType, amount?: string | null): Envelope<EsigPolicyAnswer> {
    return this.http.get<EsigApiEnvelope<EsigPolicyAnswer>>(`${this.base}/policy`, {
      params: toHttpParams({ document_type: documentType, amount }),
    });
  }

  // --- Envelopes ---

  listEnvelopes(filters: EsigEnvelopeFilters = {}): Envelope<EsigEnvelope[], EsigEnvelopeMeta> {
    return this.http.get<EsigApiEnvelope<EsigEnvelope[], EsigEnvelopeMeta>>(
      `${this.base}/envelopes`,
      { params: toHttpParams(filters) },
    );
  }

  getEnvelope(id: string): Envelope<EsigEnvelope> {
    return this.http.get<EsigApiEnvelope<EsigEnvelope>>(`${this.base}/envelopes/${id}`);
  }

  /** Creates the envelope; a standalone upload goes as multipart, anything else as JSON. */
  createEnvelope(payload: EsigEnvelopePayload): Envelope<EsigEnvelope> {
    const body = payload.file ? esigFormData(payload) : this.withoutFile(payload);
    return this.http.post<EsigApiEnvelope<EsigEnvelope>>(`${this.base}/envelopes`, body);
  }

  getAudit(id: string): Envelope<EsigAuditEntry[], { chain_valid: boolean }> {
    return this.http.get<EsigApiEnvelope<EsigAuditEntry[], { chain_valid: boolean }>>(
      `${this.base}/envelopes/${id}/audit`,
    );
  }

  sendEnvelope(id: string): Envelope<EsigEnvelope> {
    return this.http.post<EsigApiEnvelope<EsigEnvelope>>(`${this.base}/envelopes/${id}/send`, {});
  }

  remindEnvelope(id: string): Envelope<{ reminded: number }> {
    return this.http.post<EsigApiEnvelope<{ reminded: number }>>(
      `${this.base}/envelopes/${id}/remind`,
      {},
    );
  }

  voidEnvelope(id: string, reason: string | null): Envelope<EsigEnvelope> {
    return this.http.post<EsigApiEnvelope<EsigEnvelope>>(`${this.base}/envelopes/${id}/void`, {
      reason,
    });
  }

  downloadEnvelope(id: string, kind: EsigDownloadKind): Observable<Blob> {
    return this.http.get(`${this.base}/envelopes/${id}/download/${kind}`, {
      responseType: 'blob',
    });
  }

  /** The PDF of a business document as it would be signed, for the placement of the signature boxes. */
  previewDocument(
    documentType: EsigSignableType,
    documentId: string,
    locale?: string,
  ): Observable<Blob> {
    return this.http.get(`${this.base}/preview`, {
      params: toHttpParams({ signable_type: documentType, signable_id: documentId, locale }),
      responseType: 'blob',
    });
  }

  // --- Provider configurations ---

  listProviders(): Envelope<EsigProviderConfig[]> {
    return this.http.get<EsigApiEnvelope<EsigProviderConfig[]>>(`${this.base}/providers`);
  }

  createProvider(payload: EsigProviderPayload): Envelope<EsigProviderConfig> {
    return this.http.post<EsigApiEnvelope<EsigProviderConfig>>(
      `${this.base}/providers`,
      esigFormData(payload),
    );
  }

  /** Multipart with a method override: PHP does not read a multipart body on PUT. */
  updateProvider(id: string, payload: EsigProviderPayload): Envelope<EsigProviderConfig> {
    return this.http.post<EsigApiEnvelope<EsigProviderConfig>>(
      `${this.base}/providers/${id}`,
      esigFormData(payload, 'PUT'),
    );
  }

  deleteProvider(id: string): Envelope<null> {
    return this.http.delete<EsigApiEnvelope<null>>(`${this.base}/providers/${id}`);
  }

  testProvider(id: string): Envelope<EsigConnectionTest> {
    return this.http.post<EsigApiEnvelope<EsigConnectionTest>>(
      `${this.base}/providers/${id}/test`,
      {},
    );
  }

  // --- Templates ---

  listTemplates(): Envelope<EsigTemplate[]> {
    return this.http.get<EsigApiEnvelope<EsigTemplate[]>>(`${this.base}/templates`);
  }

  createTemplate(payload: EsigTemplatePayload): Envelope<EsigTemplate> {
    return this.http.post<EsigApiEnvelope<EsigTemplate>>(`${this.base}/templates`, payload);
  }

  updateTemplate(id: string, payload: EsigTemplatePayload): Envelope<EsigTemplate> {
    return this.http.put<EsigApiEnvelope<EsigTemplate>>(`${this.base}/templates/${id}`, payload);
  }

  deleteTemplate(id: string): Envelope<null> {
    return this.http.delete<EsigApiEnvelope<null>>(`${this.base}/templates/${id}`);
  }

  // --- Signing portal (no account: the token of the link is the credential) ---

  getPortal(token: string): Envelope<EsigPortalContext> {
    return this.http.get<EsigApiEnvelope<EsigPortalContext>>(`${this.publicBase}/sign/${token}`);
  }

  getPortalDocument(token: string): Observable<Blob> {
    return this.http.get(`${this.publicBase}/sign/${token}/document`, { responseType: 'blob' });
  }

  startChallenge(token: string): Envelope<EsigChallenge> {
    return this.http.post<EsigApiEnvelope<EsigChallenge>>(
      `${this.publicBase}/sign/${token}/challenge`,
      {},
    );
  }

  sign(token: string, payload: EsigSignPayload): Envelope<EsigSignResult> {
    return this.http.post<EsigApiEnvelope<EsigSignResult>>(
      `${this.publicBase}/sign/${token}/sign`,
      payload,
    );
  }

  decline(token: string, reason: string): Envelope<null> {
    return this.http.post<EsigApiEnvelope<null>>(`${this.publicBase}/sign/${token}/decline`, {
      reason,
    });
  }

  // --- Public verification ---

  verifyByCode(code: string): Envelope<EsigVerifyResult> {
    return this.http.post<EsigApiEnvelope<EsigVerifyResult>>(
      `${this.publicBase}/signatures/verify`,
      { code },
    );
  }

  verifyByHash(sha256: string): Envelope<EsigVerifyResult> {
    return this.http.post<EsigApiEnvelope<EsigVerifyResult>>(
      `${this.publicBase}/signatures/verify`,
      { sha256 },
    );
  }

  verifyFile(file: File): Envelope<EsigVerifyResult> {
    return this.http.post<EsigApiEnvelope<EsigVerifyResult>>(
      `${this.publicBase}/signatures/verify`,
      esigFormData({ file }),
    );
  }

  private withoutFile(payload: EsigEnvelopePayload): Omit<EsigEnvelopePayload, 'file'> {
    const { file: _file, ...rest } = payload;
    return rest;
  }
}
