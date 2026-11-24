export interface FixedAssetResource {
  id: string;
  asset_number: string | null;
  barcode_tag: string | null;
  serial_number: string | null;
  name: string | null;
  description: string | null;
  category_id: string | null;
  asset_class_id: string | null;
  location_id: string | null;
  parent_asset_id: string | null;
  custodian_user_id: string | null;
  project_id: string | null;
  cost_center_id: string | null;
  supplier_id: string | null;
  purchase_invoice_id?: string | null;
  purchase_invoice_line_id?: string | null;
  purchase_invoice_number?: string | null;
  fiscal_jurisdiction?: 'CH' | 'IT' | null;
  fiscal_rate_id?: string | null;
  fiscal_rate?: FiscalDepreciationRateResource | null;
  status: string | null;
  condition: string | null;
  acquisition_type: string | null;
  acquisition_date: string | null;
  capitalization_date: string | null;
  commissioning_date: string | null;
  in_service_date: string | null;
  depreciation_start_date: string | null;
  retirement_date: string | null;
  disposal_date: string | null;
  currency: string | null;
  acquisition_cost: string | null;
  capitalized_cost: string | null;
  salvage_value: string | null;
  depreciable_base: string | null;
  accumulated_depreciation: string | null;
  carrying_amount: string | null;
  replacement_cost: string | null;
  depreciation_method: string | null;
  pro_rata_convention?: 'full' | 'monthly' | 'daily' | 'half_year' | null;
  useful_life_years: number | null;
  useful_life_months: number | null;
  depreciation_rate_percent: string | null;
  is_depreciable: boolean;
  is_fully_depreciated: boolean;
  immediate_expensing_applied?: boolean;
  incentive_regime?: string | null;
  incentive_rate_percent?: string | null;
  incentive_installment_years?: number | null;
  incentive_interconnection_date?: string | null;
  incentive_tax_credit_total?: string | null;
  incentive_extra_deduction_base?: string | null;
  approval_status: string | null;
  is_locked: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface FiscalDepreciationRateResource {
  id: string;
  jurisdiction: 'CH' | 'IT';
  regime_code: string;
  sector_code?: string | null;
  category_code: string;
  category_name: string;
  category_translations?: Record<string, string> | null;
  declining_rate_percent?: string | null;
  linear_rate_percent: string;
  useful_life_years: number;
  first_year_half_rule: boolean;
  immediate_expensing_threshold?: string | null;
  legal_reference?: string | null;
  is_active: boolean;
}

export type ProRataConvention = 'full' | 'monthly' | 'daily' | 'half_year';

export type FiscalIncentiveRegime =
  | 'none'
  | 'super_ammortamento'
  | 'iper_ammortamento'
  | 'transition_4_0_tangible'
  | 'transition_4_0_intangible'
  | 'transition_5_0';

export interface StoreFixedAssetPayload {
  name: string;
  category_id: string;
  acquisition_cost: number;
  salvage_value?: number | null;
  currency?: string | null;
  asset_number?: string | null;
  serial_number?: string | null;
  barcode_tag?: string | null;
  location_id?: string | null;
  cost_center_id?: string | null;
  supplier_id?: string | null;
  purchase_invoice_number?: string | null;
  fiscal_jurisdiction?: 'CH' | 'IT' | null;
  fiscal_rate_id?: string | null;
  fiscal_sector_code?: string | null;
  acquisition_date?: string | null;
  in_service_date?: string | null;
  depreciation_method?: 'straight_line' | 'declining_balance' | 'double_declining_balance' | 'units_of_production' | 'immediate_expensing' | null;
  pro_rata_convention?: ProRataConvention | null;
  useful_life_years?: number | null;
  immediate_expensing_applied?: boolean | null;
  incentive_regime?: FiscalIncentiveRegime | null;
  incentive_rate_percent?: number | null;
  incentive_installment_years?: number | null;
  incentive_interconnection_date?: string | null;
  condition?: 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | null;
  description?: string | null;
}

/** Body of `PUT /eam/assets/{id}` (UpdateFixedAssetRequest): updatable descriptive & classification fields. */
export type UpdateFixedAssetPayload = Partial<
  Pick<
    StoreFixedAssetPayload,
    'name' | 'description' | 'serial_number' | 'barcode_tag' | 'condition' | 'location_id' | 'cost_center_id' | 'purchase_invoice_number' | 'fiscal_jurisdiction' | 'fiscal_rate_id' | 'salvage_value' | 'pro_rata_convention'
  >
> & { asset_class_id?: string | null; replacement_cost?: number; warranty_expiry_date?: string | null };

/** Body of `POST /eam/assets/{id}/dispose` & `/dispose/preview` (DisposeAssetRequest). */
export interface DisposeAssetPayload {
  disposal_type: 'sale' | 'scrap' | 'retirement' | 'donation' | 'theft_loss';
  disposed_percentage?: number | null;
  proceeds_amount?: number | null;
  disposal_costs?: number | null;
  disposal_date?: string | null;
  buyer_contact_id?: string | null;
  sales_invoice_id?: string | null;
  disposal_document_number?: string | null;
  fiscal_gain_spread_years?: number | null;
  reason?: string | null;
  auto_post_to_gl?: boolean;
}

export interface ConfigureAssetBookPayload {
  fiscal_regime?: 'civil_linear' | 'ch_afc_degressive' | 'ch_afc_linear' | 'ch_afc_immediate' | 'it_dm_1988' | null;
  fiscal_rate_id?: string | null;
  depreciation_method?: 'straight_line' | 'declining_balance' | 'double_declining_balance' | 'units_of_production' | 'immediate_expensing' | null;
  useful_life_months?: number | null;
  rate_percent?: number | null;
  declining_balance_factor?: number | null;
  pro_rata_convention?: ProRataConvention | null;
  first_year_half_rate?: boolean | null;
  switch_to_straight_line?: boolean | null;
  pro_memoria_value?: number | null;
  immediate_expensing?: boolean | null;
}

export interface DisposalBookPreview {
  cost_at_disposal: string;
  accumulated_depreciation: string;
  carrying_amount: string;
  gain_loss_amount: string;
  is_gain: boolean;
  is_loss: boolean;
  temporary_difference?: string;
}

export interface DisposalProposedGlLine {
  account_code: string;
  side: 'debit' | 'credit';
  amount: string;
  description: string;
}

export interface DisposalPreviewResponse {
  asset_id: string;
  asset_number: string;
  disposal_type: string;
  disposed_percentage: string;
  disposal_document_number: string | null;
  proceeds_amount: string;
  disposal_costs: string;
  net_proceeds: string;
  civil: DisposalBookPreview;
  fiscal: DisposalBookPreview;
  proposed_gl_lines: DisposalProposedGlLine[];
}

export interface YearEndBatchPayload {
  year: number;
  auto_post_to_gl?: boolean;
}

export interface YearEndBatchResponse {
  year: number;
  statutory_run: DepreciationRunResource;
  tax_run: DepreciationRunResource;
  civil_total: string;
  fiscal_total: string;
  temporary_difference: string;
  journal_entry_ids: string[];
}

/** Body of `POST /eam/depreciation/runs` and `/simulate` (RunDepreciationRequest). */
export interface RunDepreciationPayload {
  period_code: string;
  period_type?: 'monthly' | 'quarterly' | 'yearly';
  ledger_type?: 'statutory' | 'tax' | 'ifrs' | 'management' | 'civil' | 'fiscal';
  single_asset_id?: string | null;
  category_id?: string | null;
  auto_post_to_gl?: boolean;
}

export interface AssetBookResource {
  id: string;
  asset_id: string | null;
  ledger_type: string | null;
  fiscal_regime?: string | null;
  depreciation_method: string | null;
  useful_life_months: number | null;
  rate_percent: string | null;
  first_year_half_rate?: boolean;
  switch_to_straight_line?: boolean;
  pro_memoria_value?: string | null;
  immediate_expensing?: boolean;
  cost: string | null;
  salvage_value: string | null;
  depreciable_base: string | null;
  accumulated_depreciation: string | null;
  net_book_value: string | null;
  fiscal_incentive_regime?: string | null;
  fiscal_incentive_rate_percent?: string | null;
  fiscal_incentive_base?: string | null;
  fiscal_incentive_utilized?: string | null;
  is_fully_depreciated: boolean;
  posts_to_gl: boolean;
}

export interface AssetCategoryResource {
  id: string;
  parent_id: string | null;
  code: string | null;
  name: string | null;
  asset_type: string | null;
  depreciation_method: string | null;
  useful_life_years: number | null;
  statutory_rate_percent: string | null;
}

export interface DepreciationScheduleResource {
  id: string;
  asset_id: string | null;
  run_id: string | null;
  ledger_type: string | null;
  period_code: string | null;
  depreciation_method: string | null;
  opening_book_value: string | null;
  depreciation_amount: string | null;
  closing_book_value: string | null;
  accumulated_depreciation: string | null;
  status: string | null;
  posted_at: string | null;
}

export interface DepreciationRunResource {
  id: string;
  run_number: string | null;
  period_code: string | null;
  period_type: string | null;
  ledger_type: string | null;
  assets_processed_count: number | null;
  total_depreciation_amount: string | null;
  status: string | null;
  executed_at: string | null;
  posted_at: string | null;
}

export interface AssetTagData {
  asset_id: string;
  asset_number: string;
  barcode_value: string;
  barcode_symbology: 'code128';
  qr_payload: string | Record<string, never>;
  label_lines: unknown[];
}

export interface MaintenanceWorkOrderResource {
  id: string;
  work_order_number: string | null;
  asset_id: string | null;
  maintenance_type: string | null;
  priority: string | null;
  status: string | null;
  scheduled_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_cost: string | null;
  problem_description: string | null;
  resolution_notes: string | null;
}
