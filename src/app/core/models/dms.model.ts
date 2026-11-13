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
  search?: string;
  tag?: string;
  page?: number;
  per_page?: number;
}
