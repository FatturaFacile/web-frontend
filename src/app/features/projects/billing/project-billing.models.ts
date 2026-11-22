/** Wire types of the project billing endpoints of the projects API (Mod 081: T&M, milestones, retainer, SAL, WIP). */

export type BillingModel =
  'time_and_materials' | 'fixed_milestone' | 'prepaid_retainer' | 'sal_progress' | 'hybrid';

export type ContractStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'closed';

export type FiscalJurisdiction = 'IT' | 'CH';

export type RetentionReleaseRule =
  'manual' | 'on_acceptance' | 'on_warranty_expiry' | 'on_milestone';

export type SalStatus = 'draft' | 'pending_approval' | 'approved' | 'invoiced' | 'cancelled';

export type WipMethod =
  'cost_to_cost_percentage_of_completion' | 'completed_contract' | 'milestone_progress';

export interface Envelope<T> {
  data: T;
  message?: string;
}

export interface BillingContract {
  id: string;
  project_id: string;
  customer_id: string;
  billing_model: BillingModel;
  fiscal_jurisdiction: FiscalJurisdiction;
  currency_code: string;
  contract_total_value: string;
  advance_payment_percent: string;
  advance_payment_amount: string;
  advance_recouped_amount: string;
  retention_guarantee_percent: string;
  retention_release_rule: RetentionReleaseRule;
  retention_release_date: string | null;
  cap_amount: string | null;
  markup_percent: string;
  rate_card_id: string | null;
  prepaid_hours_allowance: string;
  prepaid_amount_allowance: string;
  low_balance_alert_threshold_percent: string;
  low_balance_alerted_at: string | null;
  cig: string | null;
  cup: string | null;
  contract_reference: string | null;
  contract_date: string | null;
  billing_status: ContractStatus;
  version: number;
}

/** Fields of the contract form; the API fills the rest. `expected_version` is the concurrency token of an update. */
export interface BillingContractPayload {
  billing_model: BillingModel;
  fiscal_jurisdiction?: FiscalJurisdiction | null;
  currency_code?: string | null;
  contract_total_value?: number | null;
  advance_payment_percent?: number | null;
  advance_payment_amount?: number | null;
  retention_guarantee_percent?: number | null;
  retention_release_rule?: RetentionReleaseRule | null;
  retention_release_date?: string | null;
  cap_amount?: number | null;
  markup_percent?: number | null;
  prepaid_hours_allowance?: number | null;
  prepaid_amount_allowance?: number | null;
  low_balance_alert_threshold_percent?: number | null;
  cig?: string | null;
  cup?: string | null;
  contract_reference?: string | null;
  contract_date?: string | null;
  expected_version?: number | null;
}

export interface SalCertificate {
  id: string;
  project_id: string;
  billing_contract_id: string;
  sal_number: number;
  period_start_date: string;
  period_end_date: string;
  previous_completion_percent: string;
  cumulative_completion_percent: string;
  cumulative_gross_earned_value: string;
  previous_sal_cumulative_billed: string;
  current_period_gross_sal: string;
  advance_deduction_amount: string;
  guarantee_retention_withheld: string;
  invoice_amount: string;
  net_billable_amount: string;
  is_final: boolean;
  status: SalStatus;
  customer_approved_at: string | null;
  customer_approved_by: string | null;
  sales_invoice_id: string | null;
  notes: string | null;
}

export interface SalPayload {
  period_start_date: string;
  period_end_date: string;
  cumulative_completion_percent: number;
  notes?: string | null;
}

export interface RetentionBalance {
  withheld: string;
  released: string;
  balance: string;
  release_rule: RetentionReleaseRule;
  release_date: string | null;
}

export interface RetentionReleasePayload {
  amount?: number | null;
  release_date?: string | null;
  acceptance_confirmed?: boolean;
  milestone_id?: string | null;
  reason?: string | null;
}

export interface RetainerBalance {
  unit: 'hours' | 'amount';
  allowance_hours: string;
  allowance_amount: string;
  topped_up_hours: string;
  topped_up_amount: string;
  consumed_hours: string;
  consumed_amount: string;
  remaining_hours: string;
  remaining_amount: string;
  remaining_percent: string;
  low_balance_threshold_percent: string;
  is_low_balance: boolean;
}

export interface RetainerEntry {
  id: string;
  entry_type: 'top_up' | 'consumption';
  source_type: string | null;
  source_id: string | null;
  entry_date: string;
  hours: string;
  amount: string;
  balance_hours_after: string;
  balance_amount_after: string;
  note: string | null;
}

export interface RetainerState {
  balance: RetainerBalance;
  entries: RetainerEntry[];
}

export interface RetainerTopUpPayload {
  hours?: number | null;
  amount?: number | null;
  date?: string | null;
  note?: string | null;
}

export interface TimeAndMaterialsLine {
  kind: 'hours' | 'cost';
  description: string;
  quantity: string;
  unit_price: string;
  uom: string | null;
  hours: string;
  gross: string;
  cost: string;
  amount: string;
}

export interface TimeAndMaterialsPreview {
  lines: TimeAndMaterialsLine[];
  hours_total: string;
  labour_total: string;
  costs_total: string;
  markup_total: string;
  billable_total: string;
  capped_out: string;
  retainer_covered_hours: string;
}

export interface UnbilledSummary {
  project_id: string;
  currency: string;
  billing_model: BillingModel | null;
  contract_value: string;
  billed_to_date: string;
  draft_billing: string;
  unbilled_time_and_materials: string;
  unbilled_milestones: number;
  open_sal_certificates: number;
  open_sal_invoice_amount: string;
  retention: RetentionBalance | null;
  latest_wip_run: {
    period_end_date: string;
    recognized_revenue_to_date: string;
    billed_to_date: string;
    wip_asset_or_deferred_revenue_diff: string;
    nature: 'contract_asset' | 'contract_liability';
  } | null;
}

export interface InvoiceDraft {
  id: string;
  invoice_number: string;
  status: string;
  project_id: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
}

export interface WipRun {
  id: string;
  project_id: string;
  revenue_recognition_id: string | null;
  period_end_date: string;
  valuation_method: WipMethod;
  accounting_standard: string;
  cumulative_actual_cost_to_date: string;
  estimated_total_cost_at_completion: string;
  completion_ratio: string;
  recognized_revenue_to_date: string;
  billed_to_date: string;
  wip_asset_or_deferred_revenue_diff: string;
  expected_loss_provision: string;
  gl_journal_entry_id: string | null;
  status: 'draft' | 'posted' | 'reversed';
  replayed?: boolean;
}

export interface WipRunResult {
  runs: WipRun[];
  skipped: { project_id: string; reason: string }[];
}

export interface WipRunPayload {
  project_id?: string | null;
  period_end_date: string;
  valuation_method?: WipMethod | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}
