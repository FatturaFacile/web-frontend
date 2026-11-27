export type SelfInvoiceDocumentType = 'TD16' | 'TD17' | 'TD18' | 'TD19' | 'TD20' | 'TD28';

export type SelfInvoiceStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_SEND'
  | 'SENT_TO_SDI'
  | 'DELIVERED_RC'
  | 'REJECTED_NS'
  | 'FAILED_TRANSMISSION'
  | 'CANCELLED';

export type EsterometroSdiStatus =
  | 'DRAFT'
  | 'PENDING_SEND'
  | 'SENT_TO_SDI'
  | 'DELIVERED_RC'
  | 'REJECTED_NS'
  | 'FAILED_TRANSMISSION';

export type DeadlineUrgency = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'TRANSMITTED';

export type TransactionNature =
  | 'DOMESTIC_RC'
  | 'SERVICES'
  | 'GOODS'
  | 'GOODS_IN_ITALY'
  | 'REGULARIZATION'
  | 'SAN_MARINO';

export interface ComplianceWarning {
  code: string;
  severity: string;
  message: string;
}

export interface SelfInvoiceLine {
  id: string;
  line_number: number;
  description: string;
  transaction_nature: TransactionNature;
  quantity: number;
  unit_price_original: number;
  unit_price_eur: number;
  taxable_amount_original: number;
  taxable_amount_eur: number;
  source_vat_nature: string | null;
  vat_rate: number;
  vat_nature: string | null;
  vat_amount_eur: number;
  deductibility_percent: number;
  deductible_vat_eur: number;
  non_deductible_vat_eur: number;
  normative_reference: string | null;
}

export interface SelfInvoiceSdiLog {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  sdi_identificativo: string | null;
  sdi_filename: string | null;
  error_code: string | null;
  error_description: string | null;
  created_at: string | null;
}

export interface SelfInvoice {
  id: string;
  tenant_id: string | null;
  passive_invoice_id: string | null;
  supplier_id: string | null;
  document_type: SelfInvoiceDocumentType;
  document_type_label: string;
  legal_reference: string;
  suggested_document_type: SelfInvoiceDocumentType | null;
  is_type_overridden: boolean;
  override_reason: string | null;
  compliance_warnings: ComplianceWarning[];
  status: SelfInvoiceStatus;
  sdi_status: EsterometroSdiStatus;
  deadline_urgency: DeadlineUrgency;
  document_number: string;
  fiscal_year: number;
  sequential_number: number;
  sectional_code: string;
  integration_date: string;
  operation_date: string | null;
  receipt_date: string | null;
  transmission_deadline_date: string;
  regularization_trigger: string | null;
  supplier_country_code: string;
  supplier_region: string;
  supplier_name: string;
  supplier_vat_number: string | null;
  supplier_fiscal_code: string | null;
  supplier_address: Record<string, unknown> | null;
  original_invoice_number: string | null;
  original_invoice_date: string | null;
  original_sdi_identifier: string | null;
  original_currency: string;
  original_net_amount: number;
  original_vat_amount: number;
  original_gross_amount: number;
  exchange_rate: number;
  exchange_rate_date: string | null;
  exchange_rate_source: string;
  currency: string;
  taxable_amount_eur: number;
  vat_amount_eur: number;
  deductible_vat_eur: number;
  non_deductible_vat_eur: number;
  gross_amount_eur: number;
  soggetto_emittente: string;
  recipient_code: string;
  sdi_identificativo: string | null;
  sdi_filename: string | null;
  xml_content?: string | null;
  xml_sha256: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  rejected_at: string | null;
  rejection_code: string | null;
  rejection_description: string | null;
  sales_vat_entry_id: string | null;
  purchase_vat_entry_id: string | null;
  journal_entry_id: string | null;
  is_vat_reconciled: boolean;
  notes: string | null;
  lines?: SelfInvoiceLine[];
  sdi_logs?: SelfInvoiceSdiLog[];
  created_at: string | null;
  updated_at: string | null;
}

export interface EsterometroDashboard {
  as_of: string;
  next_monthly_deadline: string;
  days_to_next_monthly_deadline: number;
  counts: {
    total: number;
    overdue: number;
    due_soon: number;
    upcoming: number;
    transmitted: number;
    rejected: number;
    draft: number;
    reconciled: number;
  };
  totals_eur: {
    taxable_eur: number;
    vat_eur: number;
    deductible_vat_eur: number;
    non_deductible_vat_eur: number;
  };
  by_document_type: {
    document_type: SelfInvoiceDocumentType;
    label: string;
    count: number;
    taxable_eur: number;
    vat_eur: number;
    overdue_count: number;
  }[];
}

export interface ClassificationPreviewResult {
  requires_self_invoice: boolean;
  suggested_document_type: SelfInvoiceDocumentType | null;
  document_type: SelfInvoiceDocumentType | null;
  is_type_overridden: boolean;
  supplier_country_code: string;
  supplier_region: string;
  transaction_nature: TransactionNature;
  source_vat_nature: string | null;
  default_vat_rate: number;
  default_vat_nature: string | null;
  default_deductibility_percent: number;
  soggetto_emittente: string;
  matched_rule_code: string | null;
  legal_reference: string | null;
  compliance_warnings: ComplianceWarning[];
}

export interface SelfInvoiceClassificationRule {
  id: string;
  tenant_id: string | null;
  is_global: boolean;
  code: string;
  name: string;
  document_type: SelfInvoiceDocumentType;
  supplier_region: string;
  supplier_country_code: string | null;
  transaction_nature: string;
  source_vat_nature_prefix: string | null;
  default_vat_rate: number;
  default_vat_nature: string | null;
  default_deductibility_percent: number;
  soggetto_emittente: string;
  priority: number;
  legal_reference: string | null;
  is_active: boolean;
}

export interface SelfInvoiceSetting {
  id: string;
  tenant_id: string | null;
  auto_generate_mode: 'auto_draft' | 'auto_validate' | 'manual';
  auto_post_vat_registers: boolean;
  auto_post_journal: boolean;
  sales_vat_section_code: string;
  purchase_vat_section_code: string;
  numbering_prefix: string;
  numbering_padding: number;
  default_recipient_code: string;
  use_tenant_sdi_code: boolean;
  signature_format: 'none' | 'cades' | 'xades';
  clearing_account_id: string | null;
  non_deductible_account_id: string | null;
}

export interface CreateSelfInvoicePayload {
  passive_invoice_id?: string | null;
  supplier_id?: string | null;
  document_type: SelfInvoiceDocumentType;
  transaction_nature?: TransactionNature;
  override_reason?: string | null;
  regularization_trigger?: string | null;
  integration_date: string;
  operation_date?: string | null;
  receipt_date?: string | null;
  supplier_country_code: string;
  supplier_name: string;
  supplier_vat_number?: string | null;
  supplier_fiscal_code?: string | null;
  original_invoice_number?: string | null;
  original_invoice_date?: string | null;
  original_sdi_identifier?: string | null;
  original_currency?: string;
  exchange_rate?: number | null;
  notes?: string | null;
  validate_and_reconcile?: boolean;
  lines: {
    description: string;
    transaction_nature?: TransactionNature;
    quantity?: number;
    unit_price_original: number;
    taxable_amount_original?: number;
    vat_rate: number;
    vat_nature?: string | null;
    deductibility_percent?: number;
  }[];
}
