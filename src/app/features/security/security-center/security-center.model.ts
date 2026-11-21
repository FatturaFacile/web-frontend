/** Security, Privacy & Compliance Center (GitHub #224): wire types of the posture and PII unmasking endpoints. */

/** Roles that may open the Security Center (owners and admins are the tenant administrators of the API). */
export const SECURITY_CENTER_ROLES: readonly string[] = [
  'SecurityOfficer',
  'DPO',
  'TenantAdmin',
  'owner',
  'admin',
];

/** Permission of the API that allows revealing a masked personal value. */
export const PII_UNMASK_PERMISSION = 'privacy.pii.unmask';

/** Minimum length of the justification that has to accompany a PII reveal. */
export const PII_JUSTIFICATION_MIN_LENGTH = 10;

export type AuditChainStatus = 'verified' | 'tamper_alert';

export interface SecurityPosture {
  audit_chain: {
    status: AuditChainStatus;
    last_verified_at: string | null;
    last_hash: string | null;
  };
  encrypted_fields_coverage: {
    encrypted: number;
    total: number;
    percent: number;
  };
  active_dsar: {
    count: number;
    nearest_due_at: string | null;
  };
  legal_holds_active: number;
  open_incidents: number;
  /** 0 to 100. */
  readiness_score: number;
}

export interface SecurityItem<T> {
  data: T;
}

export interface PiiUnmaskRequest {
  entity_type: string;
  entity_id: string;
  field: string;
  justification: string;
}

export interface PiiUnmaskResponse {
  data: { value: string };
}
