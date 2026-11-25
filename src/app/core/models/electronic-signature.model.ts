/**
 * Wire types of the electronic signature module (FES / FEA / FEQ under eIDAS and ZertES), served under
 * `/api/v1/signatures` (staff), `/api/v1/public/sign` (signing portal) and `/api/v1/public/signatures` (verification).
 * Dates travel as ISO 8601; the signature boxes are fractions of the page (0..1, origin at the top left).
 */

export const ESIG_LEVELS = ['FES', 'FEA', 'FEQ'] as const;
export type EsigLevel = (typeof ESIG_LEVELS)[number];

export const ESIG_JURISDICTIONS = ['eIDAS', 'ZertES'] as const;
export type EsigJurisdiction = (typeof ESIG_JURISDICTIONS)[number];

export const ESIG_PROVIDERS = ['native', 'swisscom', 'infocert', 'namirial'] as const;
export type EsigProvider = (typeof ESIG_PROVIDERS)[number];

export const ESIG_PROVIDER_JURISDICTIONS = ['CH', 'EU', 'BOTH'] as const;
export type EsigProviderJurisdiction = (typeof ESIG_PROVIDER_JURISDICTIONS)[number];

export const ESIG_ROUTING_MODES = ['sequential', 'parallel'] as const;
export type EsigRoutingMode = (typeof ESIG_ROUTING_MODES)[number];

export const ESIG_ENVELOPE_STATUSES = [
  'draft',
  'pending',
  'partially_signed',
  'completed',
  'declined',
  'expired',
  'cancelled',
] as const;
export type EsigEnvelopeStatus = (typeof ESIG_ENVELOPE_STATUSES)[number];

export const ESIG_RECIPIENT_STATUSES = [
  'waiting',
  'pending',
  'viewed',
  'signing',
  'signed',
  'declined',
  'cancelled',
] as const;
export type EsigRecipientStatus = (typeof ESIG_RECIPIENT_STATUSES)[number];

export const ESIG_ROLES = ['SIGNER', 'APPROVER', 'WITNESS', 'CC_RECIPIENT'] as const;
export type EsigRole = (typeof ESIG_ROLES)[number];

export const ESIG_AUTH_METHODS = [
  'email_link',
  'sms_otp',
  'mobile_app',
  'spid_cie',
  'swiss_id',
] as const;
export type EsigAuthMethod = (typeof ESIG_AUTH_METHODS)[number];

export const ESIG_SIGNABLE_TYPES = [
  'quote',
  'purchase_order',
  'employment_contract',
  'document',
  'upload',
] as const;
export type EsigSignableType = (typeof ESIG_SIGNABLE_TYPES)[number];

export const ESIG_SIGNATURE_METHODS = ['typed', 'drawn', 'click'] as const;
export type EsigSignatureMethod = (typeof ESIG_SIGNATURE_METHODS)[number];

export const ESIG_AUDIT_EVENTS = [
  'envelope_created',
  'envelope_sent',
  'document_viewed',
  'challenge_sent',
  'challenge_failed',
  'consent_given',
  'identity_verified',
  'recipient_signed',
  'recipient_declined',
  'reminder_sent',
  'provider_callback',
  'timestamp_applied',
  'timestamp_unavailable',
  'envelope_sealed',
  'envelope_completed',
  'envelope_declined',
  'envelope_expired',
  'envelope_cancelled',
  'document_downloaded',
  'document_archived',
] as const;
export type EsigAuditEvent = (typeof ESIG_AUDIT_EVENTS)[number];

export const ESIG_ASSURANCES = [
  'qualified',
  'advanced',
  'simple',
  'sandbox',
  'invalid',
  'incomplete',
  'unknown',
] as const;
export type EsigAssurance = (typeof ESIG_ASSURANCES)[number];

export const ESIG_ID_DOCUMENT_TYPES = [
  'passport',
  'identity_card',
  'driving_licence',
  'residence_permit',
] as const;
export type EsigIdDocumentType = (typeof ESIG_ID_DOCUMENT_TYPES)[number];

export type EsigDownloadKind = 'original' | 'signed' | 'certificate';

/** Where a signature is drawn: page (1-based) and a rectangle in fractions of the page. */
export interface EsigSignatureBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EsigRecipient {
  id: string;
  signing_order: number;
  role: EsigRole;
  full_name: string;
  email: string;
  phone: string | null;
  auth_method: EsigAuthMethod;
  signature_box: EsigSignatureBox | null;
  status: EsigRecipientStatus;
  notified_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  signature_method: string | null;
  certificate_serial: string | null;
}

