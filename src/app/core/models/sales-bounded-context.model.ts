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
  rfm_segments: SbcOption[];
  tender_frameworks: SbcOption[];
  b_stock_grades: SbcOption[];
  nps_categories: SbcOption[];
  welfare_regimes: SbcOption[];
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
  campaigns_attributed_revenue: number;
  tenders_pipeline_value: number;
  cpq_configurations_count: number;
  gdo_rebates_accrued: number;
  reverse_returns_count: number;
  van_routes_reconciled_count: number;
  franchising_royalties_total: number;
  detractor_alerts_open: number;
  welfare_employer_quota_total: number;
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

export interface SbcMarketingCampaign {
  id: string;
  campaign_code: string;
  name: string;
  channel: string;
  rfm_segment: string;
  exclude_insolvent_overdue: boolean;
  excluded_insolvent_count: number;
  eligible_recipients_count: number;
  attributed_revenue: string;
  roi_pct: string;
  currency: string;
  status: string;
}

export interface SbcPublicPrivateTender {
  id: string;
  tender_code: string;
  title: string;
  procurement_framework: string;
  contracting_authority: string;
  cig_code: string | null;
  cup_code: string | null;
  total_award_score: string;
  bid_amount: string;
  currency: string;
  pipeline_stage: string;
  converted_order_id: string | null;
}

export interface SbcCpqConfiguration {
  id: string;
  configuration_code: string;
  product_family: string;
  has_constraint_conflict: boolean;
  total_bom_cost: string;
  net_configured_price: string;
  calculated_margin_pct: string;
  currency: string;
  status: string;
}

export interface SbcGdoRebateAgreement {
  id: string;
  agreement_code: string;
  gdo_chain_name: string;
  contract_year: number;
  currency: string;
  sell_in_volume_amount: string;
  resolved_tier_rate_pct: string;
  annual_pfa_rebate_amount: string;
  monthly_accrual_rateo: string;
  total_provisioned_accrual: string;
  settlement_status: string;
  settlement_credit_note_id: string | null;
}

export interface SbcReverseLogisticsReturn {
  id: string;
  rma_number: string;
  return_reason: string;
  is_advance_cross_shipping: boolean;
  replacement_shipment_ref: string | null;
  b_stock_grade: string;
  inventory_disposition: string;
  art26_dpr633_72_vat_recoverable: boolean;
  credit_note_gross_amount: string;
  currency: string;
  status: string;
}

export interface SbcVanSellingRoute {
  id: string;
  route_code: string;
  driver_agent_name: string;
  vehicle_plate: string;
  document_series_sezionale: string;
  sold_stock_qty: string;
  returned_unsold_qty: string;
  stock_variance_qty: string;
  collected_cash_amount: string;
  electronic_payment_amount: string;
  currency: string;
  reconciliation_status: string;
}

export interface SbcFranchisingAffiliate {
  id: string;
  affiliate_code: string;
  franchisor_brand: string;
  store_name: string;
  country: string;
  currency: string;
  sell_out_turnover: string;
  total_fee_invoiceable: string;
  pushed_price_list_version: string;
  benchmark_index_pct: string;
  status: string;
}

export interface SbcPostDeliverySurvey {
  id: string;
  survey_code: string;
  trigger_event: string;
  nps_score: number;
  csat_score: number;
  ces_score: number;
  nps_classification: string;
  detractor_recovery_alert_triggered: boolean;
  iso9001_clause_ref: string;
  iso9001_satisfaction_index: string;
}

export interface SbcCorporateWelfareConvention {
  id: string;
  convention_code: string;
  partner_company_name: string;
  employee_email: string;
  cral_badge_number: string;
  welfare_regime: string;
  discounted_net_amount: string;
  employer_welfare_quota_amount: string;
  employee_copay_quota_amount: string;
  within_statutory_exemption: boolean;
  currency: string;
  status: string;
}
