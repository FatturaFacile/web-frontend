/**
 * Sales pipeline (Module 035): Kanban board, weighted value, forecast / quota dashboard and loss analysis.
 *
 * Conventions shared with the API: probabilities are percentages in 0..100 (never decimals 0..1), money amounts are
 * numbers on the board and decimal strings on the dashboards, and every catalog label (pipeline, stage, loss reason)
 * arrives already localized from the API seeders, so no label lives in the frontend.
 */

export type SalesForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted';

export const SALES_FORECAST_CATEGORIES: readonly SalesForecastCategory[] = [
  'pipeline',
  'best_case',
  'commit',
  'closed',
  'omitted',
];

export interface SalesPipelineStage {
  id: string;
  pipeline_id: string | null;
  code: string;
  /** Localized by the API. */
  name: string;
  translations?: Record<string, string> | null;
  sequence: number;
  default_probability: number;
  forecast_category: SalesForecastCategory;
  is_won: boolean;
  is_lost: boolean;
  is_active: boolean;
  stale_days: number;
}

export interface SalesPipeline {
  id: string;
  code: string;
  /** Localized by the API. */
  name: string;
  business_line: string | null;
  market: string | null;
  currency: string;
  translations: Record<string, string> | null;
  sequence: number;
  is_default: boolean;
  is_active: boolean;
  opportunities_count: number;
  stages?: SalesPipelineStage[];
}

export interface SalesPipelinePayload {
  code?: string;
  name?: string;
  business_line?: string | null;
  market?: string | null;
  currency?: string;
  translations?: Record<string, string> | null;
  sequence?: number;
  is_default?: boolean;
  is_active?: boolean;
  install_standard_stages?: boolean;
}

export interface SalesPipelineStagePayload {
  code?: string;
  pipeline_id?: string;
  name?: string;
  sequence?: number;
  default_probability?: number;
  forecast_category?: SalesForecastCategory;
  is_won?: boolean;
  is_lost?: boolean;
  is_active?: boolean;
  stale_days?: number;
  translations?: Record<string, string> | null;
  reprice_open_opportunities?: boolean;
}

export interface SalesLossReason {
  id: string;
  code: string;
  /** Localized by the API. */
  name: string;
  translations: Record<string, string> | null;
  requires_competitor: boolean;
  sequence: number;
  is_active: boolean;
}

export interface SalesLossReasonPayload {
  code?: string;
  name?: string;
  translations?: Record<string, string> | null;
  requires_competitor?: boolean;
  sequence?: number;
  is_active?: boolean;
}

/** A deal as shown on a Kanban card. */
export interface SalesDeal {
  id: string;
  opportunity_number: string;
  name: string;
  amount: number;
  /** Deal value x probability, computed by the API. */
  weighted_amount: number;
  currency: string;
  /** Percentage 0..100. */
  probability: number;
  forecast_category: SalesForecastCategory | string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  status: string;
  stage_id: string;
  pipeline_id: string | null;
  board_position: number;
  owner_user_id: string | null;
  owner: { id: string; name: string } | null;
  account: { id: string; name: string; tier?: string } | null;
  notes: string | null;
  notes_updated_at: string | null;
  loss_reason_code: string | null;
  competitor: string | null;
}

export interface SalesColumnTotals {
  count: number;
  /** Decimal strings with two decimals, as the API returns them. */
  amount: string;
  weighted_amount: string;
}

export interface SalesBoardColumn {
  stage: SalesPipelineStage;
  totals: SalesColumnTotals;
  opportunities: SalesDeal[];
}

export interface SalesBoard {
  pipeline: SalesPipeline;
  columns: SalesBoardColumn[];
  totals: SalesColumnTotals;
}

export interface SalesBoardFilters {
  owner_user_id?: string | null;
  from?: string | null;
  to?: string | null;
  forecast_category?: SalesForecastCategory | null;
  search?: string | null;
  per_column?: number;
}

/** The loss questionnaire, mandatory when a deal is moved to a lost stage. */
export interface SalesLossAnswer {
  loss_reason_code: string;
  competitor: string;
  loss_notes?: string | null;
}

export interface MoveSalesDealPayload extends Partial<SalesLossAnswer> {
  stage_id: string;
  position?: number;
  probability?: number;
  forecast_category?: SalesForecastCategory;
}

export interface MoveSalesDealResult {
  opportunity: SalesDeal;
  /** Reconciled totals of the source and target columns, keyed by stage id. */
  stage_totals: Record<string, SalesColumnTotals>;
}

export interface SalesStageHistoryEntry {
  id: string;
  from_stage: string | null;
  to_stage: string | null;
  amount: number;
  probability: number;
  weighted_amount: number;
  loss_reason_code: string | null;
  winning_competitor: string | null;
  changed_by_user_id: string | null;
  created_at: string;
}

export type SalesForecastGranularity = 'month' | 'quarter';

export interface SalesForecastFigures {
  pipeline: string;
  best_case: string;
  commit: string;
  closed_won: string;
  closed_lost: string;
  weighted_open: string;
  open_count: number;
  won_count: number;
  lost_count: number;
  quota: string;
  commit_forecast: string;
  best_case_forecast: string;
  weighted_forecast: string;
}

export interface SalesForecastBucket extends SalesForecastFigures {
  key: string;
  label: string;
  start: string;
  end: string;
}

export interface SalesForecastTotals extends SalesForecastBucket {
  attainment_percent: string;
  commit_attainment_percent: string;
  best_case_attainment_percent: string;
  weighted_attainment_percent: string;
  gap_to_quota: string;
}

export interface SalesForecastRep extends SalesForecastTotals {
  user_id: string | null;
  name: string | null;
}

export interface SalesForecastDashboard {
  granularity: SalesForecastGranularity;
  year: number;
  period: { start: string; end: string };
  buckets: SalesForecastBucket[];
  totals: SalesForecastTotals;
  reps: SalesForecastRep[];
}

export interface SalesForecastFilters {
  granularity?: SalesForecastGranularity;
  year?: number;
  quarter?: number | null;
  month?: number | null;
  pipeline_id?: string | null;
  owner_user_id?: string | null;
}

export interface SalesLossBreakdownRow {
  count: number;
  amount: string;
}

export interface SalesLossAnalysis {
  total_lost: SalesLossBreakdownRow;
  by_reason: (SalesLossBreakdownRow & { code: string; label: string })[];
  by_competitor: (SalesLossBreakdownRow & { competitor: string })[];
}

/** Payload of the `crm.opportunity.board-updated` broadcast. */
export interface SalesBoardUpdatedEvent {
  opportunity_id: string;
  change: 'created' | 'moved' | 'reordered' | 'won' | 'lost' | 'noted';
  pipeline_id: string | null;
  stage_id: string | null;
  actor_user_id: string | null;
}
