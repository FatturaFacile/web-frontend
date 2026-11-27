/** Wire types of the Swiss eBill module (Mod 025): SIX Paynet / PostFinance settings, participant directory, transmissions and lifecycle. */

export const EBILL_TRANSMISSION_STATUSES = [
  'draft',
  'queued',
  'transmitted',
  'delivered_to_ebanking',
  'approved_by_debtor',
  'rejected_by_debtor',
  'failed_technical',
  'paid_reconciled',
  'cancelled',
] as const;
export type EbillTransmissionStatus = (typeof EBILL_TRANSMISSION_STATUSES)[number];

export const EBILL_PARTICIPANT_STATUSES = [
  'unknown',
  'enrolled',
  'not_enrolled',
  'pending_opt_in',
  'suspended',
] as const;
export type EbillParticipantStatus = (typeof EBILL_PARTICIPANT_STATUSES)[number];

export const EBILL_CHANNEL_TYPES = ['b2c_private', 'b2b_enterprise'] as const;
export type EbillChannelType = (typeof EBILL_CHANNEL_TYPES)[number];

export const EBILL_PROVIDERS = [
  'six_paynet_direct',
  'postfinance_ebill',
  'sandbox_simulator',
] as const;
export type EbillProvider = (typeof EBILL_PROVIDERS)[number];

export const EBILL_PROTOCOLS = ['rest_json_xml', 'soap_ebinterface'] as const;
export type EbillProtocol = (typeof EBILL_PROTOCOLS)[number];

export const EBILL_WEBHOOK_AUTH_MODES = ['hmac_sha256', 'jws_hs256', 'mutual_tls'] as const;
export type EbillWebhookAuthMode = (typeof EBILL_WEBHOOK_AUTH_MODES)[number];

export const EBILL_PAYLOAD_VERSIONS = ['SIX eBill XML', 'ebInterface 6.1'] as const;
export type EbillPayloadVersion = (typeof EBILL_PAYLOAD_VERSIONS)[number];

export const EBILL_CONNECTION_STATUSES = ['untested', 'connected', 'failed'] as const;
export type EbillConnectionStatus = (typeof EBILL_CONNECTION_STATUSES)[number];

export const EBILL_LOOKUP_TYPES = ['uid', 'email', 'iban', 'participant_id'] as const;
export type EbillLookupType = (typeof EBILL_LOOKUP_TYPES)[number];

export const EBILL_REJECTION_CODES = [
  'AMOUNT_MISMATCH',
  'NOT_ORDERED',
  'DUPLICATE',
  'WRONG_RECIPIENT',
  'PO_REFERENCE_MISSING',
  'VAT_ERROR',
  'DELIVERY_NOT_RECEIVED',
  'ALREADY_PAID',
  'DOCUMENT_UNREADABLE',
  'OTHER',
] as const;
export type EbillRejectionCode = (typeof EBILL_REJECTION_CODES)[number];

/** KPI stages of the monitoring dashboard, in the order the cards are drawn. */
export const EBILL_KPI_STAGES = [
  'total_transmitted',
  'awaiting_approval',
  'approved',
  'rejected',
  'reconciled',
  'failed',
] as const;
export type EbillKpiStage = (typeof EBILL_KPI_STAGES)[number];

export interface EbillEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: EbillPageMeta;
}

export interface EbillPageMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** RFC 7807 problem the API answers a refusal with; `code` picks the dictionary key, `violations` is the pre-flight list. */
export interface EbillProblem {
  code?: string;
  detail?: string;
  errors?: Record<string, string[]>;
  violations?: EbillViolation[];
}

export interface EbillViolation {
  code: string;
  field: string;
}

export interface EbillSettings {
  id: string;
  ebill_enabled: boolean;
  biller_id: string | null;
  provider: EbillProvider;
  channel_protocol: EbillProtocol;
  api_base_url: string | null;
  client_id: string | null;
  has_client_secret: boolean;
  has_signing_certificate: boolean;
  has_private_key: boolean;
  has_webhook_secret: boolean;
  /** The plain webhook secret, present only right after it was rotated. */
  webhook_secret: string | null;
  webhook_auth_mode: EbillWebhookAuthMode;
  webhook_mtls_fingerprint: string | null;
  webhook_url: string;
  auto_send_on_invoice_issue: boolean;
  attach_courtesy_pdf: boolean;
  default_ebinterface_version: EbillPayloadVersion;
  last_connection_tested_at: string | null;
  connection_status: EbillConnectionStatus;
  last_connection_latency_ms: number | null;
  last_connection_message: string | null;
}