export interface EsigEnvelope {
  id: string;
  signable_type: EsigSignableType | null;
  signable_id: string | null;
  verification_code: string;
  title: string;
  subject: string | null;
  message: string | null;
  required_level: EsigLevel;
  jurisdiction: EsigJurisdiction;
  routing_mode: EsigRoutingMode;
  status: EsigEnvelopeStatus;
  provider: EsigProvider;
  provider_config_id: string | null;
  locale: string;
  document_format: 'pades' | 'cades' | 'xades';
  file_name: string | null;
  original_sha256: string | null;
  signed_sha256: string | null;
  has_signed_document: boolean;
  sandbox: boolean;
  sent_at: string | null;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  recipients?: EsigRecipient[];
}

export interface EsigAuditEntry {
  id: string;
  sequence: number;
  event: EsigAuditEvent;
  actor_type: 'user' | 'recipient' | 'system' | 'provider';
  actor_id: string | null;
  recipient_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  document_sha256: string | null;
  receipt: string | null;
  has_timestamp_token: boolean;
  previous_hash: string;
  entry_hash: string;
  occurred_at: string;
}

export interface EsigProviderConfig {
  id: string;
  provider: EsigProvider;
  jurisdiction: EsigProviderJurisdiction;
  name: string;
  is_sandbox: boolean;
  is_active: boolean;
  is_default: boolean;
  has_certificate: boolean;
  /** The credential keys that are set; the values are never sent to the browser. */
  configured_credentials: string[];
  settings: { base_url?: string; endpoints?: Record<string, string> } | null;
  last_tested_at: string | null;
  last_test_status: 'ok' | 'failed' | null;
  last_test_message: string | null;
  created_at: string | null;
}

export interface EsigTemplate {
  id: string;
  name: string;
  document_type: EsigSignableType;
  required_level: EsigLevel;
  jurisdiction: EsigJurisdiction;
  provider_config_id: string | null;
  routing_mode: EsigRoutingMode;
  expiration_days: number;
  reminder_days: number[];
  min_amount: string | null;
  amount_currency: 'CHF' | 'EUR' | null;
  is_active: boolean;
}

export interface EsigPolicyRule {
  min_amount: number;
  level: EsigLevel;
}

export interface EsigLookups {
  levels: EsigLevel[];
  jurisdictions: EsigJurisdiction[];
  provider_jurisdictions: EsigProviderJurisdiction[];
  providers: EsigProvider[];
  /** provider => jurisdiction => the levels the provider can issue */
  capabilities: Record<string, Record<string, EsigLevel[]>>;
  sequential_only_providers: EsigProvider[];
  signable_types: EsigSignableType[];
  roles: EsigRole[];
  recipient_statuses: EsigRecipientStatus[];
  auth_methods: EsigAuthMethod[];
  routing_modes: EsigRoutingMode[];
  statuses: EsigEnvelopeStatus[];
  policies: Record<string, EsigPolicyRule[]>;
  defaults: { expiration_days: number; reminder_days: number[]; max_recipients: number };
  provider_configs: EsigProviderConfig[];
  templates: EsigTemplate[];
}

export interface EsigDashboard {
  pending: number;
  completed_this_month: number;
  expiring_soon: number;
  declined_or_failed: number;
}

export interface EsigPolicyAnswer {
  minimum_level: EsigLevel;
  template: EsigTemplate | null;
}

export interface EsigEnvelopeFilters {
  status?: EsigEnvelopeStatus | '';
  level?: EsigLevel | '';
  jurisdiction?: EsigJurisdiction | '';
  provider?: EsigProvider | '';
  signable_type?: EsigSignableType | '';
  signable_id?: string;
  search?: string;
  per_page?: number;
  page?: number;
}

export interface EsigRecipientPayload {
  full_name: string;
  email: string;
  phone?: string | null;
  role: EsigRole;
  signing_order: number;
  auth_method: EsigAuthMethod;
  signature_box?: EsigSignatureBox | null;
  identity_metadata?: { fiscal_code?: string; ahv_number?: string; country?: string } | null;
}

