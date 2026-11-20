/** Wire types of `/api/v1/forecasting` (Mod 094: AI cash flow and demand forecasting). */

export type PaymentRiskTier = 'low' | 'moderate' | 'high' | 'critical';

export type LiquidityHorizonDays = 91 | 365;

/** The three quantiles of an estimate: p10 pessimistic, p50 expected, p90 optimistic. */
export interface ConfidenceBand {
  p10: number;
  p50: number;
  p90: number;
}

export interface StatutoryEvent {
  date: string;
  nominal_date: string;
  /** F24, LIPE_Q1..Q4, IVA_ADVANCE, TAX_ADVANCE_JUN/NOV, MWST_Q1..Q4, AVS_LPP, AVS_LPP_RECONCILIATION, SALARY_13TH, SALARY_14TH */
  code: string;
  category: 'tax' | 'social_security' | 'payroll';
  amount: number;
}

export interface DailyProjection {
  date: string;
  inflows: ConfidenceBand;
  outflows: ConfidenceBand;
  statutory_outflows: StatutoryEvent[];
  statutory_total: number;
  financing_cost: ConfidenceBand;
  balance: ConfidenceBand;
}

export interface OverdueInvoiceDriver {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string | null;
  due_date: string;
  open_amount: number;
  days_overdue: number;
}

export interface CustomerDelayDriver {
  customer_id: string;
  customer_name: string | null;
  open_amount: number;
  predicted_delay_days: number;
  risk_tier: PaymentRiskTier;
  impact: number;
}

export interface KeyDrivers {
  overdue_invoices: OverdueInvoiceDriver[];
  statutory_liabilities: StatutoryEvent[];
  customer_delays: CustomerDelayDriver[];
}

export interface WhatIfParameters {
  global_customer_delay_shift_days: number;
  revenue_growth_percentage: number;
  supplier_payment_extension_days: number;
  interest_rate_delta: number;
}

export interface CashTrough {
  date: string;
  balance: number;
}

/** A liquidity run as the simulation endpoint returns it. */
export interface LiquidityRun {
  id: string;
  generated_at: string;
  horizon_days: number;
  currency: string;
  starting_cash_balance: number;
  trough: CashTrough | null;
  daily_projections: DailyProjection[];
  key_drivers: KeyDrivers;
  what_if_parameters: WhatIfParameters | null;
}

/** The chart series of a run (`GET /liquidity/confidence-bands`). */
export interface ConfidenceBands {
  run_id: string;
  generated_at: string;
  horizon_days: number;
  currency: string;
  starting_cash_balance: number;
  dates: string[];
  p10: number[];
  p50: number[];
  p90: number[];
  statutoryEvents: StatutoryEvent[];
  keyDrivers: KeyDrivers;
  whatIf: WhatIfParameters | null;
  trough: CashTrough | null;
}

export interface OpenInvoiceForecast {
  invoice_id: string;
  invoice_number: string | null;
  due_date: string;
  expected_collection_date: string;
  open_amount: number;
}

export interface PaymentBehavior {
  id: string;
  customer_id: string;
  customer_name: string | null;
  sample_size: number;
  average_days_late: number;
  std_dev_days_late: number;
  on_time_payment_probability: number;
  predicted_collection_date_offset_days: number;
  payment_risk_tier: PaymentRiskTier;
  last_trained_at: string | null;
  open_invoices: OpenInvoiceForecast[];
}

export interface TrainResult {
  models_trained: number;
  invoices_updated: number;
}

export interface MonthlySales {
  month: string;
  quantity: number;
}

/** One row of the replenishment grid. */
export interface SkuForecast {
  forecast_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string | null;
  period_start: string;
  period_end: string;
  predicted_demand_qty: number;
  confidence_lower_bound: number;
  confidence_upper_bound: number;
  current_stock: number;
  current_reorder_point: number | null;
  current_safety_stock: number | null;
  recommended_reorder_point: number;
  recommended_safety_stock: number;
  seasonality_index: number;
  supplier_lead_time_avg_days: number;
  supplier_lead_time_std_dev_days: number;
  model: string;
  applied_to_wms_at: string | null;
  history: MonthlySales[];
}

export interface AccuracyMetrics {
  mape: number;
  wape: number;
  sample_size: number;
}

export interface Accuracy {
  global: AccuracyMetrics;
  by_warehouse: (AccuracyMetrics & { warehouse_id: string; warehouse_name: string | null })[];
  by_sku: (AccuracyMetrics & { product_id: string; sku: string | null; name: string | null })[];
}

export interface AppliedReorderRule {
  forecast_id: string;
  product_id: string;
  warehouse_id: string;
  reorder_point: number;
  safety_stock: number;
  reorder_rule_id: string;
  planning_items_updated: number;
}

export interface DemandFilters {
  warehouse_id?: string;
  search?: string;
}
