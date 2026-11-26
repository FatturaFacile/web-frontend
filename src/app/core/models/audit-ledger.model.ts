/** Contracts of the probative audit ledger (Mod 005): `/settings/audit-logs/*` and `/audit/history/*`. */

export const AUDIT_CATEGORIES = ['crud', 'business', 'security', 'access', 'platform'] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CHANNELS = ['web', 'api', 'mobile', 'desktop'] as const;
export type AuditChannel = (typeof AUDIT_CHANNELS)[number];

export type AuditIntegrityStatus =
  | 'valid'
  | 'broken_at'
  | 'missing_range'
  | 'never_verified'
  | 'running';

export type AuditExportStatus = 'queued' | 'running' | 'completed' | 'failed';

/** The label the API sends for a pseudonymised subject whose mapping was erased (GDPR/nLPD). */
export const AUDIT_ERASED_LABEL = '[erased subject]';

/** `{ old, new }` of one changed field. */
export interface AuditFieldChange {
  old: unknown;
  new: unknown;
}

export type AuditChanges = Record<string, AuditFieldChange>;

export interface AuditLedgerEnvelope<T, M = Record<string, unknown>> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export interface AuditEntry {
  id: string;
  sequence: number;
  occurred_at: string;
  tenant_id: string | null;
  company_id: string | null;
  category: AuditCategory;
  module: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  actor_type: string;
  actor_ref: string | null;
  display_actor: string | null;
  impersonator_ref: string | null;
  display_impersonator: string | null;
  changes: AuditChanges | null;
  context: Record<string, unknown> | null;
  previous_hash: string;
  hash: string;
  key_version: number | null;
  hash_version: number;
}

export interface AuditEntryFilters {
  from?: string;
  to?: string;
  actor?: string;
  action?: string;
  resource_type?: string;
  category?: AuditCategory | '';
  channel?: AuditChannel | '';
  ip?: string;
}

export interface AuditEntriesMeta {
  next_cursor: string | null;
  limit: number;
}

export interface AuditHistoryItem {
  id: string;
  sequence: number;
  occurred_at: string;
  action: string;
  category: AuditCategory;
  display_actor: string | null;
  display_impersonator: string | null;
  channel: string | null;
  changed_fields: string[];
  changes: AuditChanges | null;
}

export interface AuditIntegrityRun {
  id: string;
  trigger: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  outcome: AuditIntegrityStatus | null;
  broken_at_sequence: number | null;
  missing_range: { from: number; to: number } | null;
  verified_entries: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface AuditCheckpoint {
  id: string;
  type: string;
  period_ref?: string | null;
  sequence: number;
  hash: string;
  signature?: string;
  key_version?: number;
  created_at: string;
  anchored_at: string | null;
  anchor_uri: string | null;
}

export interface AuditIntegrity {
  status: AuditIntegrityStatus;
  tail: { sequence: number; hash: string } | null;
  running_run_id: string | null;
  last_run: AuditIntegrityRun | null;
  last_checkpoint: AuditCheckpoint | null;
  checkpoints?: AuditCheckpoint[];
}

export interface AuditExport {
  id: string;
  status: AuditExportStatus;
  from: string;
  to: string;
  filters: Record<string, unknown>;
  entries_count: number | null;
  from_sequence: number | null;
  to_sequence: number | null;
  start_hash: string | null;
  end_hash: string | null;
  verification_outcome: string | null;
  sha256: string | null;
  signature: string | null;
  error: string | null;
  created_at: string | null;
  completed_at: string | null;
  download_url: string | null;
}

export interface AuditExportRequest {
  from: string;
  to: string;
}
