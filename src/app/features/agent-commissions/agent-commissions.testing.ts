import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  AgcAgentProfile,
  AgcEnasarcoRow,
  AgcFiscalParameter,
  AgcLedgerEntry,
  AgcRule,
  AgcStatement,
  AgcStatementPreview,
  AgcZone,
} from '@core';

/** Fixtures shared by the specs of the agent commissions feature. */

export const wrap = <T>(data: T) => ({ success: true, message: 'ok', data });

export const pageMeta = { current_page: 1, last_page: 1, per_page: 20, total: 2 };

/** Stand-in of the translation service: keys come back unchanged so the specs can assert on them. */
export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export function agent(id: string, overrides: Partial<AgcAgentProfile> = {}): AgcAgentProfile {
  return {
    id,
    sales_representative_id: `rep-${id}`,
    representative: {
      id: `rep-${id}`,
      rep_code: `R-${id}`,
      name: `Agent ${id}`,
      email: `agent-${id}@example.test`,
      default_commission_rate: '5.0000',
    },
    agent_type: 'multi_mandate',
    fiscal_regime: 'enasarco',
    enasarco_mandate: 'multi',
    parent_agent_profile_id: null,
    parent_name: null,
    parent_split_mode: null,
    parent_split_value: null,
    accrual_basis: 'collected',
    default_rate: '6.5000',
    settlement_channel: 'invoice',
    has_own_organization: false,
    vat_applies: true,
    firr_enabled: true,
    enasarco_registration_number: null,
    tax_code: null,
    vat_number: null,
    contract_start: '2026-01-01',
    contract_end: null,
    notes: null,
    is_active: true,
    ...overrides,
  };
}

export function rule(id: string, overrides: Partial<AgcRule> = {}): AgcRule {
  return {
    id,
    agent_profile_id: null,
    name: `Rule ${id}`,
    product_category_id: null,
    customer_id: null,
    zone_id: null,
    zone: null,
    rate_type: 'percentage',
    rate: '7.0000',
    fixed_amount: null,
    accrual_basis: null,
    priority: 100,
    valid_from: '2026-01-01',
    valid_to: null,
    is_active: true,
    tiers: [],
    ...overrides,
  };
}

export function zone(id: string, overrides: Partial<AgcZone> = {}): AgcZone {
  return {
    id,
    code: `Z${id}`,
    name: `Zone ${id}`,
    country: 'IT',
    regions: ['MI', 'TO'],
    is_active: true,
    ...overrides,
  };
}

export function parameter(
  id: string,
  overrides: Partial<AgcFiscalParameter> = {},
): AgcFiscalParameter {
  return {
    id,
    code: 'enasarco_massimale',
    mandate_type: 'multi',
    year: 2026,
    value: '30000.00',
    payload: null,
    label_key: null,
    is_override: false,
    ...overrides,
  };
}

export function entry(id: string, overrides: Partial<AgcLedgerEntry> = {}): AgcLedgerEntry {
  return {
    id,
    agent_profile_id: 'a-1',
    agent_name: 'Agent a-1',
    role: 'primary',
    invoice_id: `inv-${id}`,
    invoice_number: `FA-${id}`,
    invoice_date: '2026-03-10',
    rule_id: null,
    accrual_basis: 'invoiced',
    currency: 'EUR',
    accrued_on: '2026-03-10',
    base_amount: '1000.00',
    rate: '5.0000',
    commission_amount: '50.00',
    credited_amount: '0.00',
    effective_amount: '50.00',
    eligible_amount: '50.00',
    settled_amount: '0.00',
    payable_amount: '50.00',
    blocked_amount: '0.00',
    collected_ratio: '1.000000',
    reconciled_ratio: '1.000000',
    status: 'eligible',
    ...overrides,
  };
}

export function enasarcoRow(id: string, overrides: Partial<AgcEnasarcoRow> = {}): AgcEnasarcoRow {
  return {
    agent_profile_id: id,
    agent_name: `Agent ${id}`,
    mandate: 'multi',
    year: 2026,
    commission_ytd: '20000.00',
    enasarco_base_ytd: '20000.00',
    enasarco_agent_ytd: '540.00',
    enasarco_company_ytd: '540.00',
    massimale: '40000.00',
    massimale_remaining: '20000.00',
    massimale_reached: false,
    minimale: '500.00',
    minimale_reached: true,
    minimale_shortfall: '0.00',
    firr_ytd: '800.00',
    firr_enabled: true,
    ...overrides,
  };
}

export function statement(id: string, overrides: Partial<AgcStatement> = {}): AgcStatement {
  return {
    id,
    number: `ST-2026-000${id}`,
    agent_profile_id: 'a-1',
    agent_name: 'Agent a-1',
    agent_email: 'agent-a-1@example.test',
    settlement_channel: 'invoice',
    period_type: 'monthly',
    period_start: '2026-03-01',
    period_end: '2026-03-31',
    status: 'draft',
    currency: 'EUR',
    base_total: '10000.00',
    own_commission_total: '500.00',
    override_commission_total: '0.00',
    clawback_total: '0.00',
    gross_commission: '500.00',
    enasarco_base: '500.00',
    enasarco_agent: '13.50',
    enasarco_company: '13.50',
    firr_accrual: '20.00',
    withholding_base: '243.25',
    withholding_amount: '48.65',
    vat_amount: '110.00',
    net_payable: '547.85',
    blocked_amount: '0.00',
    massimale_reached: false,
    approved_at: null,
    self_billing_number: null,
    self_billing_date: null,
    self_billing_payload: null,
    paid_at: null,
    payment_reference: null,
    sent_at: null,
    sent_to: null,
    sent_count: 0,
    lines: [
      {
        id: 'l-1',
        entry_id: 'e-1',
        invoice_id: 'inv-1',
        invoice_number: 'FA-1',
        invoice_date: '2026-03-10',
        customer_name: 'Acme Spa',
        role: 'primary',
        accrual_basis: 'collected',
        base_amount: '10000.00',
        rate: '5.0000',
        commission_amount: '500.00',
      },
    ],
    ...overrides,
  };
}

export const preview: AgcStatementPreview = {
  agent_profile_id: 'a-1',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
  currency: 'EUR',
  lines_count: 3,
  base_total: '10000.00',
  own_commission_total: '500.00',
  override_commission_total: '50.00',
  clawback_total: '-20.00',
  gross_commission: '550.00',
  fiscal: {
    mandate: 'multi',
    applies_enasarco: true,
    enasarco_base: '550.00',
    enasarco_agent: '14.85',
    enasarco_company: '14.85',
    firr: '22.00',
    withholding_base: '267.58',
    withholding: '53.52',
    vat: '121.00',
    massimale: '40000.00',
    minimale: '500.00',
    massimale_reached: true,
    minimale_reached: false,
    minimale_shortfall: '470.30',
  },
  net_payable: '632.63',
  blocked_amount: '120.00',
};
