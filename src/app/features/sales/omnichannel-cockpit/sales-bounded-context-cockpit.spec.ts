import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import {
  SalesBoundedContextApiService,
  SalesBoundedContextConfig,
  SalesBoundedContextOverview,
  SbcCommissionStatement,
  SbcCorporateWelfareConvention,
  SbcCpqConfiguration,
  SbcCpqQuote,
  SbcCustomerDossier,
  SbcDdtInvoice,
  SbcFrameworkOrder,
  SbcFranchisingAffiliate,
  SbcGdoRebateAgreement,
  SbcMarketingCampaign,
  SbcOmnichannelLead,
  SbcOpportunityForecast,
  SbcPortalTransaction,
  SbcPostDeliverySurvey,
  SbcPricingGuardrail,
  SbcPublicPrivateTender,
  SbcRecurringSubscription,
  SbcReverseLogisticsReturn,
  SbcVanSellingRoute,
} from '@core';
import { SalesBoundedContextCockpitComponent } from './sales-bounded-context-cockpit.component';

const sampleConfig: SalesBoundedContextConfig = {
  ui_copy: {
    page_title: 'CRM, Omnichannel Sales & Invoicing (SD#139)',
    page_subtitle: 'End-to-end IT/CH pipeline',
    tab_mod033: 'Mod 033',
    tab_mod034: 'Mod 034',
    tab_mod035: 'Mod 035',
    tab_mod036: 'Mod 036',
    tab_mod037: 'Mod 037',
    tab_mod038: 'Mod 038',
    tab_mod039: 'Mod 039',
    tab_mod040: 'Mod 040',
    tab_mod041: 'Mod 041',
    tab_mod042: 'Mod 042',
    create_dossier: 'New Dossier',
    capture_lead: 'Capture Lead',
    save_opportunity: 'Save Opportunity',
    create_quote: 'Create Quote',
    sign_quote: 'Sign',
    convert_order: 'Convert',
    create_order: 'Create Order',
    evaluate_pricing: 'Evaluate Pricing',
    approve_override: 'Approve Override',
    create_subscription: 'Create Subscription',
    revalue_index: 'Revalue Index',
    issue_document: 'Issue Document',
    calculate_commission: 'Calculate Commission',
    execute_portal_payment: 'Pay Portal',
    tab_mod155: 'Mod 155',
    tab_mod169: 'Mod 169',
    tab_mod230: 'Mod 230',
    tab_mod231: 'Mod 231',
    tab_mod232: 'Mod 232',
    tab_mod233: 'Mod 233',
    tab_mod244: 'Mod 244',
    tab_mod245: 'Mod 245',
    tab_mod358: 'Mod 358',
    execute_campaign: 'Execute Campaign',
    submit_tender: 'Submit Tender',
    convert_tender: 'Convert Tender',
    configure_cpq_bom: 'Configure CPQ',
    calculate_gdo_rebate: 'Calculate Rebate',
    settle_rebate_credit_note: 'Settle Credit Note',
    process_reverse_return: 'Process Return',
    reconcile_van_route: 'Reconcile Van',
    calculate_franchising_royalty: 'Calculate Royalty',
    record_survey: 'Record Survey',
    process_welfare_split: 'Process Welfare',
  },
  presets: { ch_uid_example: 'CHE-116.281.710' },
  hierarchy_roles: [{ code: 'holding', label: 'Holding' }],
  insolvency_statuses: [{ code: 'performing', label: 'Performing' }],
  lead_stages: [{ code: 'sql', label: 'SQL' }],
  forecast_categories: [{ code: 'commit', label: 'Commit' }],
  signature_standards: [{ code: 'zertes_qes', label: 'ZertES' }],
  subscription_actions: [{ code: 'revalue_index', label: 'Revalue' }],
  commission_bases: [{ code: 'collected', label: 'Collected' }],
  payment_providers: [{ code: 'twint', label: 'TWINT' }],
  rfm_segments: [{ code: 'champions', label: 'Champions' }],
  tender_frameworks: [{ code: 'simap_ch_lapub', label: 'simap.ch' }],
  b_stock_grades: [{ code: 'grade_b_refurbished', label: 'Grade B' }],
  nps_categories: [{ code: 'promoter', label: 'Promoter' }],
  welfare_regimes: [{ code: 'it_art51_tuir', label: 'Art. 51 TUIR' }],
};

