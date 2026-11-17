export type RecurringContractType =
  | 'maintenance'
  | 'rental'
  | 'software_license'
  | 'service_subscription';

export type RecurringContractStatus =
  | 'draft'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'cancelled';

export type BillingFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'
  | 'custom_days';

export type BillingTiming = 'in_advance' | 'in_arrears';

export type ProrationMode = 'none' | 'daily_exact' | 'thirty_day_month';

export type IndexType = 'none' | 'istat_foi' | 'swiss_ipc';

export interface RecurringContractLine {
  id?: string;
  product_id?: string | null;
  sort_order?: number;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  discount_percent: string | number;
  tax_rate: string | number;
  proration_mode: ProrationMode;
}

export interface ContractIndexationClause {
  id?: string;
  index_type: IndexType;
  base_index_value: string | number;
  base_index_period: string; // YYYY-MM
  adjustment_frequency_months: number;
  pass_through_percent: string | number;
  floor_percent?: string | number | null;
  cap_percent?: string | number | null;
  next_adjustment_date?: string | null;
  last_adjusted_at?: string | null;
  is_active?: boolean;
}

export interface ContractIndexationLog {
  id: string;
  recurring_contract_id: string;
  clause_id: string;
  period_from: string;
  period_to: string;
  old_index_value: string;
  new_index_value: string;
  raw_delta_percent: string;
  applied_delta_percent: string;
  old_recurring_total: string;
  new_recurring_total: string;
  applied_at: string;
  applied_by_user_id?: string | null;
}

export interface RecurringContract {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer?: {
    id: string;
    company_name: string;
    email?: string;
    vat_number?: string;
    country?: string;
  };
  contract_number: string;
  title: string;
  contract_type: RecurringContractType;
  status: RecurringContractStatus;
  start_date: string;
  end_date?: string | null;
  billing_frequency: BillingFrequency;
  custom_interval_days?: number | null;
  billing_timing: BillingTiming;
  next_billing_date: string;
  last_billed_date?: string | null;
  auto_renew: boolean;
  renewal_period_months?: number | null;
  notice_period_days: number;
  currency: 'CHF' | 'EUR';
  payment_term_id?: string | null;
  payment_method?: string | null;
  invoice_auto_issue: boolean;
  notes?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  subtotal: string;
  total: string;
  lines?: RecurringContractLine[];
  indexation_clause?: ContractIndexationClause | null;
  indexation_logs?: ContractIndexationLog[];
  created_at?: string;
}

export interface PriceIndexRate {
  id?: string;
  tenant_id?: string | null;
  index_type: 'istat_foi' | 'swiss_ipc';
  period: string; // YYYY-MM
  index_value: string | number;
  published_at?: string | null;
  source_reference?: string | null;
  created_at?: string;
}

export interface RecurringBillingRunItem {
  id: string;
  run_id: string;
  recurring_contract_id: string;
  contract_number?: string;
  customer_name?: string;
  billing_period_start: string;
  billing_period_end: string;
  idempotency_key: string;
  invoice_id?: string | null;
  invoice_number?: string | null;
  invoice_total?: string | null;
  status: 'success' | 'skipped' | 'failed';
  error_message?: string | null;
  created_at?: string;
}

export interface RecurringBillingRun {
  id: string;
  tenant_id: string;
  run_type: 'scheduled' | 'manual';
  target_date: string;
  status: 'running' | 'completed' | 'partial_failure' | 'failed';
  contracts_processed: number;
  invoices_generated: number;
  total_amount: string;
  started_at?: string | null;
  finished_at?: string | null;
  items?: RecurringBillingRunItem[];
  created_at?: string;
}

export interface BillingPreviewItem {
  contract_id: string;
  contract_number: string;
  customer_name: string;
  currency: string;
  period_start: string;
  period_end: string;
  next_billing_date: string;
  subtotal: string;
  tax: string;
  total: string;
  idempotency_key: string;
  is_already_billed: boolean;
}

export interface RecurringContractsMetrics {
  active_contracts_count: number;
  mrr: string;
  arr: string;
  expiring_within_30_days_count: number;
  due_for_billing_count: number;
}
