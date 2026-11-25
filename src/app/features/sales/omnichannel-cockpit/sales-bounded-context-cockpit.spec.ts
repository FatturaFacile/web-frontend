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
  SbcCpqQuote,
  SbcCustomerDossier,
  SbcDdtInvoice,
  SbcFrameworkOrder,
  SbcOmnichannelLead,
  SbcOpportunityForecast,
  SbcPortalTransaction,
  SbcPricingGuardrail,
  SbcRecurringSubscription,
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

describe('SalesBoundedContextCockpitComponent (SD#139 Batch 1)', () => {
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
  });
});