const sampleOverview: SalesBoundedContextOverview = {
  dossiers_count: 2,
  leads_count: 1,
  weighted_pipeline: 90000,
  signed_quotes_count: 1,
  framework_agreements_count: 1,
  guardrail_breaches_pending: 1,
  active_mrr: 2433.6,
  ddt_and_invoices_count: 1,
  commissions_payable: 5490,
  portal_settled_total: 2433.6,
  campaigns_attributed_revenue: 28400,
  tenders_pipeline_value: 320000,
  cpq_configurations_count: 1,
  gdo_rebates_accrued: 15491.63,
  reverse_returns_count: 1,
  van_routes_reconciled_count: 1,
  franchising_royalties_total: 9800,
  detractor_alerts_open: 0,
  welfare_employer_quota_total: 270,
};

const sampleDossier: SbcCustomerDossier = {
  id: 'dos-1',
  customer_code: 'CUST-CH-001',
  company_name: 'Helvetia AG',
  hierarchy_role: 'holding',
  country: 'CH',
  currency: 'CHF',
  uid_number: 'CHE-116.281.710',
  vat_number: null,
  fiscal_code: null,
  sdi_code: null,
  pec_email: null,
  qr_iban: 'CH4431999123000889012',
  credit_limit: '150000.00',
  current_exposure: '42500.00',
  overdue_balance: '0.00',
  insolvency_status: 'performing',
  risk_score: 12,
};

const sampleLead: SbcOmnichannelLead = {
  id: 'lead-1',
  lead_code: 'LEAD-01',
  source_channel: 'quote_request',
  full_name: 'Luca Bernasconi',
  company_name: 'Ticino SA',
  email: 'luca@ticino.ch',
  country: 'CH',
  is_duplicate: false,
  total_score: 90,
  lifecycle_stage: 'sql',
  assigned_rep_name: 'Lukas Meier',
  assigned_territory: 'CH-TI-ZURICH',
};

const sampleOpportunity: SbcOpportunityForecast = {
  id: 'opp-1',
  opportunity_code: 'OPP-01',
  title: 'Rollout',
  kanban_stage: 'negotiation',
  win_probability_pct: '75.00',
  gross_amount: '120000.00',
  weighted_amount: '90000.00',
  currency: 'CHF',
  forecast_category: 'commit',
  quota_attainment_pct: '36.00',
  owner_name: 'Lukas Meier',
};

const sampleQuote: SbcCpqQuote = {
  id: 'quo-1',
  quote_number: 'CPQ-01',
  version_number: 1,
  title: 'Bundle',
  currency: 'CHF',
  total_net: '25000.00',
  total_tax: '2025.00',
  total_gross: '27025.00',
  signature_standard: 'zertes_qes',
  signature_status: 'pending',
  status: 'issued',
  converted_order_id: null,
};

const sampleOrder: SbcFrameworkOrder = {
  id: 'ord-1',
  order_number: 'SO-01',
  order_kind: 'sales_order',
  currency: 'CHF',
  ceiling_amount: '0.00',
  remaining_ceiling: '0.00',
  atp_qty: '10.000',
  ctp_qty: '5.000',
  requested_qty: '12.000',
  shipped_qty: '10.000',
  backorder_qty: '2.000',
  total_amount: '12000.00',
  fulfillment_status: 'partial_shipped',
};

const samplePricing: SbcPricingGuardrail = {
  id: 'prc-1',
  rule_code: 'PRC-01',
  name: 'Tiered Promo',
  currency: 'CHF',
  customer_segment: 'enterprise',
  base_unit_price: '100.0000',
  resolved_net_price: '81.0000',
  calculated_margin_pct: '7.41',
  min_margin_pct: '15.00',
  guardrail_breached: true,
  approval_status: 'pending_manager_approval',
};

