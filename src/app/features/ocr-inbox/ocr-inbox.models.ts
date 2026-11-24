/** Wire types of `/api/v1/ocr-inbox` (Mod 092: intelligent document and invoice OCR extraction). */

export type ExtractionStatus =
  'queued' | 'processing' | 'ready_for_review' | 'confirmed' | 'failed' | 'rejected';
export type InboxStatus = 'queued' | 'processing' | 'ready_for_review' | 'failed';
export type DocumentCategory =
  'vendor_invoice' | 'expense_receipt' | 'transport_ddt' | 'vendor_quote';
export type ExtractionMethod = 'embedded_xml_or_qr' | 'hybrid_qr_plus_ocr' | 'vision_llm_ocr';
export type SourceChannel =
  'dms_upload' | 'tenant_email_inbox' | 'mobile_camera' | 'desktop_scan' | 'api_webhook';
export type OcrProvider =
  | 'ollama_local'
  | 'layoutlmv3_local'
  | 'tesseract_local'
  | 'gemini_cloud'
  | 'openai_cloud'
  | 'azure_document_intelligence';
export type CodingSource = 'exact' | 'fuzzy' | 'vendor_default' | 'none';

export type InboxCounters = Record<InboxStatus, number>;

export interface InboxItem {
  id: string;
  status: ExtractionStatus;
  document_category: DocumentCategory;
  source_channel: SourceChannel;
  extraction_method: ExtractionMethod | null;
  ocr_provider_used: OcrProvider | null;
  overall_confidence_score: number;
  dms_document_id: string;
  document_title: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  failure_reason: string | null;
  created_at: string | null;
}

export interface PageMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** A region of a page as ratios (0.0-1.0) of its width and height. */
export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundingBoxMap = Record<string, BoundingBox>;

export interface VendorIdentity {
  name: string | null;
  uid: string | null;
  vat_number: string | null;
  fiscal_code: string | null;
  iban: string | null;
  qr_iban: string | null;
}

export interface DocumentHeader {
  number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  qr_reference: string | null;
  qr_reference_type: string | null;
}

export interface ExtractedTotals {
  net: number | null;
  vat: number | null;
  gross: number | null;
}

export interface VatBreakdownRow {
  rate: number;
  net: number;
  vat: number;
}

export interface ExtractedLine {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  net_amount: number | null;
  vat_rate: number | null;
  suggested_gl_account_id?: string | null;
  suggested_vat_code_id?: string | null;
  suggested_cost_center_id?: string | null;
  coding_confidence?: number;
  coding_source?: CodingSource;
  prediction_model_id?: string | null;
}

export interface LineMatch {
  invoice_line_index: number;
  purchase_order_line_id: string;
  price_variance: number;
  price_variance_percent: number;
  quantity_variance: number;
  received_variance: number;
  within_tolerance: boolean;
}

export interface MatchEvaluation {
  purchase_order_id: string;
  purchase_order_number: string;
  matched_by?: 'reference' | 'amount';
  status: 'matched' | 'variance' | 'unmatched';
  lines: LineMatch[];
  unmatched_invoice_lines: number[];
}

export interface ExtractedPayload {
  vendor: VendorIdentity;
  document: DocumentHeader;
  order_references: string[];
  totals: ExtractedTotals;
  vat_breakdown: VatBreakdownRow[];
  lines: ExtractedLine[];
  field_confidence: Record<string, number>;
  meta?: {
    source_format?: 'fatturapa' | 'factur_x_xml' | 'zugferd' | 'swiss_qr_bill' | 'ocr';
    document_type?: string;
    qr_raw_payload?: string;
    warnings?: string[];
  };
  three_way_match?: MatchEvaluation[];
}

export interface LookupOption {
  id: string;
  code: string;
  name?: string | null;
  description?: string | null;
  rate?: number | string | null;
  tax_rate_percent?: number | string | null;
  country_iso?: string;
  is_reverse_charge?: boolean | number;
}

export interface VendorMatch {
  id: string;
  company_name: string | null;
  vat_number: string | null;
  uid_number: string | null;
  iban: string | null;
  qr_iban: string | null;
  country: string | null;
}

export interface PurchaseOrderLineView {
  id: string;
  description: string;
  quantity_ordered: number | string;
  quantity_received: number | string;
  unit_price: number | string;
}

export interface PurchaseOrderView {
  id: string;
  number: string;
  status: string;
  currency: string;
  total: number;
  lines: PurchaseOrderLineView[];
  goods_receipts: { id: string; receipt_number: string; received_date: string }[];
  evaluation: MatchEvaluation | null;
}

export interface Workbench {
  id: string;
  status: ExtractionStatus;
  document_category: DocumentCategory;
  source_channel: SourceChannel;
  extraction_method: ExtractionMethod | null;
  ocr_provider_used: OcrProvider | null;
  overall_confidence_score: number;
  llm_tokens_used: number;
  failure_reason: string | null;
  source: { url: string; mime_type: string | null; file_name: string | null };
  payload: ExtractedPayload | null;
  bounding_boxes: BoundingBoxMap | [];
  review_draft: ReviewedPayload | null;
  vendor: VendorMatch | null;
  lookups: { gl_accounts: LookupOption[]; vat_codes: LookupOption[]; cost_centers: LookupOption[] };
  three_way_match: { purchase_orders: PurchaseOrderView[] };
  resulting_entity: { type: string; id: string } | null;
}

export interface InboxPage {
  counters: InboxCounters;
  queue: InboxItem[];
  meta: PageMeta;
  selected: Workbench | null;
}

export interface ReviewedLine {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  net_amount: number | null;
  vat_rate: number | null;
  gl_account_id: string | null;
  vat_code_id: string | null;
  cost_center_id: string | null;
  purchase_order_line_id?: string | null;
  source_line_index?: number;
}

export interface ReviewedPayload {
  category?: DocumentCategory;
  vendor_id: string | null;
  header: {
    number: string | null;
    issue_date: string | null;
    due_date: string | null;
    currency: string;
    qr_reference: string | null;
  };
  totals: ExtractedTotals;
  lines: ReviewedLine[];
  purchase_order_ids: string[];
  goods_receipt_ids: string[];
  match_override_reason?: string | null;
}

export interface ExtractionJob {
  id: string;
  dms_document_id: string;
  status: ExtractionStatus;
  document_category: DocumentCategory;
  resulting_entity_type: string | null;
  resulting_entity_id: string | null;
}

export interface ReadyEvent {
  job_id: string;
  status: ExtractionStatus;
  document_category: DocumentCategory;
  confidence: number;
}

export type ConfidenceBand = 'high' | 'medium' | 'low';
