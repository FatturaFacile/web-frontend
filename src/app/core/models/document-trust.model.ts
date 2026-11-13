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
  /** SHA-256 of the signed content (the API stores no separate hash of the signature). */
  content_sha256: string;
  /** The signing time: the moment the signature row was created. */
  created_at: string;
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
  provider: 'local' | 'accredited' | string;
  reference?: string | null;
  content_sha256: string;
  created_at: string;
  status: 'fingerprint_only' | 'archived' | 'rejected' | string;
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