const sampleSub: SbcRecurringSubscription = {
  id: 'sub-1',
  contract_code: 'SUB-01',
  plan_name: 'Cloud',
  billing_cycle: 'monthly',
  currency: 'CHF',
  base_recurring_amount: '1500.00',
  pro_rata_adjustment_amount: '750.00',
  indexation_type: 'SWISS_LIK',
  revalued_amount: '1500.00',
  mrr_amount: '1500.00',
  arr_amount: '18000.00',
  lifecycle_status: 'active',
};

const sampleDdt: SbcDdtInvoice = {
  id: 'ddt-1',
  document_kind: 'deferred_summary_invoice',
  document_number: 'FD-TD24-01',
  sdi_doc_type: 'TD24',
  qr_bill_reference: null,
  is_drop_shipping: false,
  currency: 'EUR',
  total_net: '5000.00',
  total_tax: '1100.00',
  total_gross: '6100.00',
  issue_date: '2026-11-25',
  status: 'issued',
};

const sampleCommission: SbcCommissionStatement = {
  id: 'com-1',
  statement_number: 'EC-01',
  agent_name: 'Marco Rossi',
  agent_jurisdiction: 'IT',
  accrual_basis: 'collected',
  period_label: '2026-11',
  currency: 'EUR',
  commissionable_base: '50000.00',
  gross_commission_amount: '2500.00',
  enasarco_company_amount: '212.50',
  enasarco_agent_withholding: '212.50',
  firr_accrual_amount: '100.00',
  net_payable_amount: '2287.50',
  status: 'calculated',
};

const samplePortal: SbcPortalTransaction = {
  id: 'prt-1',
  transaction_code: 'PRT-01',
  transaction_type: 'online_payment',
  payment_provider: 'twint',
  amount: '1200.00',
  currency: 'CHF',
  open_balance_after: '0.00',
  qr_bill_reference: null,
  payment_reference: 'TWINT-001',
  support_subject: null,
  support_status: null,
};

const sampleCampaign: SbcMarketingCampaign = {
  id: 'mkt-1',
  campaign_code: 'MKT-01',
  name: 'Q4 DEM',
  channel: 'dem_email',
  rfm_segment: 'champions',
  exclude_insolvent_overdue: true,
  excluded_insolvent_count: 1,
  eligible_recipients_count: 94,
  attributed_revenue: '11000.00',
  roi_pct: '1000.00',
  currency: 'CHF',
  status: 'active',
};

const sampleTender: SbcPublicPrivateTender = {
  id: 'tnd-1',
  tender_code: 'TND-01',
  title: 'Ticino Lot 1',
  procurement_framework: 'simap_ch_lapub',
  contracting_authority: 'Cantone Ticino',
  cig_code: null,
  cup_code: null,
  total_award_score: '91.50',
  bid_amount: '240000.00',
  currency: 'CHF',
  pipeline_stage: 'awarded',
  converted_order_id: null,
};

const sampleCpqConfig: SbcCpqConfiguration = {
  id: 'cfg-1',
  configuration_code: 'CFG-01',
  product_family: 'CNC Cell',
  has_constraint_conflict: false,
  total_bom_cost: '7000.00',
  net_configured_price: '10735.00',
  calculated_margin_pct: '34.79',
  currency: 'CHF',
  status: 'validated',
};

const sampleGdoRebate: SbcGdoRebateAgreement = {
  id: 'gdo-1',
  agreement_code: 'GDO-01',
  gdo_chain_name: 'Coop',
  contract_year: 2026,
  currency: 'EUR',
  sell_in_volume_amount: '300000.00',
  resolved_tier_rate_pct: '4.00',
  annual_pfa_rebate_amount: '15000.00',
  monthly_accrual_rateo: '1250.00',
  total_provisioned_accrual: '15000.00',
  settlement_status: 'ready_for_settlement',
  settlement_credit_note_id: null,
};

