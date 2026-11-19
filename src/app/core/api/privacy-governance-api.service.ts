import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';

export type PgLegalBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_interest'
  | 'legitimate_interest';

export interface PgCrossBorderTransfer {
  country_code: string;
  adequacy_decision: boolean;
  safeguard_mechanism: string | null;
}

export interface PgRopaActivity {
  id: string;
  activity_code: string;
  activity_name: string;
  purpose: string;
  legal_basis: PgLegalBasis;
  data_subject_categories: string[];
  personal_data_categories: string[];
  recipient_categories: string[];
  cross_border_transfers: PgCrossBorderTransfer[];
  technical_organizational_measures: string[];
  retention_period_months: number | null;
  retention_legal_reference: string | null;
  is_active: boolean;
}

export type PgRopaPayload = Omit<PgRopaActivity, 'id'>;

export interface PgRopaFilters {
  legal_basis?: PgLegalBasis | '';
  cross_border?: 0 | 1 | '';
  is_active?: 0 | 1 | '';
  per_page?: number;
  page?: number;
}

export interface PgSeedDefaultsResult {
  ropa_created: number;
  ropa_existing: number;
  rules_created: number;
  rules_existing: number;
}

export type PgDsarSubjectType =
  'customer_contact' | 'employee' | 'candidate' | 'lead' | 'supplier_contact';
export type PgDsarRequestType =
  'access_portability' | 'rectification' | 'erasure' | 'restriction' | 'objection';
export type PgDsarStatus =
  | 'open'
  | 'identity_verified'
  | 'in_progress'
  | 'completed'
  | 'partially_refused_fiscal_retention'
  | 'rejected';
export type PgPackageStatus = 'queued' | 'processing' | 'ready' | 'failed' | null;

export interface PgDsar {
  id: string;
  request_number: string;
  subject_type: PgDsarSubjectType;
  subject_entity_id: string | null;
  subject_email: string;
  subject_full_name: string;
  request_type: PgDsarRequestType;
  received_at: string;
  statutory_deadline_at: string;
  deadline_extended: boolean;
  status: PgDsarStatus;
  identity_verified_at: string | null;
  completed_at: string | null;
  refusal_legal_justification: string | null;
  export_artifact_path: string | null;
  package_status: PgPackageStatus;
  days_remaining: number | null;
  is_overdue: boolean;
}

export interface PgDsarCreatePayload {
  subject_type: PgDsarSubjectType;
  subject_entity_id?: string | null;
  subject_email: string;
  subject_full_name: string;
  request_type: PgDsarRequestType;
  received_at?: string | null;
  audit_notes?: string | null;
}

export interface PgErasureAnonymizeRow {
  table: string;
  label: string;
  module: string;
  rows: number;
}

export interface PgErasureProtectedRow {
  table: string;
  module: string;
  rows: number;
  retention_ends_at: string | null;
}

export interface PgErasurePreview {
  dry_run: boolean;
  status: PgDsarStatus | string;
  fiscal_lock: { is_locked: boolean; retention_ends_at: string | null; records: unknown[] };
  to_anonymize: PgErasureAnonymizeRow[];
  protected: PgErasureProtectedRow[];
  refusal_legal_justification: string | null;
}

export type PgConsentProofChannel =
  'web_form' | 'double_opt_in_email' | 'signed_paper' | 'customer_portal' | 'api_webhook';

export interface PgConsentEntry {
  id: string;
  sequence: number;
  subject_type: string;
  subject_identifier?: string | null;
  purpose_code: string;
  consent_granted: boolean;
  policy_version: string;
  captured_at: string;
  ip_address: string | null;
  user_agent: string | null;
  proof_channel: PgConsentProofChannel;
  previous_entry_hash: string | null;
  entry_hash: string;
}

export interface PgConsentFilters {
  subject_identifier?: string;
  subject_entity_id?: string;
  purpose_code?: string;
  consent_granted?: 0 | 1 | '';
  policy_version?: string;
  per_page?: number;
  page?: number;
}

export interface PgConsentChain {
  is_intact: boolean;
  first_broken_sequence: number | null;
}

export interface PgConsentPayload {
  subject_type: string;
  subject_entity_id?: string | null;
  subject_identifier: string;
  purpose_code: string;
  consent_granted: boolean;
  policy_version: string;
  proof_channel: PgConsentProofChannel;
  captured_at?: string | null;
}

