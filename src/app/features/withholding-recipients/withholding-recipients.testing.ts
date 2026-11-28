import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  WrAnnualRecord,
  WrCertificate,
  WrDashboardMeta,
  WrDashboardRow,
  WrF24Preview,
  WrInlNotification,
  WrLookups,
  WrRecipient,
  WrSettlement,
  WrSimulation,
} from '@core';

/** Fixtures shared by the specs of the withholding recipients feature. */

export const wrap = <T>(data: T, meta?: object) => ({
  success: true,
  message: 'ok',
  data,
  ...(meta ? { meta } : {}),
});

export const pageMeta = { current_page: 1, last_page: 1, per_page: 20, total: 2 };

/** Stand-in of the translation service: keys come back unchanged so the specs can assert on them. */
export function translateSpy() {
  return {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
    currentLanguage: signal('en'),
  };
}

export const lookups: WrLookups = {
  regimes: [
    { value: 'agent_25bis', jurisdiction: 'IT', currency: 'EUR', cu_causal: 'R' },
    { value: 'author_royalty', jurisdiction: 'IT', currency: 'EUR', cu_causal: 'B' },
    { value: 'occasional_worker', jurisdiction: 'IT', currency: 'EUR', cu_causal: 'M' },
    { value: 'amateur_sports', jurisdiction: 'IT', currency: 'EUR', cu_causal: 'M' },
    { value: 'swiss_foreign_artist', jurisdiction: 'CH', currency: 'CHF', cu_causal: 'A' },
    { value: 'swiss_de_minimis', jurisdiction: 'CH', currency: 'CHF', cu_causal: 'A' },
  ],
  cu_causals: ['A', 'M', 'M1', 'B', 'N', 'Q', 'R', 'V'],
  activity_types: ['artist', 'athlete', 'speaker'],
  enasarco_mandates: ['mono', 'pluri'],
  parameters: {
    occasional_inps_threshold: '5000',
    stamp_threshold: '77.47',
    stamp_amount: '2.00',
    sports_exempt_threshold: '5000',
    sports_irpef_threshold: '15000',
    swiss_de_minimis: '2300',
    enasarco_ceiling: { mono: '46000', pluri: '28000' },
  },
};

export function recipient(id: string, overrides: Partial<WrRecipient> = {}): WrRecipient {
  return {
    id,
    contact_id: null,
    display_name: `Recipient ${id}`,
    regime: 'occasional_worker',
    jurisdiction: 'IT',
    currency: 'EUR',
    tax_code: 'RSSMRA85T10A562S',
    vat_number: null,
    avs_number: null,
    birth_date: '1985-12-10',
    country_of_residence: 'IT',
    canton: null,
    enasarco_mandate: null,
    firr_enabled: false,
    is_cultural_sector: false,
    activity_type: null,
    cu_causal: 'M',
    third_party_ytd_income: null,
    third_party_income_year: null,
    third_party_declared_on: null,
    is_active: true,
    notes: null,
    certificates: [],
    inl_notifications: [],
    ...overrides,
  };
}

export function certificate(id: string, overrides: Partial<WrCertificate> = {}): WrCertificate {
  return {
    id,
    recipient_profile_id: 'r-1',
    fiscal_year: 2026,
    received_on: '2025-12-20',
    valid_from: '2026-01-01',
    valid_to: '2026-12-31',
    pec_message_id: null,
    pec_archive_reference: null,
    notes: null,
    status: 'active',
    received_in_time: true,
    ...overrides,
  };
}

export function inlNotice(
  id: string,
  overrides: Partial<WrInlNotification> = {},
): WrInlNotification {
  return {
    id,
    recipient_profile_id: 'r-1',
    status: 'draft',
    work_start_date: '2026-05-01',
    work_end_date: '2026-05-03',
    activity_description: 'Workshop',
    work_place: 'Milano',
    estimated_compensation: '300.00',
    sent_at: null,
    sent_before_start: false,
    protocol_reference: null,
    ...overrides,
  };
}

