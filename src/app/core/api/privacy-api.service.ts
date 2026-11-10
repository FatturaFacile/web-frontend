import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';

export interface PrivacyProcessingActivity {
  id: string;
  title: string;
  purpose: string;
  legal_basis: string;
  data_categories: string[];
  subject_categories: string[];
  retention_period: string;
  cross_border_transfer?: boolean;
  destination_countries?: string[];
  safeguard_mechanism?: string | null;
  status: string;
}

export interface PrivacySubprocessor {
  id: string;
  name: string;
  service_type: string;
  country_code: string;
  is_adequate_country_nlpd: boolean;
  safeguard_mechanism: string;
  dpa_signed_on?: string | null;
  status: string;
}

export interface PrivacyDataSubjectRequest {
  id: string;
  request_type: 'access' | 'portability' | 'erasure' | 'rectification' | 'restriction';
  regulation: 'GDPR' | 'nLPD';
  subject_type: 'contact' | 'employee' | 'user';
  subject_id: string;
  status: string;
  due_at: string;
  completed_at?: string | null;
  legal_holds?: Array<{ statute: string; reason: string; retain_until: string }>;
  notes?: string | null;
}

export interface PrivacyBreachIncident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  discovered_at: string;
  notification_deadline_at: string;
  affected_records_count: number;
  data_categories: string[];
  requires_authority_notification: boolean;
  requires_subject_notification: boolean;
  status: string;
}

export interface PrivacySensitiveAccessLog {
  id: string;
  actor_user_id: string;
  subject_type: string;
  subject_id?: string | null;
  resource: string;
  action: string;
  ip_address?: string | null;
  accessed_at: string;
}

/** GDPR (EU 2016/679) & Swiss nLPD (RS 235.1 / DPOOP Art. 4) Privacy Compliance API service. */
@Service()
export class PrivacyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/settings/privacy`;

  getProcessingActivities(): Observable<{ data: PrivacyProcessingActivity[] }> {
    return this.http.get<{ data: PrivacyProcessingActivity[] }>(`${this.base}/processing-activities`);
  }

  createProcessingActivity(payload: Partial<PrivacyProcessingActivity>): Observable<{ data: PrivacyProcessingActivity }> {
    return this.http.post<{ data: PrivacyProcessingActivity }>(`${this.base}/processing-activities`, payload);
  }

  getSubprocessors(): Observable<{ data: PrivacySubprocessor[] }> {
    return this.http.get<{ data: PrivacySubprocessor[] }>(`${this.base}/subprocessors`);
  }

  createSubprocessor(payload: {
    name: string;
    service_type: string;
    country_code: string;
    safeguard_mechanism?: string;
    dpa_signed_on?: string;
  }): Observable<{ data: PrivacySubprocessor }> {
    return this.http.post<{ data: PrivacySubprocessor }>(`${this.base}/subprocessors`, payload);
  }

  getDataSubjectRequests(): Observable<{ data: PrivacyDataSubjectRequest[] }> {
    return this.http.get<{ data: PrivacyDataSubjectRequest[] }>(`${this.base}/data-subject-requests`);
  }

  createDataSubjectRequest(payload: {
    request_type: 'access' | 'portability' | 'erasure' | 'rectification' | 'restriction';
    regulation?: 'GDPR' | 'nLPD';
    subject_type: 'contact' | 'employee' | 'user';
    subject_id: string;
    notes?: string;
  }): Observable<{ data: PrivacyDataSubjectRequest }> {
    return this.http.post<{ data: PrivacyDataSubjectRequest }>(`${this.base}/data-subject-requests`, payload);
  }

  executeErasure(requestId: string): Observable<{ data: PrivacyDataSubjectRequest }> {
    return this.http.post<{ data: PrivacyDataSubjectRequest }>(
      `${this.base}/data-subject-requests/${requestId}/execute-erasure`,
      {},
    );
  }

  exportPortabilityDossier(
    subjectType: 'contact' | 'employee' | 'user',
    subjectId: string,
  ): Observable<{ data: Record<string, unknown> }> {
    return this.http.get<{ data: Record<string, unknown> }>(
      `${this.base}/portability/${subjectType}/${subjectId}`,
    );
  }

  getBreaches(): Observable<{ data: PrivacyBreachIncident[] }> {
    return this.http.get<{ data: PrivacyBreachIncident[] }>(`${this.base}/breaches`);
  }

  createBreach(payload: {
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    discovered_at: string;
    affected_records_count: number;
    data_categories: string[];
    containment_measures?: string;
  }): Observable<{ data: PrivacyBreachIncident }> {
    return this.http.post<{ data: PrivacyBreachIncident }>(`${this.base}/breaches`, payload);
  }

  getSensitiveAccessLogs(limit = 100): Observable<{ data: PrivacySensitiveAccessLog[] }> {
    return this.http.get<{ data: PrivacySensitiveAccessLog[] }>(`${this.base}/sensitive-access-logs`, {
      params: toHttpParams({ limit }),
    });
  }
}