export type PgBreachJurisdiction = 'it_gdpr_garante' | 'ch_nlpd_fdpic' | 'both_ch_it';
export type PgBreachSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PgBreachRisk = 'unlikely' | 'possible' | 'likely' | 'high_risk';
export type PgBreachStatus =
  'investigating' | 'contained' | 'notified_authority' | 'notified_subjects' | 'closed';

export interface PgBreach {
  id: string;
  incident_code: string;
  title: string;
  description?: string | null;
  detected_at: string;
  notification_deadline_72h: string;
  jurisdiction: PgBreachJurisdiction;
  severity: PgBreachSeverity;
  risk_to_rights_and_freedoms?: PgBreachRisk;
  status: PgBreachStatus;
  seconds_remaining: number | null;
  affected_subjects_count?: number | null;
  affected_data_categories?: string[];
  containment_measures?: string | null;
  remediation_plan?: string | null;
  authority_notified_at: string | null;
  authority_reference_number?: string | null;
  subjects_notified_at?: string | null;
}

export interface PgBreachPayload {
  title: string;
  description?: string | null;
  detected_at?: string | null;
  jurisdiction: PgBreachJurisdiction;
  severity: PgBreachSeverity;
  risk_to_rights_and_freedoms: PgBreachRisk;
  affected_subjects_count?: number | null;
  affected_data_categories?: string[];
  containment_measures?: string | null;
  remediation_plan?: string | null;
}

export interface PgBreachUpdatePayload extends Partial<PgBreachPayload> {
  authority_notified_at?: string | null;
  authority_reference_number?: string | null;
  subjects_notified_at?: string | null;
  status?: PgBreachStatus;
}

export interface PgNotificationAuthority {
  code: string;
  name: string;
  legal_basis: string;
  channel: string;
  mandatory_fields: string[];
}

export interface PgNotificationDossier {
  facts: Record<string, unknown>;
  authorities: PgNotificationAuthority[];
}

export type PgRetentionAction = 'hard_delete' | 'cryptographic_anonymize' | 'archive_lock';

export interface PgRetentionRule {
  id: string;
  module_code: string;
  entity_class: string;
  retention_days: number;
  action_on_expiry: PgRetentionAction;
  is_statutory_locked: boolean;
  legal_basis_note: string | null;
  is_enabled: boolean;
}

export interface PgRetentionRunLog {
  id: string;
  dry_run: boolean;
  evaluated_count: number;
  purged_count: number;
  anonymized_count: number;
  statutory_skipped_count: number;
  details?: unknown[];
  started_at: string;
  finished_at: string | null;
}

export interface PgRetentionRulePayload {
  retention_days?: number;
  action_on_expiry?: PgRetentionAction;
  is_enabled?: boolean;
  legal_basis_note?: string | null;
}

export interface PgItem<T> {
  data: T;
}

