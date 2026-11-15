export type DmsDocumentStatus = 'draft' | 'published' | 'archived';

export type DmsRetentionAction = 'archive' | 'delete';

export type DmsExtractionStatus = 'pending' | 'confirmed' | 'rejected';

export interface DmsDocumentResource {
  id: string;
  folder_id?: string | null;
  folder_name?: string | null;
  title: string;
  description?: string | null;
  document_type?: string | null;
  status: DmsDocumentStatus;
  legal_hold: boolean;
  legal_hold_reason?: string | null;
  current_version?: number;
  retention_until?: string | null;
  is_checked_out?: boolean;
  checkout_note?: string | null;
  lock_expires_at?: string | null;
  checked_out_by?: string | null;
  checked_out_at?: string | null;
  tags?: { id: string; name: string }[];
  metadata?: Record<string, unknown>;
  /** Present only when the API embeds it (the list does not yet): `folder_name` and `latest_version` fall back to the folder list and `current_version`. */
  latest_version?: DmsDocumentVersionResource;
  created_at?: string;
  updated_at?: string;
}

export interface DmsDocumentVersionResource {
  id: string;
  document_id: string;
  version_number: number;
  original_name: string;
  mime_type?: string | null;
  size: number;
  sha256: string;
  is_attachment_reference?: boolean;
  comment?: string | null;
  uploaded_by?: string | null;
  created_at?: string;
}

export interface DmsFolderResource {
  id: string;
  parent_id?: string | null;
  name: string;
  access_roles?: string[];
  documents_count?: number;
  created_at?: string;
}

export interface DmsTagResource {
  id: string;
  name: string;
  color?: string;
  documents_count?: number;
}

export interface DmsRetentionPolicyResource {
  id: string;
  name: string;
  document_type?: string | null;
  retention_months: number;
  action: DmsRetentionAction;
  is_active: boolean;
  created_at?: string;
}

export interface DmsExtractionResource {
  id: string;
  document_id: string;
  field_name: string;
  extracted_value: string;
  confidence: number;
  status: DmsExtractionStatus;
  created_at?: string;
}

export interface DmsAuditEntry {
  id: string;
  document_id: string;
  event_type: string;
  actor_id?: string | null;
  actor_name?: string | null;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface DmsResolvedLink {
  id: string;
  linkable_type: string;
  linkable_id: string;
  label?: string | null;
  record_exists?: boolean;
  created_at?: string | null;
}

export interface DmsStoreDocumentRequest {
  title: string;
  folder_id?: string | null;
  description?: string | null;
  document_type?: string | null;
  comment?: string;
  allow_duplicate?: boolean;
  /** The real file, sent as multipart `file`. */
  file: File;
}

export interface DmsUpdateDocumentRequest {
  title?: string;
  folder_id?: string | null;
  description?: string | null;
  document_type?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DmsStoreFolderRequest {
  name: string;
  parent_id?: string | null;
  access_roles?: string[];
}

export interface DmsStoreTagRequest {
  name: string;
  color?: string;
}

export interface DmsStoreRetentionPolicyRequest {
  name: string;
  document_type?: string | null;
  retention_months: number;
  action: DmsRetentionAction;
  is_active: boolean;
}

export interface DmsLinkDocumentRequest {
  /** Alias of the linked record type (contact, invoice, quote...). */
  linkable_type: string;
  linkable_id: string;
}

export interface DmsCheckOutRequest {
  note?: string;
  /** The lock lapses after this many minutes (5 to 10080); asking again as the holder extends it. */
  expires_in_minutes?: number;
}

export interface DmsCheckInRequest {
  /** Optional new file, sent as multipart `file`. */
  file?: File | null;
  comment?: string;
}

export interface DmsStoreVersionRequest {
  file: File;
  comment?: string;
}

export interface DmsPlaceLegalHoldRequest {
  reason: string;
}

export interface DmsImportAttachmentRequest {
  source_type: string;
  source_id: string;
  title?: string;
  folder_id?: string;
}

export interface DmsConfirmExtractionRequest {
  confirmed_value?: string;
}

export interface DmsUpdateAiSettingRequest {
  is_ocr_enabled: boolean;
  min_confidence: number;
  auto_tagging: boolean;
}

export interface DmsAiSettingsResource {
  is_ocr_enabled: boolean;
  min_confidence: number;
  auto_tagging: boolean;
}

export interface DmsDocumentParams {
  folder_id?: string;
  document_type?: string;
  status?: DmsDocumentStatus;
  /** Words that must all appear in title, description, type, file names, tags or metadata. */
  q?: string;
  search?: string;
  tag?: string;
  page?: number;
  per_page?: number;
}

export type DmsApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type DmsApproverType = 'user' | 'role';

export interface DmsApprovalStep {
  position?: number;
  name: string;
  approver_type: DmsApproverType;
  approver_user_id?: string | null;
  approver_role?: string | null;
}

export interface DmsApprovalTemplateResource {
  id: string;
  name: string;
  document_type: string | null;
  is_active: boolean;
  steps?: DmsApprovalStep[];
}

export interface DmsSaveApprovalTemplateRequest {
  name: string;
  document_type?: string | null;
  is_active?: boolean;
  steps: DmsApprovalStep[];
}

export interface DmsApprovalDecision {
  step_position: number;
  step_name: string;
  decided_by: string | null;
  decision: 'approved' | 'rejected';
  comment: string | null;
  decided_at: string;
}

export interface DmsApprovalRequestResource {
  id: string;
  document_id: string;
  document_title?: string | null;
  document_version_id: string | null;
  template_id: string | null;
  template_name: string;
  status: DmsApprovalStatus;
  current_step: number;
  total_steps: number;
  current_step_detail: DmsApprovalStep | null;
  requested_by: string | null;
  note: string | null;
  completed_at: string | null;
  created_at: string;
  decisions?: DmsApprovalDecision[];
}

export interface DmsRequestApprovalRequest {
  template_id: string;
  note?: string | null;
}

export interface DmsApprovalParams {
  status?: DmsApprovalStatus;
  document_id?: string;
  awaiting_me?: boolean;
  page?: number;
  per_page?: number;
}

export type DmsOcrStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface DmsOcrJobResource {
  id: string;
  document_id: string;
  document_version_id: string;
  status: DmsOcrStatus;
  engine: string | null;
  page_count: number | null;
  confidence: string | null;
  failure_reason: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  text_content?: string | null;
}

export interface DmsPreservationChainLink {
  id: string;
  sequence: number;
  package_id: string;
  package_hash: string;
  previous_link_hash: string;
  link_hash: string;
  anchored_by: string | null;
  created_at: string;
}

export interface DmsPreservationChainVerification {
  valid: boolean;
  links_checked: number;
  broken_at_sequence: number | null;
  reason: string | null;
}

export interface DmsPreservationPackageStatus {
  package_id: string;
  name: string;
  document_class: string;
  closed_at: string | null;
  retention_until: string | null;
  retention_expired: boolean;
  timestamped: boolean;
  chained: boolean;
  chain_sequence: number | null;
  sealing_status: 'sealed' | 'awaiting_anchor';
}

export interface DmsPreservationChainStatus {
  closed_packages: number;
  chained_packages: number;
  unchained_packages: number;
  packages: DmsPreservationPackageStatus[];
}
