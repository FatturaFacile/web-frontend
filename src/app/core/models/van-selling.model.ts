export interface VanSellingOption {
  code: string;
  label: string;
}

export interface VanSellingEmptiesCatalogItem {
  item_code: string;
  item_name: string;
  unit_deposit: number;
}

export interface VanSellingConfig {
  ui_copy: Record<string, string>;
  regulatory: Record<string, string>;
  van_statuses: VanSellingOption[];
  manifest_statuses: VanSellingOption[];
  visit_modes: VanSellingOption[];
  visit_outcomes: VanSellingOption[];
  settlement_statuses: VanSellingOption[];
  document_types: VanSellingOption[];
  payment_methods: VanSellingOption[];
  printer_profiles: VanSellingOption[];
  no_sale_reasons: VanSellingOption[];
  empties_catalog: VanSellingEmptiesCatalogItem[];
  sample_gs1_barcodes: string[];
}

export interface VanStockSnapshotLine {
  product_id: string;
  sku: string;
  description: string;
  lot_number?: string | null;
  expiry_date?: string | null;
  unit_measure: string;
  is_variable_weight?: boolean;
  unit_price: number;
  quantity_onboard: number;
}

export interface VanEmptiesSnapshotLine {
  item_code: string;
  item_name: string;
  quantity_onboard: number;
}

export interface VanTemperatureLogEntry {
  recorded_at: string;
  temp_celsius: number;
  notes?: string | null;
  source?: string;
}