export interface EsigEnvelopePayload {
  signable_type: EsigSignableType;
  signable_id?: string | null;
  /** The file of a standalone upload. */
  file?: File | null;
  amount?: string | null;
  currency?: string | null;
  title?: string | null;
  subject?: string | null;
  message?: string | null;
  required_level: EsigLevel;
  jurisdiction: EsigJurisdiction;
  routing_mode: EsigRoutingMode;
  provider_config_id?: string | null;
  template_id?: string | null;
  expiration_days?: number | null;
  reminder_days?: number[];
  locale?: string | null;
  send: boolean;
  recipients: EsigRecipientPayload[];
}

export interface EsigProviderPayload {
  provider: EsigProvider;
  jurisdiction: EsigProviderJurisdiction;
  name: string;
  is_sandbox: boolean;
  is_active: boolean;
  is_default: boolean;
  credentials: Record<string, string>;
  settings?: { base_url?: string } | null;
  certificate?: File | null;
  certificate_password?: string | null;
}

export interface EsigTemplatePayload {
  name: string;
  document_type: EsigSignableType;
  required_level: EsigLevel;
  jurisdiction: EsigJurisdiction;
  provider_config_id: string | null;
  routing_mode: EsigRoutingMode;
  expiration_days: number;
  reminder_days: number[];
  min_amount: string | null;
  amount_currency: 'CHF' | 'EUR' | null;
  is_active: boolean;
}

export interface EsigConnectionTest {
  ok: boolean;
  code: string;
  detail: string | null;
  config: EsigProviderConfig;
}

// --- Signing portal ---

export interface EsigPortalContext {
  envelope: {
    title: string;
    message: string | null;
    status: EsigEnvelopeStatus;
    required_level: EsigLevel;
    jurisdiction: EsigJurisdiction;
    provider: EsigProvider;
    document_format: 'pades' | 'cades' | 'xades';
    locale: string;
    expires_at: string | null;
    verification_code: string;
    sandbox: boolean;
  };
  recipient: {
    full_name: string;
    role: EsigRole;
    status: EsigRecipientStatus;
    auth_method: EsigAuthMethod;
    phone_hint: string | null;
    signature_box: EsigSignatureBox | null;
    signed_at: string | null;
    can_sign: boolean;
    requires_identity_document: boolean;
  };
  consents: { terms: string; legal: string };
  can_download_signed: boolean;
}

export interface EsigChallenge {
  type: 'none' | 'otp' | 'push' | 'redirect';
  url: string | null;
  channel: string | null;
  sandbox_code: string | null;
  expires_at: string | null;
}

export interface EsigSignPayload {
  consent_terms: boolean;
  consent_legal: boolean;
  signature_method: EsigSignatureMethod;
  signature_data?: string | null;
  otp?: string | null;
  identity?: {
    id_document_type?: EsigIdDocumentType;
    id_document_number?: string;
    fiscal_code?: string;
    ahv_number?: string;
  } | null;
}

export interface EsigSignResult {
  status: 'signed' | 'pending';
  envelope_status: EsigEnvelopeStatus;
}

// --- Verification ---

export interface EsigVerifySigner {
  name: string;
  role: EsigRole;
  status: EsigRecipientStatus;
  signed_at: string | null;
  certificate_serial: string | null;
  method: string | null;
}

export interface EsigPdfSignature {
  index: number;
  intact: boolean;
  covers_whole_document: boolean;
  signer_name: string | null;
  certificate_serial: string | null;
  certificate_subject: string | null;
  certificate_issuer: string | null;
  valid_from: string | null;
  valid_to: string | null;
  signing_time: string | null;
  sub_filter: string;
  reason: string | null;
}

export interface EsigVerifyResult {
  found: boolean;
  assurance: EsigAssurance;
  matched?: 'code' | 'signed' | 'original';
  code?: string;
  title?: string;
  status?: EsigEnvelopeStatus;
  level?: EsigLevel;
  jurisdiction?: EsigJurisdiction;
  provider?: EsigProvider;
  completed_at?: string | null;
  document_sha256?: string | null;
  signed_sha256?: string | null;
  original_sha256?: string | null;
  audit_chain_valid?: boolean;
  document_intact?: boolean | null;
  timestamp?: { provider: string | null; qualified: boolean; issued_at: string | null } | null;
  signers?: EsigVerifySigner[];
  pdf_signatures?: EsigPdfSignature[];
}

// --- Envelopes of the API ---

export interface EsigEnvelopeMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface EsigApiEnvelope<T, M = Record<string, never>> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

/** RFC 7807 problem of a refused call; `code` picks the translation key. */
export interface EsigProblem {
  code?: string;
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
}
