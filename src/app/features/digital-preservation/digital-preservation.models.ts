export type Jurisdiction = 'IT' | 'CH' | 'DUAL';
export type PreservationProvider =
  'local_worm' | 'aruba_pec' | 'infocert' | 'namirial' | 'zucchetti';
export type AutoSealFrequency = 'daily' | 'weekly' | 'monthly';
export type BatchStatus =
  'draft' | 'sealed' | 'timestamped' | 'dispatched' | 'confirmed' | 'failed';
export type DocumentCategory =
  | 'active_invoices'
  | 'passive_invoices'
  | 'sdi_notifications'
  | 'accounting_ledgers'
  | 'tax_documents'
  | 'analog_dematerialized';
export type PdfaLevel = 'PDF/A-1b' | 'PDF/A-2b' | 'XML';

export const JURISDICTIONS: readonly Jurisdiction[] = ['IT', 'CH', 'DUAL'];
export const PROVIDERS: readonly PreservationProvider[] = [
  'local_worm',
  'aruba_pec',
  'infocert',
  'namirial',
  'zucchetti',
];
export const FREQUENCIES: readonly AutoSealFrequency[] = ['daily', 'weekly', 'monthly'];
export const BATCH_STATUSES: readonly BatchStatus[] = [
  'draft',
  'sealed',
  'timestamped',
  'dispatched',
  'confirmed',
  'failed',
];
export const DOCUMENT_CATEGORIES: readonly DocumentCategory[] = [
  'active_invoices',
  'passive_invoices',
  'sdi_notifications',
  'accounting_ledgers',
  'tax_documents',
  'analog_dematerialized',
];

export interface PreservationDashboard {
  preserved_documents: number;
  worm_size_bytes: number;
  last_sealed_batch: { id: string; batch_number: string; sealed_at: string } | null;
  chain_status: 'verified' | 'alert' | 'empty';
  pending_unpreserved_documents: number;
  retention_years: number;
  batches_by_status: Record<string, number>;
  last_verification_at: string | null;
}

export interface PreservationConfiguration {
  jurisdiction: Jurisdiction;
  provider: PreservationProvider;
  has_credentials: boolean;
  preservation_officer_name: string | null;
  preservation_officer_tax_code: string | null;
  tsa_url: string | null;
  has_tsa_credentials: boolean;
  auto_seal_frequency: AutoSealFrequency;
  default_retention_years: number;
  is_active: boolean;
}

export interface PreservationConfigurationUpdate extends Omit<
  PreservationConfiguration,
  'has_credentials' | 'has_tsa_credentials'
> {
  credentials?: Record<string, string> | null;
  tsa_credentials?: Record<string, string> | null;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  provider: string;
}

export interface PreservationBatch {
  id: string;
  batch_number: string;
  jurisdiction: Jurisdiction;
  status: BatchStatus;
  document_category: DocumentCategory;
  period_from: string | null;
  period_to: string | null;
  item_count: number;
  total_size_bytes: number;
  pdv_sha256: string | null;
  pda_sha256: string | null;
  merkle_root_sha256: string | null;
  previous_batch_sha256: string | null;
  rfc3161_gen_time: string | null;
  external_conservator_id: string | null;
  retention_until: string | null;
  sealed_at: string | null;
  dispatched_at: string | null;
  created_at: string;
  has_timestamp: boolean;
  has_rdv: boolean;
}

export interface PreservationItem {
  id: string;
  batch_id: string;
  batch_number: string;
  document_uuid: string;
  document_type: string;
  document_number: string | null;
  document_date: string | null;
  counterparty_name: string | null;
  counterparty_tax_id: string | null;
  original_filename: string;
  archived_filename: string;
  mime_type: string;
  is_pdfa_compliant: boolean;
  pdfa_conformance_level: PdfaLevel | null;
  file_size_bytes: number;
  sha256_hash: string;
  retention_until: string | null;
  jurisdiction: Jurisdiction;
}

export interface BatchTimestamp {
  gen_time: string;
  provider: string;
  qualified: boolean;
  token_base64: string;
}

export interface PreservationBatchDetail extends PreservationBatch {
  pdv_xml: string | null;
  rdv_xml: string | null;
  timestamp: BatchTimestamp | null;
  items: PreservationItem[];
}

export interface CreateBatchPayload {
  document_category: DocumentCategory;
  period_from: string;
  period_to: string;
  jurisdiction?: Jurisdiction;
}

export interface VerificationFailure {
  type: string;
  reference: string;
  expected: string;
  actual: string;
}

export interface BatchVerification {
  ok: boolean;
  checked_files: number;
  failures: VerificationFailure[];
  chain: { ok: boolean };
  timestamp: { valid: boolean | null };
  audit_chain: { ok: boolean };
  verified_at: string;
}

export interface ItemVerification {
  ok: boolean;
  expected: string;
  actual: string;
}

export interface PreservationAuditLog {
  id: string;
  sequence: number;
  action: string;
  preservation_batch_id: string | null;
  preservation_item_id: string | null;
  actor_id: string | null;
  details: Record<string, unknown>;
  sha256_snapshot: string | null;
  previous_log_sha256: string | null;
  entry_sha256: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  chain_valid?: boolean;
}

export interface BatchFilters {
  status?: BatchStatus | '';
  jurisdiction?: Jurisdiction | '';
  document_category?: DocumentCategory | '';
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ItemFilters {
  search?: string;
  document_number?: string;
  counterparty?: string;
  tax_id?: string;
  sha256?: string;
  date_from?: string;
  date_to?: string;
  document_category?: DocumentCategory | '';
  jurisdiction?: Jurisdiction | '';
  page?: number;
  per_page?: number;
}

export interface AuditFilters {
  action?: string;
  batch_id?: string;
  page?: number;
  per_page?: number;
}
