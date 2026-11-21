/** Wire types of `/api/v1/sovereignty` (Mod 381: data residency, sovereignty and BYOK/HYOK encryption). */

export type JurisdictionZone = 'Strict-CH-Only' | 'Strict-IT-Only' | 'EEA-Plus-Adequacy-CH';
export type KeyManagementMode = 'Platform-Managed' | 'BYOK' | 'HYOK';
export type KmsProviderType =
  | 'SECUROSYS_PRIMUS_HSM'
  | 'AWS_KMS'
  | 'AZURE_KEY_VAULT'
  | 'GOOGLE_CLOUD_EKM'
  | 'HASHICORP_VAULT'
  | 'KMIP_GENERIC'
  | 'PLATFORM';
export type KeyEnvelopeStatus = 'ACTIVE' | 'ROTATING' | 'SUSPENDED' | 'REVOKED_CRYPTO_SHREDDED';
export type KmsHealth = 'HEALTHY' | 'DEGRADED' | 'UNKNOWN';
export type TransferDecision = 'ALLOWED' | 'REQUIRES_SCC_TIA' | 'BLOCKED';
export type KillSwitchAction = 'SUSPEND' | 'CRYPTO_SHRED';
export type SovereignServiceType =
  | 'postgres_primary'
  | 'postgres_replica'
  | 's3_dms'
  | 'pgvector'
  | 'ai_inference'
  | 'backup_vault'
  | 'queue_broker';

export const KILL_SWITCH_PHRASE = 'SUSPEND KEY ACCESS';
export const CRYPTO_SHRED_PHRASE = 'PERMANENTLY SHRED';

export const JURISDICTION_ZONES: JurisdictionZone[] = [
  'Strict-CH-Only',
  'Strict-IT-Only',
  'EEA-Plus-Adequacy-CH',
];

export const KMS_PROVIDERS: Exclude<KmsProviderType, 'PLATFORM'>[] = [
  'SECUROSYS_PRIMUS_HSM',
  'AWS_KMS',
  'AZURE_KEY_VAULT',
  'GOOGLE_CLOUD_EKM',
  'HASHICORP_VAULT',
  'KMIP_GENERIC',
];

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface NodeCoordinates {
  node_code: string;
  region_code: string;
  country_iso2: string;
  canton_or_region: string;
  city: string;
  provider_name: string;
  certifications: string[];
  latitude: number | null;
  longitude: number | null;
}

export interface SovereignNode extends NodeCoordinates {
  id: string;
  service_type: SovereignServiceType;
  is_active: boolean;
}

export interface ScopeNodes {
  postgres_primary: NodeCoordinates;
  postgres_replicas: NodeCoordinates[];
  s3_dms: NodeCoordinates;
  pgvector: NodeCoordinates;
  ai_inference: NodeCoordinates;
  backup_vault: NodeCoordinates;
  queue_broker: NodeCoordinates;
}

export interface SovereigntyScope {
  policy_id: string;
  scope_type: 'TENANT_DEFAULT' | 'LEGAL_ENTITY_OVERRIDE';
  legal_entity_id: string | null;
  legal_entity_name: string | null;
  legal_entity_country: string | null;
  jurisdiction_zone: JurisdictionZone;
  compliance_frameworks: string[];
  locked: boolean;
  enforce_strict_egress_block: boolean;
  aggregated_non_pii_consolidation: boolean;
  nodes: ScopeNodes;
  key_envelope_id: string | null;
}

export interface KeyEnvelope {
  id: string;
  legal_entity_id: string | null;
  mode: KeyManagementMode;
  provider: KmsProviderType;
  status: KeyEnvelopeStatus;
  key_version: string;
  dek_cache_ttl_seconds: number;
  rotation_interval_days: number;
  last_rotated_at: string | null;
  next_rotation_due_at: string | null;
  rotation_due: boolean;
  revoked_at: string | null;
  kms_health: KmsHealth;
  last_kms_access_at: string | null;
}

/** The envelope as the key endpoints return it (rotate, kill-switch, configure, list). */
export interface KeyEnvelopeResource {
  id: string;
  legal_entity_id: string | null;
  mode: KeyManagementMode;
  provider_type: KmsProviderType;
  external_key_uri: string;
  current_key_version: string;
  status: KeyEnvelopeStatus;
  dek_cache_ttl_seconds: number;
  rotation_interval_days: number;
  last_rotated_at: string | null;
  next_rotation_due_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface ChainCheck {
  valid: boolean;
  checked: number;
  broken_at: string | null;
}

export interface AuditEntry {
  id: string;
  operation: string;
  key_version: string | null;
  outcome: string;
  latency_ms: number;
  source_node_code: string;
  occurred_at: string;
  actor_type?: string;
  entry_hash?: string;
  previous_entry_hash?: string;
}

export interface BlockedAttempt {
  id: string;
  destination_country_iso2: string | null;
  purpose: string;
  target: string | null;
  reason: string;
  occurred_at: string;
}

export interface SovereigntyDashboard {
  scopes: SovereigntyScope[];
  key_envelopes: KeyEnvelope[];
  kms_audit: { chain: ChainCheck; recent: AuditEntry[] };
  egress_firewall: { blocked_last_30_days: number; recent_blocked: BlockedAttempt[] };
}

export interface TransferRule {
  id: string;
  is_statutory_baseline: boolean;
  source_jurisdiction: JurisdictionZone;
  destination_country_iso2: string;
  destination_country_name: string;
  has_ch_adequacy: boolean;
  has_eu_adequacy: boolean;
  decision_status: TransferDecision;
  legal_basis_reference: string;
}

export interface TransferVerdict {
  allowed: boolean;
  destination_country_iso2: string | null;
  decision_status: TransferDecision;
  jurisdiction_zone: JurisdictionZone | null;
  reason: string | null;
  legal_basis_reference: string | null;
}

export interface ByokConfiguration {
  legal_entity_id?: string | null;
  key_management_mode: Exclude<KeyManagementMode, 'Platform-Managed'>;
  provider_type: Exclude<KmsProviderType, 'PLATFORM'>;
  external_key_uri: string;
  kmip_endpoint?: string | null;
  credentials?: Record<string, string>;
  dek_cache_ttl_seconds?: number;
  rotation_interval_days?: number;
  dry_run?: boolean;
}

export interface Handshake {
  wrap: boolean;
  unwrap: boolean;
}

export interface KillSwitchRequest {
  action: KillSwitchAction;
  reason: string;
  confirmation_phrase: string;
  mfa_code: string;
}

export interface Attestation {
  id: string;
  certificate_number: string;
  jurisdiction_zone: JurisdictionZone;
  compliance_frameworks: string[];
  sha256_payload_hash: string;
  signer_key_fingerprint: string;
  issued_at: string;
  valid_until: string;
}

export interface AttestationBundle {
  attestation: Attestation;
  bundle: Record<string, unknown>;
}

export interface ApiProblem {
  title?: string;
  detail?: string;
  status?: number;
  invalid_params?: { name: string; reason: string }[];
}
