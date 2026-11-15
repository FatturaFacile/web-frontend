/** Business intelligence on the semantic layer. Mirrors the API FormRequests and resources of the BusinessIntelligence module. */

export type BiVisibility = 'private' | 'company' | 'shared';
export type BiWidgetType = 'kpi' | 'table' | 'bar' | 'line' | 'pie' | 'pivot';
export type BiSharePermission = 'view' | 'edit';
export type BiShareResourceType = 'dashboard' | 'saved_query';
export type BiSnapshotFrequency = 'daily' | 'weekly' | 'monthly';
export type BiMeasureUnit = 'currency' | 'count' | 'quantity' | 'percent' | 'number';
export type BiDimensionType = 'string' | 'number' | 'date' | 'boolean';

export const BI_WIDGET_TYPES: readonly BiWidgetType[] = ['kpi', 'table', 'bar', 'line', 'pie', 'pivot'];
export const BI_SNAPSHOT_FREQUENCIES: readonly BiSnapshotFrequency[] = ['daily', 'weekly', 'monthly'];
export const BI_PERIOD_PRESETS: readonly string[] = ['month_to_date', 'last_month', 'quarter_to_date', 'year_to_date', 'last_30_days', 'last_12_months'];
export const BI_GRID_COLUMNS = 12;

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface BiResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface BiDimension {
  key: string;
  label: string;
  type: BiDimensionType;
  operators: string[];
  granularities: string[];
}

export interface BiMeasure {
  key: string;
  label: string;
  unit: BiMeasureUnit;
}

export interface BiDataset {
  key: string;
  label: string;
  description: string;
  module: string;
  supports_period: boolean;
  period_dimension: string | null;
  dimensions: BiDimension[];
  measures: BiMeasure[];
  calculated_measures: { key: string; label: string; unit: BiMeasureUnit; formula: string }[];
}

export interface BiCalculatedMeasure {
  id: string;
  dataset: string;
  key: string;
  label: string;
  formula: string;
  unit: BiMeasureUnit;
  scale: number;
  created_at: string;
  updated_at: string;
}

export interface BiCalculatedMeasureRequest {
  dataset?: string;
  key?: string;
  label: string;
  formula: string;
  unit?: BiMeasureUnit;
  scale?: number;
}

export interface BiFilter {
  field: string;
  operator: string;
  value?: unknown;
}

export interface BiPeriod {
  preset?: string;
  from?: string;
  to?: string;
}

/** Specification of the semantic layer: every field is a key of the dataset, never SQL. */
export interface BiSpec {
  dimensions: string[];
  measures: string[];
  filters?: BiFilter[];
  sort?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number | null;
  period?: BiPeriod | null;
  compare?: 'none' | 'previous_period' | 'previous_year';
}

export interface BiPivotLayout {
  rows: string[];
  columns: string[];
  values: string[];
}

