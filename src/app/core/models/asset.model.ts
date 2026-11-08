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
  useful_life_years: number | null;
  useful_life_months: number | null;
  depreciation_rate_percent: string | null;
  is_depreciable: boolean;
  is_fully_depreciated: boolean;
  approval_status: string | null;
  is_locked: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface StoreFixedAssetPayload {
  name: string;
  category_id: string;
  acquisition_cost: number;
  salvage_value?: number | null;
  currency?: string | null;
  asset_number?: string | null;
  serial_number?: string | null;
  barcode_tag?: string | null;
  acquisition_date?: string | null;
  depreciation_method?: 'straight_line' | 'declining_balance' | 'double_declining_balance' | 'units_of_production' | null;
  useful_life_years?: number | null;
  condition?: 'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | null;
  description?: string | null;
}

export interface UpdateFixedAssetPayload extends Partial<StoreFixedAssetPayload> {
  status?: string | null;
}

export interface AssetBookResource {
  id: string;
  asset_id: string | null;
  ledger_type: string | null;
  depreciation_method: string | null;
  useful_life_months: number | null;
  rate_percent: string | null;
  cost: string | null;
  salvage_value: string | null;
  depreciable_base: string | null;
  accumulated_depreciation: string | null;
  net_book_value: string | null;
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
