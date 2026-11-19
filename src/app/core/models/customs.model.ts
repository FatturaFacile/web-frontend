export type CustomsDirection = 'import' | 'export' | 'transit';
export type CustomsDossierStatus =
  | 'open'
  | 'quoted'
  | 'in_transit'
  | 'delivered'
  | 'invoiced'
  | 'closed'
  | 'cancelled';
export type CustomsDeclarationStatus =
  | 'draft'
  | 'validated'
  | 'submitted'
  | 'accepted'
  | 'rejected'
  | 'cancelled';
export type CustomsRegime = 'edec' | 'passar' | 'aida';
export type CustomsTransitDocumentType = 'none' | 'T1' | 'T2';
export type CustomsDocumentLanguage = 'it_en' | 'it_de';
export type CustomsChannel = 'local' | 'edec' | 'passar' | 'aida';
export type CustomsImportBillStatus = 'draft' | 'posted';
export type CustomsSignatureStatus = 'verified' | 'invalid' | 'not_signed' | 'unsupported';
export type ShipmentRequestStatus = 'pending' | 'accepted' | 'refused';

export interface CustomsDossierResource {
  id: string;
  tenant_id?: string | null;
  dossier_number: string;
  customer_contact_id: string;
  customer_name?: string;
  service_type: string;
  direction: CustomsDirection;
  currency: string;
  status: CustomsDossierStatus;
  origin_country?: string | null;
  destination_country?: string | null;
  incoterms?: string | null;
  gross_weight_kg?: string | number | null;
  volume_m3?: string | number | null;
  packages?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CustomsDossierRequest {
  customer_contact_id: string;
  service_type: string;
  direction: CustomsDirection;
  currency: string;
  status?: CustomsDossierStatus;
  origin_country?: string;
  destination_country?: string;
  incoterms?: string;
  gross_weight_kg?: number;
  volume_m3?: number;
  packages?: number;
  notes?: string;
}

export interface CustomsDossierParams {
  status?: CustomsDossierStatus;
  customer_contact_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface CustomsDeclarationItem {
  id?: string;
  item_number?: number;
  tariff_number?: string;
  commercial_description?: string;
  gross_mass?: string | number;
  net_mass?: string | number;
  statistical_value?: string | number;
  vat_value?: string | number;
  origin_country?: string;
}

export interface CustomsDeclarationResource {
  id: string;
  dossier_id?: string | null;
  declaration_type: CustomsDirection;
  status: CustomsDeclarationStatus;
  trader_declaration_number: string;
  trader_reference?: string | null;
  mrn?: string | null;
  mrn_version?: number | null;
  total_gross_mass?: string | null;
  total_net_mass?: string | null;
  total_statistical_value?: string | null;
  total_vat_value?: string | null;
  total_packages?: number | null;
  dispatch_country?: string | null;
  destination_country?: string | null;
  incoterms?: string | null;
  declared_on?: string | null;
  customs_regime?: CustomsRegime | null;
  transit_document_type?: CustomsTransitDocumentType | null;
  transit_guarantee_reference?: string | null;
  transit_departure_office?: string | null;
  transit_destination_office?: string | null;
  transit_deadline_on?: string | null;
  transit_discharged_at?: string | null;
  border_crossing?: string | null;
  items?: CustomsDeclarationItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomsDeclarationRequest {
  declaration_type: CustomsDirection;
  trader_declaration_number?: string;
  trader_reference?: string;
  dossier_id?: string;
  delivery_note_id?: string;
  consignor_contact_id?: string;
  consignee_contact_id?: string;
  importer_contact_id?: string;
  customs_office_number?: string;
  dispatch_country?: string;
  destination_country?: string;
  incoterms?: string;
  language?: 'it' | 'en' | 'de' | 'fr';
  declared_on?: string;
  customs_regime?: CustomsRegime;
  transit_document_type?: CustomsTransitDocumentType;
  transit_guarantee_reference?: string | null;
  transit_departure_office?: string | null;
  transit_destination_office?: string | null;
  transit_deadline_on?: string | null;
  border_crossing?: string | null;
  items?: CustomsDeclarationItem[];
}

export interface CustomsDeclarationParams {
  declaration_type?: CustomsDirection;
  status?: CustomsDeclarationStatus;
  /** Sent to the API; the list endpoint ignores it until the backend filters on it. */
  customs_regime?: CustomsRegime;
  mrn?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface CustomsAssessmentDecisionResource {
  id: string;
  mrn: string;
  version: number;
  document_type: string;
  direction: CustomsDirection;
  document_date: string;
  duty_amount: string;
  vat_amount: string;
  vat_base_amount?: string;
  vat_rate?: string;
  xml_sha256?: string;
  signature_status: CustomsSignatureStatus;
  signature_report?: Record<string, unknown> | null;
  created_at?: string;
}

export interface CustomsAssessmentParams {
  mrn?: string;
  document_type?: string;
  direction?: CustomsDirection;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export interface CustomsProfitabilityResource {
  currency: string;
  revenue: string;
  direct_costs: string;
  indirect_costs: string;
  contribution_margin: string;
  result: string;
  margin_percent: string;
}

export interface CustomsTariffGridResource {
  id: string;
  name: string;
  service_type: string;
  currency: string;
  valid_from?: string | null;
  valid_to?: string | null;
  is_active: boolean;
  rates?: {
    id: string;
    weight_from_kg: number;
    weight_to_kg: number;
    rate_amount: string;
  }[];
  created_at?: string;
}

export interface CustomsTariffGridRequest {
  name: string;
  service_type: string;
  currency: string;
  valid_from?: string;
  valid_to?: string;
  is_active?: boolean;
}

export interface CustomsShipmentRequestResource {
  id: string;
  request_number: string;
  customer_name?: string;
  status: ShipmentRequestStatus;
  pickup_on?: string | null;
  gross_weight_kg?: string | number | null;
  volume_m3?: string | number | null;
  origin_address?: string | null;
  destination_address?: string | null;
  created_at?: string;
}

/** One export declaration that still lacks the export proof (eVV) of its invoices. */
export interface CustomsMissingEvvEntry {
  declaration_id: string;
  trader_declaration_number: string;
  mrn: string | null;
  invoices: { id: string; invoice_number: string }[];
}

export interface CustomsTradeComplianceDashboard {
  by_direction: Record<string, number>;
  by_regime: Record<string, number>;
  by_status: Record<string, number>;
  transit_overdue: number;
  missing_evv: CustomsMissingEvvEntry[];
}

export interface CustomsExportProof {
  has_proof: boolean;
  decision: Record<string, unknown> | null;
}

export interface CustomsMrnRequest {
  mrn: string;
}

export interface CustomsLinkInvoicesRequest {
  invoice_ids: string[];
}

export interface CustomsLinkedInvoices {
  linked: number;
}

export interface CustomsImportBillResource {
  id: string;
  bill_number: string;
  bill_date: string;
  declaration_id?: string | null;
  passive_invoice_id?: string | null;
  broker_invoice_reference?: string | null;
  currency: string;
  customs_value: string | number;
  duty_amount: string | number;
  ancillary_costs?: string | number | null;
  vat_rate: string | number;
  import_vat_amount?: string | number | null;
  notes?: string | null;
  status: CustomsImportBillStatus;
  created_at?: string;
  updated_at?: string;
}

export interface CustomsImportBillRequest {
  bill_number: string;
  bill_date: string;
  declaration_id?: string | null;
  passive_invoice_id?: string | null;
  broker_invoice_reference?: string | null;
  currency: string;
  customs_value: number;
  duty_amount: number;
  ancillary_costs?: number | null;
  vat_rate: number;
  /** Computed server-side on value + duty + ancillary costs when omitted. */
  import_vat_amount?: number | null;
  notes?: string | null;
}

export interface CustomsImportBillReconciliation {
  bill_total: string | number;
  supplier_total: string | number | null;
  remainder: string | number | null;
  matches: boolean;
}

export interface CustomsImportBillParams {
  page?: number;
  per_page?: number;
}
