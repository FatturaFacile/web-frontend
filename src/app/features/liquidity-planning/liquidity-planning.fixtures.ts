import {
  LpAlert,
  LpIndicators,
  LpManualItem,
  LpOverview,
  LpPoint,
  LpPreset,
  LpProjection,
  LpReport,
  LpScenario,
  LpSettings,
  LpTiers,
} from '@core';
import { addDaysIso } from './liquidity-planning.util';

export const AS_OF = '2027-01-04';

const tiers = (certainIn: string, certainOut: string): LpTiers => ({
  certain: { inflows: certainIn, outflows: certainOut },
  probable: { inflows: '0.00', outflows: '0.00' },
  estimated: { inflows: '0.00', outflows: '0.00' },
});

/** A daily projection: 100 in and 80 out every day, from an opening balance of 1000. */
export function dailyPoints(days: number, start = 1000, net = 20): LpPoint[] {
  return Array.from({ length: days + 1 }, (_, index) => ({
    date: addDaysIso(AS_OF, index),
    inflows: '100.00',
    outflows: '80.00',
    net: net.toFixed(2),
    closing: (start + net * (index + 1)).toFixed(2),
    tiers: tiers('100.00', '80.00'),
  }));
}

export function weeklyPoints(weeks: number): LpPoint[] {
  return Array.from({ length: weeks }, (_, index) => ({
    date: addDaysIso(AS_OF, index * 7),
    week_end: addDaysIso(AS_OF, index * 7 + 6),
    inflows: '700.00',
    outflows: '560.00',
    net: '140.00',
    closing: (1000 + 140 * (index + 1)).toFixed(2),
    tiers: tiers('700.00', '560.00'),
  }));
}

export const projection: LpProjection = {
  daily: dailyPoints(180),
  weekly: weeklyPoints(26),
  negative_balance: null,
};

export const indicators: LpIndicators = {
  dscr: {
    value: '1.35',
    status: 'healthy',
    operating_cash_flow: '270000.00',
    debt_service: { principal: '150000.00', interest: '50000.00', total: '200000.00' },
    thresholds: { critical: '1.00', warning: '1.20' },
    horizon_days: 180,
    lines: [
      {
        date: '2027-02-01',
        kind: 'principal',
        category: 'debt_principal',
        label_key: 'lpApi.category.debt_principal',
        label: null,
        tier: 'certain',
        amount: '25000.00',
      },
    ],
  },
  capital: {
    regime: 'IT_CC_2446_2447',
    share_capital: '100000.00',
    legal_minimum: '10000.00',
    net_equity: '180000.00',
    half_capital: '50000.00',
    status: 'ok',
    coverage_percent: '180.00',
    source: 'ledger',
  },
  pfn: {
    financial_debt: '400000.00',
    cash: '1000.00',
    pfn: '399000.00',
    ebitda: '200000.00',
    pfn_ebitda: '2.00',
    max_ratio: '3.50',
    status: 'ok',
  },
  liquidity: {
    minimum_balance: '5000.00',
    runway_days: null,
    first_negative_date: null,
    status: 'ok',
  },
};

export const alert: LpAlert = {
  id: 'a-1',
  type: 'negative_balance',
  severity: 'critical',
  status: 'open',
  title_key: 'lpApi.alert.negative_balance.title',
  message_key: 'lpApi.alert.negative_balance.message',
  params: { date: '2027-03-01', amount: '-1200.00' },
  detected_at: '2027-01-04T08:00:00Z',
  acknowledged_at: null,
  resolved_at: null,
  last_notified_at: null,
};

export const overview: LpOverview = {
  as_of: AS_OF,
  currency: 'EUR',
  jurisdiction: 'IT',
  opening_cash: '1000.00',
  accounts: [{ id: 'b-1', bank_name: 'Banca', iban: null, currency: 'EUR', balance: '1000.00' }],
  baseline: projection,
  scenario: null,
  scenario_info: null,
  horizons: ([30, 60, 90, 180] as const).map((days) => ({
    days,
    baseline: {
      days,
      until: addDaysIso(AS_OF, days),
      inflows: '1000.00',
      outflows: '800.00',
      net: '200.00',
      closing_balance: (1000 + days * 20).toFixed(2),
      min_balance: '1000.00',
      min_date: AS_OF,
      tiers: tiers('1000.00', '800.00'),
    },
    scenario: null,
  })),
  indicators: { baseline: indicators, scenario: null },
  alerts: [alert],
};

export const settings: LpSettings = {
  jurisdiction: 'IT',
  share_capital: '100000.00',
  legal_minimum_capital: '10000.00',
  minimum_liquidity: '5000.00',
  dscr_critical_threshold: '1.00',
  dscr_warning_threshold: '1.20',
  max_pfn_ebitda: '3.50',
  ebitda_override: null,
  net_equity_override: null,
  alert_cooldown_hours: 24,
  notify_emails: ['cfo@example.com'],
  email_alerts_enabled: true,
  collection_behavior_days: 10,
  payroll_monthly_override: null,
  payroll_pay_day: 27,
  tax_monthly_estimate: null,
};

export const presets: LpPreset[] = [
  {
    code: 'collection_delay_20',
    name_key: 'lpApi.preset.collection_delay_20.name',
    description_key: 'lpApi.preset.collection_delay_20.description',
    levers: { collection_delay_days: 20, collection_delay_share_percent: 100 },
  },
];

export const scenarios: LpScenario[] = [
  { id: 's-1', name: 'Late payers', description: null, levers: { collection_delay_days: 30 } },
];

export const manualItems: LpManualItem[] = [
  {
    id: 'm-1',
    label: 'Insurance',
    tier: 'estimated',
    category: 'other',
    direction: 'outflow',
    amount: '1200.00',
    currency: 'EUR',
    first_date: '2027-02-01',
    frequency: 'quarterly',
    end_date: null,
    is_active: true,
    notes: null,
  },
];

export const report: LpReport = {
  generated_at: '2027-01-04T08:00:00Z',
  company: { name: 'Acme SA', tax_id: null },
  as_of: AS_OF,
  currency: 'EUR',
  jurisdiction: 'IT',
  overview,
  eba: {
    sections: [
      {
        key: 'debt_service',
        title_key: 'lpApi.eba.debt_service.title',
        status: 'ok',
        summary_key: 'lpApi.eba.debt_service.summary',
        params: { dscr: '1.35' },
      },
    ],
  },
};