export function dashboardRow(id: string, overrides: Partial<WrDashboardRow> = {}): WrDashboardRow {
  return {
    id,
    display_name: `Recipient ${id}`,
    regime: 'occasional_worker',
    jurisdiction: 'IT',
    cu_causal: 'M',
    currency: 'EUR',
    tax_code: 'RSSMRA85T10A562S',
    is_active: true,
    ytd_gross: '3000.00',
    ytd_withheld: '600.00',
    payments: 3,
    alerts: [],
    thresholds: [{ key: 'occasional_5000', current: '3000.00', limit: '5000.00', percent: 60 }],
    ...overrides,
  };
}

export const dashboardMeta: WrDashboardMeta = {
  year: 2026,
  recipients: 2,
  with_alerts: 1,
  ytd_gross_eur: '8000.00',
  ytd_gross_chf: '750.00',
  pending_inl: 1,
};

export function simulation(overrides: Partial<WrSimulation> = {}): WrSimulation {
  return {
    currency: 'EUR',
    gross_amount: '1000.00',
    flat_rate_deduction: '0.00',
    taxable_base: '1000.00',
    withholding_rate: '20.0000',
    effective_withholding_rate: '20.0000',
    irpef_withholding: '200.00',
    inps_base: '1000.00',
    inps_total: '337.20',
    inps_worker: '112.40',
    inps_company: '224.80',
    stamp_duty: '2.00',
    enasarco_base: '0.00',
    enasarco_agent: '0.00',
    enasarco_company: '0.00',
    firr_accrual: '0.00',
    avs_base: '0.00',
    avs_employee: '0.00',
    avs_employer: '0.00',
    acquisition_expenses: '0.00',
    source_tax: '0.00',
    non_taxable_amount: '0.00',
    non_taxable_code: null,
    cu_causal: 'M',
    net_payable: '685.40',
    company_cost: '1224.80',
    thresholds: [{ key: 'occasional_5000', current: '1000.00', limit: '5000.00', percent: 20 }],
    warnings: ['inps_threshold_exceeded'],
    notes: ['revenue_stamp_applied'],
    ...overrides,
  };
}

export function settlement(id: string, overrides: Partial<WrSettlement> = {}): WrSettlement {
  const figures: Partial<WrSimulation> = simulation();
  delete figures.thresholds;
  return {
    ...(figures as Omit<WrSimulation, 'thresholds'>),
    id,
    recipient_profile_id: 'r-1',
    recipient_name: 'Recipient r-1',
    regime: 'occasional_worker',
    jurisdiction: 'IT',
    document_number: `N-${id}`,
    service_date: '2026-05-02',
    payment_date: '2026-05-10',
    tax_year: 2026,
    accrual_month: '2026-05',
    status: 'posted',
    f24_due_date: '2026-06-16',
    f24_lines: [
      {
        tax_code: '1040',
        reference_month: 5,
        reference_year: 2026,
        amount: '200.00',
        section: 'erario',
      },
    ],
    uniemens_required: true,
    inl_notification_id: null,
    payment_reference: null,
    warnings: [],
    notes: [],
    ...overrides,
  };
}

export const f24Preview: WrF24Preview = {
  month: '2026-05',
  due_date: '2026-06-16',
  lines: [
    {
      section: 'erario',
      tax_code: '1040',
      reference_month: 5,
      reference_year: 2026,
      amount: '400.00',
      settlements: 2,
    },
    {
      section: 'inps',
      tax_code: 'C10',
      reference_month: 5,
      reference_year: 2026,
      amount: '337.20',
      settlements: 2,
    },
  ],
  total: '737.20',
};

export function annualRecord(id: string, overrides: Partial<WrAnnualRecord> = {}): WrAnnualRecord {
  return {
    id,
    recipient_profile_id: 'r-1',
    recipient_name: 'Recipient r-1',
    tax_code: 'RSSMRA85T10A562S',
    tax_year: 2026,
    return_type: 'CU',
    causal: 'M',
    currency: 'EUR',
    gross_total: '3000.00',
    non_taxable_total: '0.00',
    non_taxable_code: null,
    taxable_total: '3000.00',
    withholding_total: '600.00',
    inps_worker_total: '337.20',
    inps_company_total: '674.40',
    enasarco_total: '0.00',
    avs_total: '0.00',
    source_tax_total: '0.00',
    settlement_count: 3,
    status: 'generated',
    generated_at: '2027-01-15T10:00:00+01:00',
    ...overrides,
  };
}