const sampleReturn: SbcReverseLogisticsReturn = {
  id: 'rma-1',
  rma_number: 'RMA-01',
  return_reason: 'Transit damage',
  is_advance_cross_shipping: true,
  replacement_shipment_ref: 'XSHIP-01',
  b_stock_grade: 'grade_b_refurbished',
  inventory_disposition: 'b_stock_outlet',
  art26_dpr633_72_vat_recoverable: true,
  credit_note_gross_amount: '1220.00',
  currency: 'EUR',
  status: 'credit_note_issued',
};

const sampleVanRoute: SbcVanSellingRoute = {
  id: 'van-1',
  route_code: 'VAN-01',
  driver_agent_name: 'Matteo Fontana',
  vehicle_plate: 'TI-448291',
  document_series_sezionale: 'VAN-TI-01',
  sold_stock_qty: '80.000',
  returned_unsold_qty: '20.000',
  stock_variance_qty: '0.000',
  collected_cash_amount: '1500.00',
  electronic_payment_amount: '900.00',
  currency: 'CHF',
  reconciliation_status: 'reconciled_balanced',
};

const sampleAffiliate: SbcFranchisingAffiliate = {
  id: 'frn-1',
  affiliate_code: 'FRN-01',
  franchisor_brand: 'Alpine',
  store_name: 'Zurich Store',
  country: 'CH',
  currency: 'CHF',
  sell_out_turnover: '120000.00',
  total_fee_invoiceable: '8400.00',
  pushed_price_list_version: 'PL-V2',
  benchmark_index_pct: '120.00',
  status: 'royalties_invoiced',
};

const sampleSurvey: SbcPostDeliverySurvey = {
  id: 'srv-1',
  survey_code: 'SRV-01',
  trigger_event: 'post_delivery_ddt',
  nps_score: 9,
  csat_score: 5,
  ces_score: 6,
  nps_classification: 'promoter',
  detractor_recovery_alert_triggered: false,
  iso9001_clause_ref: 'ISO-9001:2015-9.1.2',
  iso9001_satisfaction_index: '95.00',
};

const sampleWelfare: SbcCorporateWelfareConvention = {
  id: 'wlf-1',
  convention_code: 'WLF-01',
  partner_company_name: 'Alpine Italia Srl',
  employee_email: 'giulia@alpine.it',
  cral_badge_number: 'CRAL-001',
  welfare_regime: 'it_art51_tuir',
  discounted_net_amount: '450.00',
  employer_welfare_quota_amount: '270.00',
  employee_copay_quota_amount: '180.00',
  within_statutory_exemption: true,
  currency: 'EUR',
  status: 'split_billed',
};

