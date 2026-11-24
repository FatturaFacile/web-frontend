export type AnalyticsKpiKey =
  | 'sales'
  | 'purchases'
  | 'margin'
  | 'receivables-aging'
  | 'payables-aging'
  | 'stock-value'
  | 'project-margin'
  | 'hr-headcount';

export type AnalyticsPeriodPreset =
  | 'custom'
  | 'month_to_date'
  | 'last_month'
  | 'quarter_to_date'
  | 'year_to_date'
  | 'last_30_days';

export type AnalyticsComparePreset = 'none' | 'previous_period' | 'previous_year';

export interface AnalyticsKpiResult {
  key: AnalyticsKpiKey | string;
  label: string;
  unit: 'currency' | 'count' | 'percent';
  kind: 'period' | 'snapshot';
  available: boolean;
  reason?: 'forbidden' | 'snapshot_not_comparable' | null;
  value?: string | number | null;
  details?: Record<string, unknown> | null;
  comparison?: {
    period?: { from?: string; to?: string };
    value?: string | number | null;
    details?: Record<string, unknown> | null;
  } | null;
  change?: string | number | null;
  change_percent?: string | number | null;
}

export interface AnalyticsKpiReport {
  period: {
    from: string;
    to: string;
  };
  comparison_period?: {
    from: string;
    to: string;
  } | null;
  kpis: AnalyticsKpiResult[];
}

export interface AnalyticsReportDefinition {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  kpis: string[];
  period_preset: AnalyticsPeriodPreset | string;
  from_date?: string | null;
  to_date?: string | null;
  compare: AnalyticsComparePreset | string;
  is_shared: boolean;
  is_owner: boolean;
}

export interface AnalyticsSaveReportDefinitionRequest {
  name: string;
  description?: string | null;
  kpis: string[];
  period_preset: AnalyticsPeriodPreset | string;
  from_date?: string | null;
  to_date?: string | null;
  compare?: AnalyticsComparePreset | string;
  is_shared?: boolean;
}

export interface DueCalendarEntry {
  id: string;
  date: string;
  direction: 'inflow' | 'outflow';
  amount: number;
  currency: string;
  description: string;
  contact_id?: string;
  contact_name?: string;
  is_overdue: boolean;
}

export interface DueCalendarQueryParams {
  from?: string;
  to?: string;
  direction?: 'inflow' | 'outflow';
  contact_id?: string;
  overdue_only?: boolean;
}

export interface RevenueComparisonMonth {
  month: number;
  month_name?: string;
  revenue: number;
  previous_year_revenue: number;
  variance: number;
  variance_percent: number;
}

export interface RevenueComparisonData {
  year: number;
  months: RevenueComparisonMonth[];
  total_revenue: number;
  total_previous_revenue: number;
  overall_variance_percent: number;
}

export interface BreakdownEntry {
  key: string;
  label: string;
  amount: number;
  percentage: number;
}
