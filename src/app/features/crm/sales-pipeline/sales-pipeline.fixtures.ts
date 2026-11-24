import type {
  SalesBoard,
  SalesBoardColumn,
  SalesDeal,
  SalesForecastDashboard,
  SalesLossReason,
  SalesPipeline,
  SalesPipelineStage,
} from '@core';
import { columnTotals } from './sales-pipeline.utils';

export function stage(
  id: string,
  code: string,
  overrides: Partial<SalesPipelineStage> = {},
): SalesPipelineStage {
  return {
    id,
    pipeline_id: 'p1',
    code,
    name: `Stage ${code}`,
    sequence: 10,
    default_probability: 25,
    forecast_category: 'pipeline',
    is_won: false,
    is_lost: false,
    is_active: true,
    stale_days: 30,
    ...overrides,
  };
}

export function deal(
  id: string,
  stageId: string,
  amount: number,
  probability: number,
  overrides: Partial<SalesDeal> = {},
): SalesDeal {
  return {
    id,
    opportunity_number: `OPP-${id}`,
    name: `Deal ${id}`,
    amount,
    weighted_amount: Math.round(amount * probability) / 100,
    currency: 'CHF',
    probability,
    forecast_category: 'pipeline',
    expected_close_date: '2027-03-31',
    actual_close_date: null,
    status: 'open',
    stage_id: stageId,
    pipeline_id: 'p1',
    board_position: 0,
    owner_user_id: 'u1',
    owner: { id: 'u1', name: 'Rep One' },
    account: { id: 'a1', name: 'Acme AG' },
    notes: null,
    notes_updated_at: null,
    loss_reason_code: null,
    competitor: null,
    ...overrides,
  };
}

export function column(stageValue: SalesPipelineStage, deals: SalesDeal[]): SalesBoardColumn {
  return { stage: stageValue, opportunities: deals, totals: columnTotals(deals) };
}

export const PIPELINE: SalesPipeline = {
  id: 'p1',
  code: 'default',
  name: 'Core business',
  business_line: 'core',
  market: 'CH',
  currency: 'CHF',
  translations: null,
  sequence: 10,
  is_default: true,
  is_active: true,
  opportunities_count: 3,
};

/** Three stages: Qualification (25 %), Negotiation (75 %, commit) and Closed Lost; two open deals and one more. */
export function boardFixture(): SalesBoard {
  const qualification = stage('s1', 'discovery', {
    name: 'Qualificazione',
    sequence: 10,
    default_probability: 25,
  });
  const negotiation = stage('s2', 'negotiation', {
    name: 'Negoziazione',
    sequence: 40,
    default_probability: 75,
    forecast_category: 'commit',
  });
  const won = stage('s3', 'closed_won', {
    name: 'Chiusa Vinta',
    sequence: 90,
    default_probability: 100,
    is_won: true,
    forecast_category: 'closed',
  });
  const lost = stage('s4', 'closed_lost', {
    name: 'Chiusa Persa',
    sequence: 100,
    default_probability: 0,
    is_lost: true,
    forecast_category: 'omitted',
  });

  const columns = [
    column(qualification, [
      deal('d1', 's1', 10000, 25, { board_position: 0 }),
      deal('d2', 's1', 5000, 25, { board_position: 1 }),
    ]),
    column(negotiation, [
      deal('d3', 's2', 2000, 75, { board_position: 0, forecast_category: 'commit' }),
    ]),
    column(won, []),
    column(lost, []),
  ];

  return {
    pipeline: PIPELINE,
    columns,
    totals: { count: 3, amount: '17000.00', weighted_amount: '5250.00' },
  };
}

export const LOSS_REASONS: SalesLossReason[] = [
  {
    id: 'r1',
    code: 'price',
    name: 'Prezzo',
    translations: null,
    requires_competitor: false,
    sequence: 10,
    is_active: true,
  },
  {
    id: 'r2',
    code: 'specific_competitor',
    name: 'Concorrente specifico',
    translations: null,
    requires_competitor: true,
    sequence: 20,
    is_active: true,
  },
  {
    id: 'r3',
    code: 'old',
    name: 'Vecchio',
    translations: null,
    requires_competitor: false,
    sequence: 90,
    is_active: false,
  },
];

export function dashboardFixture(): SalesForecastDashboard {
  const figures = {
    pipeline: '1000.00',
    best_case: '2000.00',
    commit: '4000.00',
    closed_won: '8000.00',
    closed_lost: '500.00',
    weighted_open: '3000.00',
    open_count: 3,
    won_count: 1,
    lost_count: 1,
    quota: '30000.00',
    commit_forecast: '12000.00',
    best_case_forecast: '14000.00',
    weighted_forecast: '11000.00',
  };
  const totals = {
    ...figures,
    key: 'period',
    label: 'period',
    start: '2027-01-01',
    end: '2027-03-31',
    attainment_percent: '26.66',
    commit_attainment_percent: '40.00',
    best_case_attainment_percent: '46.66',
    weighted_attainment_percent: '36.66',
    gap_to_quota: '19000.00',
  };
  return {
    granularity: 'quarter',
    year: 2027,
    period: { start: '2027-01-01', end: '2027-03-31' },
    buckets: [{ ...figures, key: '2027-Q1', label: 'Q1', start: '2027-01-01', end: '2027-03-31' }],
    totals,
    reps: [{ ...totals, user_id: 'u1', name: 'Rep One' }],
  };
}
