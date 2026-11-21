import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  AuditEntry,
  AttestationBundle,
  ByokConfiguration,
  Envelope,
  Handshake,
  JurisdictionZone,
  KeyEnvelopeResource,
  KillSwitchRequest,
  SovereignNode,
  SovereignServiceType,
  SovereigntyDashboard,
  TransferRule,
  TransferVerdict,
} from './data-sovereignty.models';

/** HTTP access to `/api/v1/sovereignty` (Mod 381: data residency, sovereignty and BYOK/HYOK encryption). */
@Service()
export class DataSovereigntyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/sovereignty`;

  dashboard(): Observable<Envelope<SovereigntyDashboard>> {
    return this.http.get<Envelope<SovereigntyDashboard>>(`${this.base}/dashboard`);
  }

  nodes(
    filters: { zone?: JurisdictionZone | null; serviceType?: SovereignServiceType | null } = {},
  ): Observable<Envelope<SovereignNode[]>> {
    return this.http.get<Envelope<SovereignNode[]>>(`${this.base}/nodes`, {
      params: toHttpParams({
        jurisdiction_zone: filters.zone,
        service_type: filters.serviceType,
      }),
    });
  }

  envelopes(): Observable<Envelope<KeyEnvelopeResource[]>> {
    return this.http.get<Envelope<KeyEnvelopeResource[]>>(this.base + '/byok');
  }

  /** With `dry_run` only the handshake (wrap and unwrap of a throw-away key) is tested and nothing is stored. */
  configureByok(
    configuration: ByokConfiguration,
  ): Observable<Envelope<{ handshake: Handshake; envelope: KeyEnvelopeResource | null }>> {
    return this.http.post<Envelope<{ handshake: Handshake; envelope: KeyEnvelopeResource | null }>>(
      `${this.base}/byok/configure`,
      configuration,
    );
  }

  rotate(envelopeId: string): Observable<Envelope<KeyEnvelopeResource>> {
    return this.http.post<Envelope<KeyEnvelopeResource>>(
      `${this.base}/byok/${envelopeId}/rotate`,
      {},
    );
  }

  killSwitch(
    envelopeId: string,
    request: KillSwitchRequest,
  ): Observable<Envelope<KeyEnvelopeResource>> {
    return this.http.post<Envelope<KeyEnvelopeResource>>(
      `${this.base}/byok/${envelopeId}/kill-switch`,
      request,
    );
  }

  auditLogs(
    filters: { operation?: string | null; page?: number; perPage?: number } = {},
  ): Observable<Envelope<AuditEntry[]>> {
    return this.http.get<Envelope<AuditEntry[]>>(`${this.base}/byok/audit-logs`, {
      params: toHttpParams({
        operation: filters.operation,
        page: filters.page,
        per_page: filters.perPage,
      }),
    });
  }

  rules(): Observable<Envelope<TransferRule[]>> {
    return this.http.get<Envelope<TransferRule[]>>(`${this.base}/cross-border-rules`);
  }

  validateTransfer(request: {
    purpose: string;
    target: string;
    destination_country_iso2?: string | null;
  }): Observable<Envelope<TransferVerdict>> {
    return this.http.post<Envelope<TransferVerdict>>(
      `${this.base}/cross-border-rules/validate`,
      request,
    );
  }

  generateAttestation(legalEntityId?: string | null): Observable<Envelope<AttestationBundle>> {
    return this.http.post<Envelope<AttestationBundle>>(`${this.base}/attestations/generate`, {
      legal_entity_id: legalEntityId ?? null,
    });
  }

  attestation(id: string): Observable<Envelope<AttestationBundle & { signature_valid: boolean }>> {
    return this.http.get<Envelope<AttestationBundle & { signature_valid: boolean }>>(
      `${this.base}/attestations/${id}`,
    );
  }

  attestationPdf(id: string, locale: string): Observable<Blob> {
    return this.http.get(`${this.base}/attestations/${id}/pdf`, {
      params: toHttpParams({ locale }),
      responseType: 'blob',
    });
  }
}
