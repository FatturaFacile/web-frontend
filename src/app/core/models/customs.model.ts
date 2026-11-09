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
  items?: CustomsDeclarationItem[];
}

export interface CustomsDeclarationParams {
  declaration_type?: CustomsDirection;
  status?: CustomsDeclarationStatus;
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
