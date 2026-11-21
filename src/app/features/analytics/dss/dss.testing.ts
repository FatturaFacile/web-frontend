import {
  BalancedScorecardKpi,
  DrillDownResponse,
  DssOverviewResponse,
  ExecutiveAlert,
  ProfitabilityMatrixResponse,
  ProfitabilityMatrixRow,
  VarianceBridgeResponse,
  WhatIfSimulationResult,
} from './dss.models';

export function kpiFixture(overrides: Partial<BalancedScorecardKpi> = {}): BalancedScorecardKpi {
  return {
    key: 'revenue',
    group: 'financial',
    unit: 'currency',
    available: true,
    value: 1000,
    comparison_value: 800,
    delta: 200,
    delta_pct: 25,
    favorable: true,
    sparkline: [100, 200, 150, 300],
    target: null,
    ...overrides,
  };
}

export function alertFixture(overrides: Partial<ExecutiveAlert> = {}): ExecutiveAlert {
  return {
    code: 'customer_concentration',
    severity: 'CRITICAL',
    metric: 'customer_share_pct',
    value: 90,
    threshold: 25,
    context: { counterparty_id: 'cust-1', label: 'Alpenbau AG' },
    ...overrides,
  };
}

export function overviewFixture(overrides: Partial<DssOverviewResponse> = {}): DssOverviewResponse {
  return {
    meta: {
      currency: 'CHF',
      period: { preset: 'YTD', from: '2028-01-01', to: '2028-06-30' },
      comparison: {
        baseline: 'PRIOR_YEAR',
        from: '2027-01-01',
        to: '2027-06-30',
        budget_found: null,
      },
      fx: { CHF_EUR: 0.95, EUR_CHF: 1.05, as_of: '2028-06-30' },
      legal_entities: [],
    },
    scorecard: {
      financial: [
        kpiFixture(),
        kpiFixture({
          key: 'gross_margin_pct',
          unit: 'percent',
          value: 60,
          comparison_value: 65,
          delta: -5,
          delta_pct: -7.7,
          favorable: false,
        }),
        kpiFixture({ key: 'ebitda', value: 400 }),
        kpiFixture({ key: 'net_cash_flow', value: 500 }),
        kpiFixture({ key: 'cash_conversion_cycle', unit: 'days', value: -126.7, target: 30 }),
      ],
      customer: [
        kpiFixture({
          key: 'net_revenue_retention',
          group: 'customer',
          unit: 'percent',
          value: 104,
        }),
        kpiFixture({
          key: 'customer_concentration_index',
          group: 'customer',
          unit: 'percent',
          value: 90,
          comparison_value: null,
          delta: null,
          delta_pct: null,
          favorable: null,
          sparkline: [],
        }),
        kpiFixture({ key: 'quote_win_rate', group: 'customer', unit: 'percent', value: 40 }),
        kpiFixture({ key: 'average_dso', group: 'customer', unit: 'days', value: 54.3 }),
      ],
      efficiency: [
        kpiFixture({
          key: 'operating_expense_ratio',
          group: 'efficiency',
          unit: 'percent',
          value: 20,
        }),
        kpiFixture({ key: 'revenue_per_fte', group: 'efficiency', value: 50000 }),
        kpiFixture({ key: 'inventory_turnover', group: 'efficiency', unit: 'ratio', value: 4.2 }),
        kpiFixture({
          key: 'on_time_delivery_pct',
          group: 'efficiency',
          unit: 'percent',
          available: false,
          value: null,
          comparison_value: null,
          delta: null,
          delta_pct: null,
          favorable: null,
          sparkline: [],
        }),
      ],
    },
    alerts: [
      alertFixture({
        code: 'budget_overrun',
        severity: 'INFO',
        metric: 'opex',
        value: 12,
        threshold: 10,
        context: {},
      }),
      alertFixture(),
      alertFixture({
        code: 'dso_spike',
        severity: 'WARNING',
        metric: 'dso_days',
        value: 9,
        threshold: 7,
        context: {},
      }),
    ],
    working_capital: {
      dso_days: 54.3,
      dio_days: 0,
      dpo_days: 181,
      ccc_days: -126.7,
      working_capital: 400,
      working_capital_ratio: 1.5,
      free_cash_flow: 500,
      free_cash_flow_yield_pct: 50,
      burn_rate_monthly: 0,
      runway_months: null,
    },
    operations: {
      billable_hours: 8,
      non_billable_hours: 2,
      value_out: 0,
      unit_cost_variance_value: 0,
    },
    ...overrides,
  };
}

export function matrixRowFixture(
  overrides: Partial<ProfitabilityMatrixRow> = {},
): ProfitabilityMatrixRow {
  return {
    key: 'cust-1',
    label: 'Alpenbau AG',
    rank: 1,
    gross_revenue: 900,
    discounts: 0,
    net_revenue: 900,
    cogs: 360,
    gross_margin: 540,
    gross_margin_pct: 60,
    contribution_margin_1: 540,
    contribution_margin_2: 540,
    ebitda: 360,
    payment_delay_cost: 0,
    net_operating_profit: 360,
    net_margin_pct: 40,
    in_pareto_core: true,
    is_value_destroying: false,
    ...overrides,
  };
}