export interface VanWarehouse {
  id: string;
  code: string;
  name: string;
  license_plate: string;
  vehicle_make_model: string | null;
  warehouse_id: string | null;
  depot_warehouse_id: string | null;
  driver_user_id: string | null;
  driver_name: string | null;
  has_cold_chain: boolean;
  min_temp_celsius: string | null;
  max_temp_celsius: string | null;
  current_temp_celsius: string | null;
  last_temp_recorded_at: string | null;
  temp_alert_active: boolean;
  invoice_sectional_code: string;
  invoice_next_number: number;
  ddt_sectional_code: string;
  ddt_next_number: number;
  receipt_sectional_code: string;
  receipt_next_number: number;
  fiscal_year: number;
  printer_profile: 'escpos_80mm' | 'zpl_104mm';
  printer_brand: string;
  printer_mac_address: string | null;
  status: string;
  current_stock_snapshot: VanStockSnapshotLine[];
  empties_onboard_snapshot: VanEmptiesSnapshotLine[];
  temperature_log: VanTemperatureLogEntry[];
  sync_version: number;
  last_synced_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface VanWarehouseCreatePayload {
  code: string;
  name: string;
  license_plate: string;
  vehicle_make_model?: string | null;
  driver_name?: string | null;
  has_cold_chain?: boolean;
  min_temp_celsius?: number | null;
  max_temp_celsius?: number | null;
  current_temp_celsius?: number | null;
  invoice_sectional_code?: string | null;
  ddt_sectional_code?: string | null;
  receipt_sectional_code?: string | null;
  printer_profile?: 'escpos_80mm' | 'zpl_104mm';
  printer_brand?: string;
}

export interface VanSectionalBatchReservation {
  sectional_code: string;
  fiscal_year: number;
  range_start: number;
  range_end: number;
  reserved_numbers: string[];
}

export interface ReplenishmentSuggestion {
  product_id: string;
  sku: string;
  name: string;
  unit_measure: string;
  historical_weekday_avg_qty: number;
  current_onboard_qty: number;
  suggested_load_qty: number;
  unit_price: number;
  basis: string;
}

export interface VanLoadManifestLine {
  product_id: string;
  sku?: string;
  description?: string;
  unit_measure?: string;
  quantity: number;
  lot_number?: string | null;
  expiry_date?: string | null;
  is_variable_weight?: boolean;
  unit_price?: number;
  line_value?: number;
}

export interface VanLoadManifest {
  id: string;
  van_warehouse_id: string;
  van_license_plate?: string | null;
  van_name?: string | null;
  manifest_number: string;
  load_date: string;
  weekday_iso: number;
  route_code: string | null;
  global_ddt_id: string | null;
  global_ddt_number: string | null;
  global_ddt_causal: string;
  regulatory_reference: string;
  self_addressed_company_name: string | null;
  departure_temp_celsius: string | null;
  cold_chain_compliant: boolean;
  status: string;
  lines: VanLoadManifestLine[];
  replenishment_suggestions: ReplenishmentSuggestion[];
  total_packages: number;
  total_gross_weight_kg: string;
  total_net_value: string;
  currency: string;
  dispatched_at: string | null;
}

export interface FieldRouteStop {
  sequence: number;
  contact_id: string;
  customer_name?: string;
  address?: string;
  visit_mode?: string;
}

export interface FieldRoutePlan {
  id: string;
  van_warehouse_id: string;
  van_license_plate?: string | null;
  van_load_manifest_id: string | null;
  route_code: string;
  name: string;
  plan_date: string;
  weekday_iso: number;
  is_recurring: boolean;
  salesperson_name: string | null;
  territory_zone: string | null;
  country: string;
  status: string;
  stops: FieldRouteStop[];
  total_stops: number;
  completed_stops: number;
  sync_version: number;
}

export interface OverdueInvoiceSummary {
  invoice_id: string;
  invoice_number: string;
  date: string | null;
  due_date: string | null;
  total_gross: number;
  total_paid: number;
  remaining_due: number;
  currency: string;
}

export interface CustomerFastReorderItem {
  product_id: string;
  sku: string;
  description: string;
  unit_measure: string;
  suggested_quantity: number;
  last_unit_price: number;
  tax_rate: number;
  purchase_frequency_last_5: number;
}

export interface CustomerFieldDossier {
  contact: {
    id: string;
    name: string;
    country: string;
    vat_number: string | null;
    uid_number: string | null;
    sdi_code: string | null;
  };
  credit: {
    credit_limit: number;
    open_exposure: number;
    overdue_amount: number;
    overdue_invoices: OverdueInvoiceSummary[];
    is_blocked: boolean;
    block_reason: string | null;
    can_unblock_by_collection: boolean;
  };
  fast_reorder_last_5: CustomerFastReorderItem[];
}

export interface Gs1ParseResult {
  raw_barcode: string;
  format: string;
  gtin: string | null;
  sku_candidate: string | null;
  net_weight_kg: number | null;
  variable_price_amount: number | null;
  lot_number: string | null;
  expiry_date: string | null;
  matched_product_id: string | null;
  matched_product_sku: string | null;
  matched_product_name: string | null;
  unit_price: number | null;
  computed_line_total: number | null;
}

export interface VanVisitSaleLinePayload {
  product_id: string;
  sku?: string;
  description?: string;
  unit_measure?: string;
  quantity: number;
  unit_price?: number;
  tax_rate?: number;
  lot_number?: string | null;
  expiry_date?: string | null;
  gs1_barcode?: string | null;
  is_variable_weight?: boolean;
  is_freebie?: boolean;
  line_total?: number;
}

export interface VanVisitEmptiesPayload {
  item_code: string;
  item_name: string;
  delivered_qty: number;
  returned_qty: number;
  unit_deposit: number;
}

export interface VanVisitOutcomeCreatePayload {
  field_route_plan_id: string;
  van_load_manifest_id?: string | null;
  contact_id: string;
  stop_sequence?: number;
  visit_mode: 'van_selling' | 'field_presale';
  outcome_status: 'completed_sale' | 'presale_order' | 'no_sale' | 'rescheduled' | 'credit_blocked';
  no_sale_reason_code?: string | null;
  document_type?: 'immediate_invoice' | 'delivery_note_ddt' | 'commercial_receipt_rt' | 'sales_order';
  offline_document_number?: string | null;
  sale_lines?: VanVisitSaleLinePayload[];
  empties_movements?: VanVisitEmptiesPayload[];
  collections?: { method: string; amount: number }[];
  collected_amount?: number;
  payment_method?: string;
  printer_format?: 'escpos_80mm' | 'zpl_104mm';
  client_idempotency_key?: string;
  offline_created_at?: string | null;
}

export interface VanVisitOutcome {
  id: string;
  field_route_plan_id: string;
  van_warehouse_id: string;
  van_license_plate?: string | null;
  contact_id: string;
  customer_name?: string | null;
  stop_sequence: number;
  visit_mode: string;
  outcome_status: string;
  no_sale_reason_code: string | null;
  document_type: string | null;
  fiscal_sectional_code: string | null;
  definitive_document_number: string | null;
  sdi_transmission_status: string;
  qr_bill_generated: boolean;
  qr_bill_reference: string | null;
  credit_check_passed: boolean;
  credit_limit_amount: string;
  exposure_before_visit: string;
  overdue_amount_before_visit: string;
  sale_lines: VanVisitSaleLinePayload[];
  empties_movements: VanVisitEmptiesPayload[];
  total_net: string;
  total_tax: string;
  total_gross: string;
  empties_net_deposit_amount: string;
  total_collected_amount: string;
  payment_method: string | null;
  currency: string;
  printer_format: 'escpos_80mm' | 'zpl_104mm';
  client_idempotency_key: string | null;
  synced_at: string | null;
  visited_at: string;
}

export interface ThermalPrintJob {
  profile: string;
  printer_brand: string;
  paper_width_mm: string;
  document_number: string;
  escpos_commands: string;
  zpl_commands: string;
  human_preview: string;
}

export interface OfflineSyncBatchResult {
  van_warehouse_id: string;
  server_sync_version: number;
  version_drift_detected: boolean;
  encryption_algorithm: string;
  synced_at: string;
  processed_count: number;
  conflict_count: number;
  processed_visits: {
    visit_id: string;
    client_idempotency_key: string | null;
    outcome_status: string;
    definitive_document_number: string | null;
    sdi_transmission_status: string;
    qr_bill_reference: string | null;
  }[];
  conflicts: { client_idempotency_key: string | null; error_key: string; message: string }[];
}

export interface EodStockReconciliationLine {
  product_id: string;
  sku: string;
  description: string;
  lot_number: string | null;
  unit_measure: string;
  loaded_qty: number;
  sold_qty: number;
  freebies_qty: number;
  returned_damaged_qty: number;
  remaining_qty: number;
  keep_onboard_qty: number;
  unload_central_qty: number;
}

export interface VanEodSettlementPreview {
  van_warehouse_id: string;
  van_license_plate: string;
  van_load_manifest_id: string | null;
  settlement_date: string;
  stock_reconciliation_lines: EodStockReconciliationLine[];
  empties_reconciliation: {
    item_code: string;
    item_name: string;
    delivered_qty: number;
    returned_qty: number;
  }[];
  cold_chain_summary: {
    has_cold_chain: boolean;
    readings_count: number;
    min_recorded_celsius: number | string | null;
    max_recorded_celsius: number | string | null;
    alert_triggered: boolean;
  };
  collections_summary: {
    collected_cash_amount: number;
    collected_pos_card_amount: number;
    collected_twint_amount: number;
    collected_cheque_amount: number;
    collected_bank_transfer_amount: number;
  };
}

export interface VanEodSettlement {
  id: string;
  van_warehouse_id: string;
  van_license_plate?: string | null;
  settlement_number: string;
  settlement_date: string;
  status: string;
  stock_reconciliation_lines: EodStockReconciliationLine[];
  total_loaded_qty: string;
  total_sold_qty: string;
  total_remaining_qty: string;
  total_keep_onboard_qty: string;
  total_unload_central_qty: string;
  opening_cash_float: string;
  collected_cash_amount: string;
  collected_pos_card_amount: string;
  collected_twint_amount: string;
  collected_cheque_amount: string;
  expected_cash_remittance: string;
  counted_cash_remittance: string;
  cash_discrepancy_amount: string;
  total_remittance_amount: string;
  deposit_slip_number: string | null;
  treasury_deposited: boolean;
  central_warehouse_unloaded: boolean;
  currency: string;
  reconciled_at: string | null;
}

export interface VanSellingResponse<T> {
  data: T;
}
