export type IntrastatFlow = 'sales' | 'purchases';
export type IntrastatModel = 'INTRA-1' | 'INTRA-2';
export type IntrastatPeriodicity = 'M' | 'T';
export type IntrastatStatus = 'draft' | 'validated' | 'submitted';

export interface IntrastatSectionSummary {
  section: number;
  count: number;
  total_eur: number;
}

export interface IntrastatSourceDocument {
  type: 'invoice' | 'passive_invoice';
  id: string;
  number?: string | null;
  date?: string | null;
}

export interface IntrastatDeclarationLine {
  id: string;
  line_number: number;
  section: number;
  partner_country_code?: string | null;
  partner_vat_number?: string | null;
  amount_eur?: number | null;
  amount_currency?: number | null;
  transaction_nature_a?: string | null;
  transaction_nature_b?: string | null;
  cn8_code?: string | null;
  net_mass_kg?: number | null;
  supplementary_units?: number | null;
  statistical_value_eur?: number | null;
  delivery_terms?: string | null;
  transport_mode?: string | null;
  goods_country_code?: string | null;
  origin_country_code?: string | null;
  province_code?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  service_code?: string | null;
  supply_mode?: string | null;
  payment_method?: string | null;
  payment_country_code?: string | null;
  source_documents?: IntrastatSourceDocument[];
}

export interface IntrastatDeclaration {
  id: string;
  flow: IntrastatFlow;
  model: IntrastatModel;
  year: number;
  periodicity: IntrastatPeriodicity;
  period: number;
  reference_number: number;
  content_code: number;
  special_case_code: number;
  obligated_vat_number?: string | null;
  delegate_vat_number?: string | null;
  includes_statistical_data: boolean;
  has_annual_flows_above_20_million: boolean;
  status: IntrastatStatus;
  validated_at?: string | null;
  submitted_at?: string | null;
  protocol_number?: string | null;
  notes?: string | null;
  last_export_file_name?: string | null;
  last_exported_at?: string | null;
  sections?: IntrastatSectionSummary[];
  lines?: IntrastatDeclarationLine[];
  created_at: string;
  updated_at: string;
}

export interface IntrastatDeclarationRequest {
  flow: IntrastatFlow;
  year: number;
  periodicity: IntrastatPeriodicity;
  period: number;
  reference_number?: number | null;
  content_code?: number;
  special_case_code?: number;
  obligated_vat_number?: string | null;
  delegate_vat_number?: string | null;
  includes_statistical_data?: boolean;
  has_annual_flows_above_20_million?: boolean;
  notes?: string | null;
}

export interface IntrastatGenerateRequest extends IntrastatDeclarationRequest {
  unclassified_as?: 'goods' | 'services' | null;
  defaults?: {
    transaction_nature_a?: string | null;
    transaction_nature_b?: string | null;
    delivery_terms?: string | null;
    transport_mode?: string | null;
    province_code?: string | null;
    payment_country_code?: string | null;
    service_code?: string | null;
  };
}

export interface IntrastatLineRequest {
  section: number;
  partner_country_code?: string | null;
  partner_vat_number?: string | null;
  amount_eur?: number | null;
  amount_currency?: number | null;
  transaction_nature_a?: string | null;
  transaction_nature_b?: string | null;
  cn8_code?: string | null;
  net_mass_kg?: number | null;
  supplementary_units?: number | null;
  statistical_value_eur?: number | null;
  delivery_terms?: string | null;
  transport_mode?: string | null;
  goods_country_code?: string | null;
  origin_country_code?: string | null;
  province_code?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  service_code?: string | null;
  supply_mode?: string | null;
  payment_method?: string | null;
  payment_country_code?: string | null;
}

export interface IntrastatSubmitRequest {
  protocol_number: string;
  submitted_at?: string | null;
}

export type IntrastatExportChannel = 'entratel' | 'customs';

/** Body of `POST /intrastat/exports` (ExportRequest): the answer is the telematic text file. */
export interface IntrastatExportRequest {
  declaration_ids: string[];
  channel: IntrastatExportChannel;
  customs_section_code: string;
  user_code?: string | null;
  sender_code?: string | null;
  site_progressive?: number | null;
  transmission_date?: string | null;
  sequence?: string | null;
}

export type IntrastatSupplyKind = 'goods' | 'services';

export interface IntrastatProductProfile {
  product_id: string;
  product_name?: string;
  supply_kind?: IntrastatSupplyKind;
  cn8_code?: string | null;
  service_code?: string | null;
  origin_country_code?: string | null;
}

/** Body of `PUT /intrastat/product-profiles/{productId}` (ProductProfileRequest): supply_kind is required. */
export interface IntrastatProductProfileRequest {
  supply_kind: IntrastatSupplyKind;
  cn8_code?: string | null;
  net_mass_kg?: number | null;
  supplementary_units_per_unit?: number | null;
  service_code?: string | null;
  origin_country_code?: string | null;
  origin_province_code?: string | null;
}

export interface IntrastatValidationProblem {
  line_number?: number;
  field: string;
  message: string;
}

export interface IntrastatValidationResponse {
  is_valid: boolean;
  problems?: IntrastatValidationProblem[];
}

export interface IntrastatPeriodicityThresholds {
  year: number;
  quarter?: number;
  advised_periodicity: IntrastatPeriodicity;
  sales_goods_amount: number;
  sales_services_amount: number;
  purchases_goods_amount: number;
  purchases_services_amount: number;
  notes?: string[];
}

/** Code lists of the INTRA lists (`GET /intrastat/codes`): the server owns the values. */
export interface IntrastatCodeList {
  member_states: Record<string, { vat_lengths: number[] }>;
  transaction_natures: Record<string, string[]>;
  not_reported_transaction_natures: string[];
  triangular_nature_letters: Record<string, string>;
  /** Table C: code => label. */
  transport_modes: Record<string, string>;
  /** Table D: group letter => Incoterms of the group. */
  delivery_term_groups: Record<string, string[]>;
  supply_modes: Record<string, string>;
  payment_methods: Record<string, string>;
  content_codes: Record<string, string>;
  special_case_codes: Record<string, string>;
  simplified_combined_nomenclature_code: string;
}