describe('SalesBoundedContextCockpitComponent (SD#139 Batch 1 & Batch 2)', () => {
  const api = {
    getConfig: vi.fn(),
    getOverview: vi.fn(),
    getDossiers: vi.fn(),
    createDossier: vi.fn(),
    getLeads: vi.fn(),
    captureLead: vi.fn(),
    getOpportunities: vi.fn(),
    saveOpportunity: vi.fn(),
    getQuotes: vi.fn(),
    createQuote: vi.fn(),
    signQuote: vi.fn(),
    convertQuoteToOrder: vi.fn(),
    getOrders: vi.fn(),
    createOrder: vi.fn(),
    getPricingGuardrails: vi.fn(),
    evaluatePricing: vi.fn(),
    approveMarginOverride: vi.fn(),
    getSubscriptions: vi.fn(),
    createSubscription: vi.fn(),
    transitionSubscription: vi.fn(),
    getDdtInvoices: vi.fn(),
    issueDdtInvoice: vi.fn(),
    getCommissions: vi.fn(),
    calculateCommission: vi.fn(),
    getPortalTransactions: vi.fn(),
    executePortalAction: vi.fn(),
    getMarketingCampaigns: vi.fn(),
    executeMarketingCampaign: vi.fn(),
    getTenders: vi.fn(),
    submitTender: vi.fn(),
    convertTenderToContract: vi.fn(),
    getCpqConfigurations: vi.fn(),
    configureCpqBom: vi.fn(),
    getGdoRebates: vi.fn(),
    calculateGdoRebate: vi.fn(),
    settleGdoRebateCreditNote: vi.fn(),
    getReverseReturns: vi.fn(),
    processReverseReturn: vi.fn(),
    getVanRoutes: vi.fn(),
    reconcileVanRoute: vi.fn(),
    getFranchisingAffiliates: vi.fn(),
    calculateFranchisingRoyalty: vi.fn(),
    getSurveys: vi.fn(),
    recordSurvey: vi.fn(),
    getWelfareConventions: vi.fn(),
    processWelfareSplitBilling: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getConfig.mockReturnValue(of({ data: sampleConfig }));
    api.getOverview.mockReturnValue(of({ data: sampleOverview }));
    api.getDossiers.mockReturnValue(of({ data: [sampleDossier] }));
    api.createDossier.mockReturnValue(of({ data: sampleDossier }));
    api.getLeads.mockReturnValue(of({ data: [sampleLead] }));
    api.captureLead.mockReturnValue(of({ data: sampleLead }));
    api.getOpportunities.mockReturnValue(of({ data: [sampleOpportunity] }));
    api.saveOpportunity.mockReturnValue(of({ data: sampleOpportunity }));
    api.getQuotes.mockReturnValue(of({ data: [sampleQuote] }));
    api.createQuote.mockReturnValue(of({ data: sampleQuote }));
    api.signQuote.mockReturnValue(of({ data: { ...sampleQuote, signature_status: 'signed' } }));
    api.convertQuoteToOrder.mockReturnValue(of({ data: { ...sampleQuote, signature_status: 'signed', converted_order_id: 'ord-1' } }));
    api.getOrders.mockReturnValue(of({ data: [sampleOrder] }));
    api.createOrder.mockReturnValue(of({ data: sampleOrder }));
    api.getPricingGuardrails.mockReturnValue(of({ data: [samplePricing] }));
    api.evaluatePricing.mockReturnValue(of({ data: samplePricing }));
    api.approveMarginOverride.mockReturnValue(of({ data: { ...samplePricing, approval_status: 'approved_override' } }));
    api.getSubscriptions.mockReturnValue(of({ data: [sampleSub] }));
    api.createSubscription.mockReturnValue(of({ data: sampleSub }));
    api.transitionSubscription.mockReturnValue(of({ data: { ...sampleSub, revalued_amount: '1522.50' } }));
    api.getDdtInvoices.mockReturnValue(of({ data: [sampleDdt] }));
    api.issueDdtInvoice.mockReturnValue(of({ data: sampleDdt }));
    api.getCommissions.mockReturnValue(of({ data: [sampleCommission] }));
    api.calculateCommission.mockReturnValue(of({ data: sampleCommission }));
    api.getPortalTransactions.mockReturnValue(of({ data: [samplePortal] }));
    api.executePortalAction.mockReturnValue(of({ data: samplePortal }));
    api.getMarketingCampaigns.mockReturnValue(of({ data: [sampleCampaign] }));
    api.executeMarketingCampaign.mockReturnValue(of({ data: sampleCampaign }));
    api.getTenders.mockReturnValue(of({ data: [sampleTender] }));
    api.submitTender.mockReturnValue(of({ data: sampleTender }));
    api.convertTenderToContract.mockReturnValue(of({ data: { ...sampleTender, converted_order_id: 'ord-99' } }));
    api.getCpqConfigurations.mockReturnValue(of({ data: [sampleCpqConfig] }));
    api.configureCpqBom.mockReturnValue(of({ data: sampleCpqConfig }));
    api.getGdoRebates.mockReturnValue(of({ data: [sampleGdoRebate] }));
    api.calculateGdoRebate.mockReturnValue(of({ data: sampleGdoRebate }));
    api.settleGdoRebateCreditNote.mockReturnValue(of({ data: { ...sampleGdoRebate, settlement_status: 'settled_credit_note', settlement_credit_note_id: 'nc-1' } }));
    api.getReverseReturns.mockReturnValue(of({ data: [sampleReturn] }));
    api.processReverseReturn.mockReturnValue(of({ data: sampleReturn }));
    api.getVanRoutes.mockReturnValue(of({ data: [sampleVanRoute] }));
    api.reconcileVanRoute.mockReturnValue(of({ data: sampleVanRoute }));
    api.getFranchisingAffiliates.mockReturnValue(of({ data: [sampleAffiliate] }));
    api.calculateFranchisingRoyalty.mockReturnValue(of({ data: sampleAffiliate }));
    api.getSurveys.mockReturnValue(of({ data: [sampleSurvey] }));
    api.recordSurvey.mockReturnValue(of({ data: sampleSurvey }));
    api.getWelfareConventions.mockReturnValue(of({ data: [sampleWelfare] }));
    api.processWelfareSplitBilling.mockReturnValue(of({ data: sampleWelfare }));

    TestBed.configureTestingModule({
      imports: [SalesBoundedContextCockpitComponent],
      providers: [
        provideRouter([]),
        { provide: SalesBoundedContextApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } },
        provideNzIcons(icons),
      ],
    });
  });

  it('orchestrates all Mod 033-042 workflows through SignalStore and API service', async () => {
    const fixture = TestBed.createComponent(SalesBoundedContextCockpitComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const cmp = fixture.componentInstance;
    expect(api.getConfig).toHaveBeenCalled();
    expect(api.getOverview).toHaveBeenCalled();

    await cmp.createSampleDossier();
    expect(api.createDossier).toHaveBeenCalled();

    await cmp.captureSampleLead();
    expect(api.captureLead).toHaveBeenCalled();

    await cmp.saveSampleOpportunity();
    expect(api.saveOpportunity).toHaveBeenCalled();

    await cmp.createSampleQuote();
    await cmp.signQuote('quo-1');
    await cmp.convertQuote('quo-1');
    expect(api.signQuote).toHaveBeenCalled();
    expect(api.convertQuoteToOrder).toHaveBeenCalledWith('quo-1');

    await cmp.createSampleOrder();
    expect(api.createOrder).toHaveBeenCalled();

    await cmp.evaluateSamplePricing();
    await cmp.approveOverride('prc-1');
    expect(api.approveMarginOverride).toHaveBeenCalledWith('prc-1', 'Approved by manager');

    await cmp.createSampleSubscription();
    await cmp.revalueSubscription('sub-1');
    expect(api.transitionSubscription).toHaveBeenCalled();

    await cmp.issueSampleDdtInvoice();
    expect(api.issueDdtInvoice).toHaveBeenCalled();

    await cmp.calculateSampleCommission();
    expect(api.calculateCommission).toHaveBeenCalled();

    await cmp.executeSamplePortalPayment();
    expect(api.executePortalAction).toHaveBeenCalled();

    await cmp.executeSampleCampaign();
    expect(api.executeMarketingCampaign).toHaveBeenCalled();

    await cmp.submitSampleTender();
    await cmp.convertTender('tnd-1');
    expect(api.submitTender).toHaveBeenCalled();
    expect(api.convertTenderToContract).toHaveBeenCalledWith('tnd-1');

    await cmp.configureSampleCpqBom();
    expect(api.configureCpqBom).toHaveBeenCalled();

    await cmp.calculateSampleGdoRebate();
    await cmp.settleGdoRebate('gdo-1');
    expect(api.calculateGdoRebate).toHaveBeenCalled();
    expect(api.settleGdoRebateCreditNote).toHaveBeenCalledWith('gdo-1');

    await cmp.processSampleReverseReturn();
    expect(api.processReverseReturn).toHaveBeenCalled();

    await cmp.reconcileSampleVanRoute();
    expect(api.reconcileVanRoute).toHaveBeenCalled();

    await cmp.calculateSampleFranchisingRoyalty();
    expect(api.calculateFranchisingRoyalty).toHaveBeenCalled();

    await cmp.recordSampleSurvey();
    expect(api.recordSurvey).toHaveBeenCalled();

    await cmp.processSampleWelfareSplit();
    expect(api.processWelfareSplitBilling).toHaveBeenCalled();
  });
});
