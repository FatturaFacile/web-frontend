/** Wire types of `/api/v1/kpi-dashboards` (Mod 090: executive and role-based KPI dashboards). */

export type RoleCode = 'ceo' | 'cfo' | 'sales' | 'operations' | 'hr' | 'custom';
export type WidgetType =
  'metric_card' | 'waterfall_chart' | 'area_trend' | 'funnel' | 'heatmap' | 'top_n_table' | 'gauge';
export type ComparisonMode = 'yoy' | 'mom' | 'ytd' | 'budget';
export type PeriodPreset = 'mtd' | 'qtd' | 'ytd' | 'last_12m' | 'custom';
export type DisplayCurrency = 'CHF' | 'EUR';
export type AlertOperator = '<' | '<=' | '>' | '>=';
export type AlertChannel = 'in_app' | 'push' | 'email';

export const ROLE_CODES: readonly RoleCode[] = [
  'ceo',
  'cfo',
  'sales',
  'operations',
  'hr',
  'custom',
];

/** The global filter bar. */
export interface CockpitFilters {
  preset: PeriodPreset;
  from: string | null;
  to: string | null;
  comparison: ComparisonMode;
  companyIds: string[];
  costCenterIds: string[];
  currency: DisplayCurrency;
  consolidated: boolean;
}

export interface FxRate {
  rate: number;
  kind: 'average' | 'closing';
  from: string;
  to: string;
  as_of: string | null;
  available: boolean;
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetComparison {
  mode: ComparisonMode;
  prior_value: number | null;
  delta: number | null;
  delta_percent: number | null;
}

export interface WidgetAlert {
  severity: 'warning' | 'critical';
  observed_value: number;
  threshold_value: number;
}

/** Calculator-specific payload: series, buckets, stages, rows, breakdowns (depends on the KPI). */
export type WidgetData = Record<string, unknown>;

export interface CockpitWidget {
  widget_id: string;
  kpi_code: string;
  role_code: RoleCode;
  widget_type: WidgetType;
  sort_order: number;
  position: WidgetPosition;
  drill_down_route_template: string | null;
  source_document_type: string;
  value: number | null;
  comparison: WidgetComparison;
  fx_applied: { kind: 'average' | 'closing'; rate: number; available: boolean } | null;
  alerts: WidgetAlert[];
  data: WidgetData;
}

export interface CockpitDashboard {
  id: string;
  role_code: RoleCode;
  title_key: string | null;
  custom_title: string | null;
  layout_grid: { columns: number; row_height: number } | null;
  refresh_interval_seconds: number;
  is_system_default: boolean;
  version: number;
}

export interface Cockpit {
  dashboard: CockpitDashboard;
  filter: {
    from: string;
    to: string;
    comparison: ComparisonMode;
    company_ids: string[];
    cost_center_ids: string[];
    display_currency: DisplayCurrency;
    include_intercompany_eliminations: boolean;
  };
  fx: { average: FxRate; closing: FxRate };
  widgets: CockpitWidget[];
  generated_at: string;
}

export interface CatalogEntry {
  kpi_code: string;
  role_code: RoleCode;
  widget_type: WidgetType;
  is_monetary: boolean;
  is_stock: boolean;
  source_document_type: string;
  title_key: string;
  description_key: string;
}

/** The segment of a card or chart that was clicked: period (`Y-m`), bucket, side, stage, outcome, contact, product, team. */
export type DrillSegment = Partial<
  Record<
    'period' | 'bucket' | 'side' | 'stage_id' | 'outcome' | 'contact_id' | 'product_id' | 'team_id',
    string
  >
>;

export interface DrillDown {
  kpi_code: string;
  document_type: string;
  breadcrumb: string[];
  columns: string[];
  rows: Record<string, unknown>[];
  pagination: { page: number; per_page: number; total: number; last_page: number };
  deep_link: { route: string; query: Record<string, string | string[]> };
}

export interface LayoutWidget {
  kpi_code: string;
  widget_type?: WidgetType | null;
  default_time_comparison?: ComparisonMode | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutBody {
  dashboard_id?: string | null;
  role?: RoleCode;
  custom_title?: string | null;
  refresh_interval_seconds: number;
  expected_version?: number | null;
  widgets: LayoutWidget[];
}

export interface ThresholdBody {
  rule_id?: string | null;
  kpi_code: string;
  operator: AlertOperator;
  warning_value?: number | null;
  critical_value?: number | null;
  channels?: AlertChannel[];
  cooldown_minutes?: number;
  is_active?: boolean;
}

export interface ThresholdRule {
  id: string;
  kpi_code: string;
  operator: AlertOperator;
  warning_value: string | null;
  critical_value: string | null;
  channels: AlertChannel[];
  cooldown_minutes: number;
  is_active: boolean;
}

export interface KpiAlert {
  id: string;
  rule_id: string;
  kpi_code: string;
  severity: 'warning' | 'critical';
  observed_value: number;
  threshold_value: number;
  status: 'open' | 'acknowledged';
  channels: AlertChannel[];
  triggered_at: string;
  deep_link: string;
}
