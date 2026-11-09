export type EDocumentNetworkType = 'ebill' | 'peppol' | 'nso';

export interface EDocumentNetworkStatus {
  network: EDocumentNetworkType;
  label: string;
  driver: string;
  is_available: boolean;
}

export interface EDocumentTransmission {
  id: string;
  network: EDocumentNetworkType | string;
  document_reference: string;
  recipient_identifier: string;
  payload_sha256: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'rejected' | string;
  external_id: string | null;
  driver: string;
  created_at?: string;
  error_message?: string | null;
}

export interface SendEDocumentRequest {
  document_reference: string;
  recipient_identifier: string;
  payload_base64: string;
}

export type DocumentTrustType = 'invoice' | 'passive_invoice';

export interface DocumentSignature {
  id: string;
  document_type: DocumentTrustType;
  document_id: string;
  format: 'sha256-integrity' | 'cades-bes-p7m' | string;
  driver: 'local' | 'cades' | string;
  signature_sha256: string;
  certificate_fingerprint?: string | null;
  signer_subject?: string | null;
  signed_at: string;
  valid?: boolean;
}

export interface SignDocumentRequest {
  document_type: DocumentTrustType;
  document_id: string;
}

export interface VerifySignatureResult {
  signature_id: string;
  document_type: DocumentTrustType;
  document_id: string;
  driver: string;
  format: string;
  valid: boolean;
  reason?: 'content_changed' | 'signature_invalid' | 'signature_unreadable' | 'document_missing' | null;
  content_changed: boolean;
  trust_chain_validated: boolean;
}

export interface PreservationRecord {
  id: string;
  document_type: DocumentTrustType;
  document_id: string;
  driver: 'local' | 'accredited' | string;
  mode: 'fingerprint_only' | 'accredited_sip' | string;
  archive_identifier?: string | null;
  package_sha256: string;
  timestamped_at: string;
  status: 'draft' | 'archived' | 'rejected' | string;
  expiration_date?: string | null;
}

export interface PreserveDocumentRequest {
  document_type: DocumentTrustType;
  document_id: string;
}

export interface DocumentSigningSettings {
  driver: 'local' | 'cades';
  certificate_expiry: string | null;
  certificate_subject?: string | null;
  is_certificate_valid?: boolean;
  has_private_key?: boolean;
}

export interface UpdateDocumentSigningSettingsRequest {
  driver: 'local' | 'cades';
  certificate?: string | null;
  private_key?: string | null;
  passphrase?: string | null;
}