export function matrixFixture(
  overrides: Partial<ProfitabilityMatrixResponse> = {},
): ProfitabilityMatrixResponse {
  const loss = matrixRowFixture({
    key: 'cust-2',
    label: 'Verlust GmbH',
    rank: 2,
    net_revenue: 100,
    ebitda: -40,
    net_operating_profit: -40,
    net_margin_pct: -40,
    in_pareto_core: false,
    is_value_destroying: true,
  });

  return {
    dimension: 'customer',
    currency: 'CHF',
    period: { from: '2028-01-01', to: '2028-06-30' },
    rows: [matrixRowFixture(), loss],
    whale_curve: [
      {
        rank: 1,
        key: 'cust-1',
        label: 'Alpenbau AG',
        net_operating_profit: 360,
        cumulative_profit: 360,
        cumulative_profit_pct: 112.5,
        cumulative_revenue_pct: 90,
        entity_pct: 50,
      },
      {
        rank: 2,
        key: 'cust-2',
        label: 'Verlust GmbH',
        net_operating_profit: -40,
        cumulative_profit: 320,
        cumulative_profit_pct: 100,
        cumulative_revenue_pct: 100,
        entity_pct: 100,
      },
    ],
    totals: { net_revenue: 1000, ebitda: 320 },
    pareto_cutoff_rank: 1,
    entity_count: 2,
    ...overrides,
  };
}

export function bridgeFixture(
  overrides: Partial<VarianceBridgeResponse> = {},
): VarianceBridgeResponse {
  return {
    currency: 'CHF',
    baseline: { type: 'PRIOR_YEAR', from: '2027-01-01', to: '2027-06-30', budget_found: null },
    volume_basis: 'invoice_items',
    ebitda_bridge: [
      { key: 'baseline', type: 'total', value: 200, cumulative: 200 },
      { key: 'volume', type: 'delta', value: 80, cumulative: 280 },
      { key: 'price', type: 'delta', value: 120, cumulative: 400 },
      { key: 'cogs', type: 'delta', value: -60, cumulative: 340 },
      { key: 'opex', type: 'delta', value: -20, cumulative: 320 },
      { key: 'fx', type: 'delta', value: 0, cumulative: 320 },
      { key: 'actual', type: 'total', value: 320, cumulative: 320 },
    ],
    revenue_bridge: [
      { key: 'baseline', type: 'total', value: 1000, cumulative: 1000 },
      { key: 'volume', type: 'delta', value: 200, cumulative: 1200 },
      { key: 'price', type: 'delta', value: 120, cumulative: 1320 },
      { key: 'fx', type: 'delta', value: 0, cumulative: 1320 },
      { key: 'actual', type: 'total', value: 1320, cumulative: 1320 },
    ],
    summary: { delta: 120, delta_pct: 60 },
    line_variances: {},
    ...overrides,
  };
}

export function simulationFixture(
  overrides: Partial<WhatIfSimulationResult> = {},
): WhatIfSimulationResult {
  const figures = {
    revenue: 1000,
    cogs: 400,
    opex: 200,
    ebitda: 400,
    ebitda_margin_pct: 40,
    net_cash_flow: 500,
    break_even_revenue: 333,
    break_even_headroom_pct: 66.7,
  };

  return {
    currency: 'CHF',
    period: { from: '2028-01-01', to: '2028-06-30' },
    inputs: { revenue: 1000 },
    scenario: {
      price_pct: 10,
      cogs_pct: 0,
      opex_pct: 0,
      dso_days_delta: 0,
      fx_shift_pct: 0,
      fte_delta: 0,
    },
    baseline: figures,
    simulated: {
      ...figures,
      revenue: 1100,
      ebitda: 500,
      net_cash_flow: 570,
      break_even_revenue: 286,
    },
    delta: {
      revenue: 100,
      ebitda: 100,
      ebitda_margin_pct: 5,
      net_cash_flow: 70,
      break_even_revenue: -47,
    },
    ...overrides,
  };
}

export function drillFixture(overrides: Partial<DrillDownResponse> = {}): DrillDownResponse {
  return {
    metric: 'revenue',
    currency: 'CHF',
    data: [
      {
        id: 'f-1',
        posting_date: '2028-03-10',
        account_code: '90001',
        category: 'revenue',
        counterparty: { id: 'cust-1', name: 'Alpenbau AG' },
        cost_center_id: null,
        legal_entity_id: 't-1',
        transaction_currency: 'CHF',
        amount_transaction: 1000,
        amount_reporting: 1000,
        source: { type: 'journal_entry', id: 'je-1' },
        links: {
          source: '/api/v1/general-ledger/journal-entries/je-1',
          report_builder: '/api/v1/business-intelligence/explorer/run',
        },
      },
    ],
    pagination: { page: 1, per_page: 25, total: 60, last_page: 3 },
    total_amount: 6000,
    links: {
      kpi_dashboards: '/api/v1/business-intelligence/dashboards',
      report_builder: '/api/v1/business-intelligence/explorer/run',
    },
    ...overrides,
  };
}