export interface PgList<T> {
  data: T[];
  links?: Record<string, string | null>;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface PgConsentList extends PgList<PgConsentEntry> {
  meta_chain?: PgConsentChain;
}

export interface PgRetentionRulesResponse {
  data: PgRetentionRule[];
  recent_runs: PgRetentionRunLog[];
}

/** Privacy & Data Governance Suite (Mod 096): RoPA, DSAR, consent ledger, data breaches and retention (GDPR / nLPD). */
@Service()
export class PrivacyGovernanceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/privacy`;

  // RoPA
  getRopa(filters: PgRopaFilters = {}): Observable<PgList<PgRopaActivity>> {
    return this.http.get<PgList<PgRopaActivity>>(`${this.base}/ropa`, {
      params: toHttpParams(filters),
    });
  }

  createRopa(payload: PgRopaPayload): Observable<PgItem<PgRopaActivity>> {
    return this.http.post<PgItem<PgRopaActivity>>(`${this.base}/ropa`, payload);
  }

  updateRopa(id: string, payload: Partial<PgRopaPayload>): Observable<PgItem<PgRopaActivity>> {
    return this.http.put<PgItem<PgRopaActivity>>(`${this.base}/ropa/${id}`, payload);
  }

  deleteRopa(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/ropa/${id}`);
  }

  seedDefaults(): Observable<PgItem<PgSeedDefaultsResult>> {
    return this.http.post<PgItem<PgSeedDefaultsResult>>(`${this.base}/ropa/seed-defaults`, {});
  }

  exportRopa(format: 'pdf' | 'xlsx'): Observable<Blob> {
    return this.http.get(`${this.base}/ropa/export`, {
      params: new HttpParams().set('format', format),
      responseType: 'blob',
    });
  }

  // DSAR
  getDsars(
    params: { status?: PgDsarStatus | ''; per_page?: number; page?: number } = {},
  ): Observable<PgList<PgDsar>> {
    return this.http.get<PgList<PgDsar>>(`${this.base}/dsar`, { params: toHttpParams(params) });
  }

  getDsar(id: string): Observable<PgItem<PgDsar>> {
    return this.http.get<PgItem<PgDsar>>(`${this.base}/dsar/${id}`);
  }

  createDsar(payload: PgDsarCreatePayload): Observable<PgItem<PgDsar>> {
    return this.http.post<PgItem<PgDsar>>(`${this.base}/dsar`, payload);
  }

  verifyIdentity(id: string, method: string): Observable<PgItem<PgDsar>> {
    return this.http.post<PgItem<PgDsar>>(`${this.base}/dsar/${id}/verify-identity`, { method });
  }

  extendDsar(id: string, days: number, justification: string): Observable<PgItem<PgDsar>> {
    return this.http.post<PgItem<PgDsar>>(`${this.base}/dsar/${id}/extend`, {
      days,
      justification,
    });
  }

  generatePackage(id: string): Observable<PgItem<PgDsar>> {
    return this.http.post<PgItem<PgDsar>>(`${this.base}/dsar/${id}/generate-package`, {});
  }

  downloadPackage(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/dsar/${id}/download-package`, { responseType: 'blob' });
  }

  executeErasure(id: string, dryRun: boolean): Observable<PgItem<PgErasurePreview>> {
    const url = `${this.base}/dsar/${id}/execute-erasure`;
    return this.http.post<PgItem<PgErasurePreview>>(
      url,
      {},
      dryRun ? { params: new HttpParams().set('dry_run', 'true') } : {},
    );
  }

  // Consent ledger
  getConsents(filters: PgConsentFilters = {}): Observable<PgConsentList> {
    return this.http.get<PgConsentList>(`${this.base}/consents`, { params: toHttpParams(filters) });
  }

  createConsent(payload: PgConsentPayload): Observable<PgItem<PgConsentEntry>> {
    return this.http.post<PgItem<PgConsentEntry>>(`${this.base}/consents`, payload);
  }

  // Data breaches
  getBreaches(params: { per_page?: number; page?: number } = {}): Observable<PgList<PgBreach>> {
    return this.http.get<PgList<PgBreach>>(`${this.base}/breaches`, {
      params: toHttpParams(params),
    });
  }

  getActiveCountdowns(): Observable<{ data: PgBreach[] }> {
    return this.http.get<{ data: PgBreach[] }>(`${this.base}/breaches/active-countdown`);
  }

  createBreach(payload: PgBreachPayload): Observable<PgItem<PgBreach>> {
    return this.http.post<PgItem<PgBreach>>(`${this.base}/breaches`, payload);
  }

  updateBreach(id: string, payload: PgBreachUpdatePayload): Observable<PgItem<PgBreach>> {
    return this.http.put<PgItem<PgBreach>>(`${this.base}/breaches/${id}`, payload);
  }

  getNotificationDossier(id: string): Observable<PgItem<PgNotificationDossier>> {
    return this.http.get<PgItem<PgNotificationDossier>>(
      `${this.base}/breaches/${id}/notification-dossier`,
    );
  }

  // Retention
  getRetentionRules(): Observable<PgRetentionRulesResponse> {
    return this.http.get<PgRetentionRulesResponse>(`${this.base}/retention-rules`);
  }

  updateRetentionRule(
    id: string,
    payload: PgRetentionRulePayload,
  ): Observable<PgItem<PgRetentionRule>> {
    return this.http.put<PgItem<PgRetentionRule>>(`${this.base}/retention-rules/${id}`, payload);
  }

  runRetentionNow(dryRun: boolean): Observable<PgItem<PgRetentionRunLog>> {
    return this.http.post<PgItem<PgRetentionRunLog>>(
      `${this.base}/retention-rules/run-now`,
      {},
      dryRun ? { params: new HttpParams().set('dry_run', '1') } : {},
    );
  }

  getRetentionRuns(
    params: { per_page?: number; page?: number } = {},
  ): Observable<PgList<PgRetentionRunLog>> {
    return this.http.get<PgList<PgRetentionRunLog>>(`${this.base}/retention-rules/runs`, {
      params: toHttpParams(params),
    });
  }
}
