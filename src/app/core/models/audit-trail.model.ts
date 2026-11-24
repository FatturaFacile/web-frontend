/** Immutable audit trail (GitHub #226): records, forensic detail with cryptographic proof, verification and WORM archive. */

export const AUDIT_EVENT_TYPES = [
  'CREATED',
  'UPDATED',
  'DELETED',
  'RESTORED',
  'VIEWED',
  'EXPORTED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'PERMISSION_CHANGED',
  'WORM_SEALED',
  'AUDIT_LOG_INSPECTED',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface AuditActor {
  type: string;
  id: string | null;
  email: string | null;
  role: string | null;
}

/** Summary of an audit record: which fields changed, never the values. */
export interface AuditLogEntry {
  id: string;
  sequence_number: number;
  event_type: AuditEventType;
  auditable_type: string;
  auditable_id: string | null;
  actor: AuditActor;
  ip_address: string | null;
  route_name: string | null;
  request_id: string | null;
  changed_fields: string[];
  context_metadata: Record<string, unknown> | null;
  /** UTC with microseconds, e.g. 2027-12-11T09:30:12.123456Z */
  occurred_at: string;
  worm_sealed: boolean | null;
  has_payload: boolean;
}

export interface AuditWormBatch {
  id: string;
  from_sequence: number;
  to_sequence: number;
  record_count: number;
  merkle_root_hash: string;
  storage_disk: string;
  storage_path: string;
  manifest_path: string;
  retention_until: string;
  sealed_at: string;
}

export interface AuditProof {
  sequence_number: number;
  previous_hash: string;
  current_hash: string;
  hmac_signature: string;
  request_id: string | null;
  worm_batch: AuditWormBatch | null;
}

/** One record with the decrypted before/after values (masked fields stay masked) and its proof. */
export interface AuditLogDetail extends AuditLogEntry {
  user_agent: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  proof: AuditProof;
}

/** Signed forensic result of a chain verification. */
export interface AuditVerificationCertificate {
  isValid: boolean;
  checkedRecords: number;
  firstSequence: number | null;
  lastSequence: number | null;
  merkleRoot: string | null;
  brokenAtSequence: number | null;
  failureReason: string | null;
  verifiedAt: string;
  tenantId: string | null;
  signature: string;
}

export interface AuditLogFilters {
  event_type?: AuditEventType[];
  auditable_type?: string;
  auditable_id?: string;
  actor_id?: string;
  ip_address?: string;
  changed_field?: string;
  date_from?: string;
  date_to?: string;
}

export interface AuditEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AuditListMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  last_verification: AuditVerificationCertificate | null;
}

export interface AuditLogPage extends AuditEnvelope<AuditLogEntry[]> {
  meta: AuditListMeta;
}

/** A forensic export: the JSONL bundle with the digest and signature the API sent in its headers. */
export interface AuditExportBundle {
  blob: Blob;
  filename: string;
  sha256: string | null;
  signature: string | null;
}