/** What the settings form sends; a secret left out (or empty) keeps the stored one. */
export interface EbillSettingsPayload {
  ebill_enabled: boolean;
  biller_id: string | null;
  provider: EbillProvider;
  channel_protocol: EbillProtocol;
  api_base_url: string | null;
  client_id: string | null;
  client_secret?: string | null;
  signing_certificate_pem?: string | null;
  private_key_pem?: string | null;
  webhook_auth_mode: EbillWebhookAuthMode;
  webhook_mtls_fingerprint: string | null;
  auto_send_on_invoice_issue: boolean;
  attach_courtesy_pdf: boolean;
  default_ebinterface_version: EbillPayloadVersion;
}

export interface EbillConnectionResult {
  reachable: boolean;
  authenticated: boolean;
  latency_ms: number;
  message: string;
  environment: string | null;
}

export interface EbillConnectionTest {
  result: EbillConnectionResult;
  settings: EbillSettings;
}

export interface EbillParticipant {
  participant_id: string;
  status: EbillParticipantStatus;
  channel_type: EbillChannelType | null;
  display_name: string | null;
  uid: string | null;
  email: string | null;
}

export interface EbillLookupPayload {
  lookup_type: EbillLookupType;
  lookup_value: string;
  force_refresh?: boolean;
}

/** The eBill columns of a customer. */
export interface EbillCustomerData {
  id: string;
  ebill_recipient_id: string | null;
  ebill_status: EbillParticipantStatus;
  ebill_channel_type: EbillChannelType | null;
  ebill_verified_at: string | null;
  ebill_opt_in_preferred: boolean;
}

export interface EbillCustomerSync {
  customer: EbillCustomerData;
  participant: EbillParticipant | null;
}

export interface EbillBulkVerifyResult {
  queued_customers: number;
  all_customers: boolean;
}

export interface EbillTransmissionEvent {
  id: string;
  event_type: string;
  from_status: EbillTransmissionStatus | null;
  to_status: EbillTransmissionStatus | null;
  source: string;
  gateway_event_id: string | null;
  occurred_at: string;
  details: Record<string, unknown> | null;
}

export interface EbillTransmission {
  id: string;
  invoice_id: string;
  invoice_number?: string | null;
  contact_id: string | null;
  customer_name?: string | null;
  supersedes_id: string | null;
  status: EbillTransmissionStatus;
  channel_type: EbillChannelType | null;
  attempt_count: number;
  biller_id: string;
  recipient_id: string;
  six_transaction_id: string | null;
  submission_timestamp: string | null;
  delivered_at: string | null;
  approved_at: string | null;
  scheduled_payment_date: string | null;
  rejected_at: string | null;
  rejection_code: string | null;
  rejection_reason: string | null;
  error_code: string | null;
  error_details: string | null;
  next_retry_at: string | null;
  paid_at: string | null;
  camt054_entry_id: string | null;
  settlement_value_date: string | null;
  settled_amount: number;
  amount_discrepancy: number | null;
  cancelled_at: string | null;
  invoice_amount: number;
  currency: string;
  ebinterface_version: string | null;
  xml_sha256: string | null;
  pdf_sha256: string | null;
  pdf_size_bytes: number | null;
  can_cancel: boolean;
  can_retry: boolean;
  can_revise: boolean;
  events?: EbillTransmissionEvent[];
  created_at: string | null;
}

export interface EbillInvoiceLifecycle {
  transmissions: EbillTransmission[];
  violations: EbillViolation[];
  can_send: boolean;
}

export interface EbillTransmissionFilters {
  ebill_status?: EbillTransmissionStatus | null;
  from?: string | null;
  to?: string | null;
  customer_id?: string | null;
  invoice_id?: string | null;
  channel_type?: EbillChannelType | null;
  search?: string | null;
  page?: number;
  per_page?: number;
}

export interface EbillKpi {
  count: number;
  amounts: Record<string, number>;
}

export type EbillDashboard = Record<EbillKpiStage, EbillKpi>;