export interface BiSavedQuery {
  id: string;
  owner_id: string;
  owner_name?: string | null;
  is_owner: boolean;
  can_edit: boolean;
  name: string;
  description: string | null;
  dataset: string;
  spec: BiSpec;
  calculated_measures: string[];
  pivot: BiPivotLayout | null;
  visibility: BiVisibility;
  snapshot_frequency: BiSnapshotFrequency | null;
  next_snapshot_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface BiSavedQueryRequest {
  name: string;
  description?: string | null;
  dataset: string;
  spec: BiSpec;
  calculated_measures?: string[];
  pivot?: BiPivotLayout | null;
  visibility?: 'private' | 'company';
  snapshot_frequency?: BiSnapshotFrequency | null;
}

export interface BiExplorerRequest {
  dataset: string;
  spec: BiSpec;
  calculated_measures?: string[];
  pivot?: BiPivotLayout | null;
}

export interface BiQueryColumn {
  key: string;
  label: string;
  kind: 'dimension' | 'measure' | 'comparison';
  type?: BiDimensionType;
  unit?: BiMeasureUnit;
  calculated?: boolean;
}

export interface BiQueryResult {
  columns: BiQueryColumn[];
  rows: Record<string, string | number | boolean | null>[];
  meta: { truncated: boolean; row_count: number; row_limit: number; [key: string]: unknown };
}

export interface BiPivotResult {
  row_dimensions: { key: string; label: string }[];
  column_dimensions: { key: string; label: string }[];
  values: { key: string; label: string; unit: BiMeasureUnit | null; additive: boolean }[];
  columns: { members: (string | null)[] }[];
  rows: {
    members: (string | null)[];
    cells: Record<string, Record<string, string | number | null>>;
    totals: Record<string, string | number | null>;
  }[];
  column_totals: Record<string, Record<string, string | number | null>>;
  grand_totals: Record<string, string | number | null>;
}

export interface BiQueryOutcome {
  result: BiQueryResult;
  pivot: BiPivotResult | null;
}

export interface BiWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BiWidgetConfig {
  drill_path?: string[];
  pivot?: BiPivotLayout;
}

export interface BiWidget {
  id: string;
  dashboard_id: string;
  saved_query_id: string | null;
  title: string;
  widget_type: BiWidgetType;
  dataset: string | null;
  spec: BiSpec | null;
  calculated_measures: string[];
  config: BiWidgetConfig;
  layout: BiWidgetLayout;
}

export interface BiWidgetRequest {
  title: string;
  widget_type: BiWidgetType;
  saved_query_id?: string | null;
  dataset?: string | null;
  spec?: BiSpec | null;
  calculated_measures?: string[];
  config?: BiWidgetConfig | null;
  layout?: Partial<BiWidgetLayout> | null;
}

export interface BiDashboardFilters {
  period?: BiPeriod;
  filters?: BiFilter[];
}

export interface BiDashboard {
  id: string;
  owner_id: string;
  owner_name?: string | null;
  is_owner: boolean;
  can_edit: boolean;
  name: string;
  description: string | null;
  visibility: BiVisibility;
  filters: BiDashboardFilters;
  widgets?: BiWidget[];
  created_at: string;
  updated_at: string;
}

export interface BiDashboardRequest {
  name: string;
  description?: string | null;
  visibility?: 'private' | 'company';
  filters?: BiDashboardFilters | null;
}

export interface BiDrillStep {
  dimension: string;
  value: string | null;
}

export interface BiWidgetDataFilters {
  period?: BiPeriod;
  filters?: BiFilter[];
  drill?: BiDrillStep[];
}

export interface BiWidgetData {
  widget_id: string;
  status: 'ok' | 'error';
  error: string | null;
  result: BiQueryResult | null;
  pivot: BiPivotResult | null;
  drill: { path: string[]; level: number; current_dimension: string | null; next_dimension: string | null } | null;
}

export interface BiShare {
  id: string;
  resource_type: BiShareResourceType;
  resource_id: string;
  user_id: string;
  user_name?: string | null;
  permission: BiSharePermission;
  created_at: string;
}

/** A member of the company a resource can be shared with. */
export interface BiMember {
  id: string;
  name: string;
}

export interface BiShareRequest {
  resource_type: BiShareResourceType;
  resource_id: string;
  user_id: string;
  permission: BiSharePermission;
}

export interface BiSnapshot {
  id: string;
  source_type: BiShareResourceType;
  source_id: string;
  taken_by: string | null;
  taken_on: string;
  trigger: 'manual' | 'scheduled';
  status: 'ok' | 'failed';
  error: string | null;
  row_count: number;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface BiSnapshotComparison {
  taken_on: string;
  columns: BiQueryColumn[];
  rows: Record<string, string | null | { snapshot: string | number | null; current: string | number | null; change: string | number | null }>[];
}

export interface BiOverview {
  dashboards: number;
  saved_queries: number;
  scheduled_queries: number;
  calculated_measures: number;
  recent_dashboards: { id: string; name: string; updated_at: string | null }[];
  failed_snapshots: { id: string; source_id: string; taken_on: string; error: string | null }[];
}

/** First free place of the 12-column grid for a rectangle of the given size, scanning rows from the top (as the API does). */
export function biFreeSlot(others: BiWidgetLayout[], width = 6, height = 4): BiWidgetLayout {
  const w = Math.max(1, Math.min(width, BI_GRID_COLUMNS));
  const bottom = others.reduce((max, other) => Math.max(max, other.y + other.h), 0);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + w <= BI_GRID_COLUMNS; x++) {
      const candidate = { x, y, w, h: height };
      if (!others.some((other) => biLayoutsOverlap(candidate, other))) {
        return candidate;
      }
    }
  }
  return { x: 0, y: bottom, w, h: height };
}

export function biLayoutsOverlap(a: BiWidgetLayout, b: BiWidgetLayout): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
