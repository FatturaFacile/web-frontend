export interface SbcOption {
  code: string;
  label: string;
}

export interface SalesBoundedContextConfig {
  ui_copy: Record<string, string>;
  presets: Record<string, string>;
  hierarchy_roles: SbcOption[];
  insolvency_statuses: SbcOption[];
  lead_stages: SbcOption[];
  forecast_categories: SbcOption[];
  signature_standards: SbcOption[];
  subscription_actions: SbcOption[];
  commission_bases: SbcOption[];
  payment_providers: SbcOption[];
}

export interface SalesBoundedContextOverview {
  dossiers_count: number;
  leads_count: number;
  weighted_pipeline: number;
  signed_quotes_count: number;
  framework_agreements_count: number;
  guardrail_breaches_pending: number;
  active_mrr: number;
  ddt_and_invoices_count: number;
  commissions_payable: number;
  portal_settled_total: number;
}

export interface SbcCustomerDossier {
  id: string;
  customer_code: string;
  company_name: string;
  hierarchy_role: string;
  country: string;
  currency: string;
  uid_number: string | null;
  vat_number: string | null;
  fiscal_code: string | null;
  sdi_code: string | null;
  pec_email: string | null;
  qr_iban: string | null;
  credit_limit: string;
  current_exposure: string;
  overdue_balance: string;
  insolvency_status: string;
  risk_score: number;
}

export interface SbcOmnichannelLead {
  id: string;
  lead_code: string;
  source_channel: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  country: string;
  is_duplicate: boolean;
  total_score: number;
  lifecycle_stage: string;
  assigned_rep_name: string | null;
  assigned_territory: string | null;
}

export interface SbcOpportunityForecast {
  id: string;
  opportunity_code: string;
  title: string;
  kanban_stage: string;
  win_probability_pct: string;
  gross_amount: string;
  weighted_amount: string;
  currency: string;
  forecast_category: string;
  quota_attainment_pct: string;
  owner_name: string | null;
}

export interface SbcCpqQuote {
  id: string;
  quote_number: string;
  version_number: number;
  title: string;
  currency: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
  signature_standard: string;
  signature_status: string;
  status: string;
  converted_order_id: string | null;
}

export interface SbcFrameworkOrder {
  id: string;
  order_number: string;
  order_kind: 'framework_agreement' | 'sales_order';
  currency: string;
  ceiling_amount: string;
  remaining_ceiling: string;
  atp_qty: string;
  ctp_qty: string;
  requested_qty: string;
  shipped_qty: string;
  backorder_qty: string;
  total_amount: string;
  fulfillment_status: string;
}

export interface SbcPricingGuardrail {
  id: string;
  rule_code: string;
  name: string;
  currency: string;
  customer_segment: string;
  base_unit_price: string;
  resolved_net_price: string;
  calculated_margin_pct: string;
  min_margin_pct: string;
  guardrail_breached: boolean;
  approval_status: string;
}

export interface SbcRecurringSubscription {
  id: string;
  contract_code: string;
  plan_name: string;
  billing_cycle: string;
  currency: string;
  base_recurring_amount: string;
  pro_rata_adjustment_amount: string;
  indexation_type: string;
  revalued_amount: string;
  mrr_amount: string;
  arr_amount: string;
  lifecycle_status: string;
}

export interface SbcDdtInvoice {
  id: string;
  document_kind: string;
  document_number: string;
  sdi_doc_type: string | null;
  qr_bill_reference: string | null;
  is_drop_shipping: boolean;
  currency: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
  issue_date: string;
  status: string;
}

export interface SbcCommissionStatement {
  id: string;
  statement_number: string;
  agent_name: string;
  agent_jurisdiction: string;
  accrual_basis: string;
  period_label: string;
  currency: string;
  commissionable_base: string;
  gross_commission_amount: string;
  enasarco_company_amount: string;
  enasarco_agent_withholding: string;
  firr_accrual_amount: string;
  net_payable_amount: string;
  status: string;
}

export interface SbcPortalTransaction {
  id: string;
  transaction_code: string;
  transaction_type: string;
  payment_provider: string;
  amount: string;
  currency: string;
  open_balance_after: string;
  qr_bill_reference: string | null;
  payment_reference: string | null;
  support_subject: string | null;
  support_status: string | null;
}
