/**
 * Analytics semantic layer, report designer, designed reports, scheduled exports and KPI snapshots
 * (`modules/20_Analytics`). Mirrors the FormRequests of the module (the API is the contract).
 */

export type AnalyticsDimensionType = 'string' | 'number' | 'date' | 'boolean';
export type AnalyticsMeasureUnit = 'currency' | 'count' | 'quantity' | 'percent';
export type AnalyticsExportFormat = 'csv' | 'excel_csv' | 'xlsx';
export type AnalyticsExportFrequency = 'daily' | 'weekly' | 'monthly';
export type AnalyticsExportDelivery = 'email' | 'documents' | 'both';
export type AnalyticsPeriodPresetKey =
  | 'month_to_date'
  | 'last_month'
  | 'quarter_to_date'
  | 'year_to_date'
  | 'last_30_days'
  | 'last_12_months';
export type AnalyticsCompareMode = 'none' | 'previous_period' | 'previous_year';

export interface AnalyticsSemanticDimension {
  key: string;
  label: string;
  type: AnalyticsDimensionType;
  operators?: string[];
  granularities?: string[];
}

export interface AnalyticsSemanticMeasure {
  key: string;
  label: string;
  unit: AnalyticsMeasureUnit;
}

export interface AnalyticsSemanticDataset {
  key: string;
  label: string;
  description?: string;
  module: string;
  supports_period: boolean;
  period_dimension: string | null;
  dimensions: AnalyticsSemanticDimension[];
  measures: AnalyticsSemanticMeasure[];
}

export interface AnalyticsSpecFilter {
  field: string;
  operator: string;
  value?: unknown;
}

export interface AnalyticsSpecSort {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface AnalyticsReportSpec {
  dimensions?: string[];
  measures: string[];
  filters?: AnalyticsSpecFilter[];
  sort?: AnalyticsSpecSort[];
  limit?: number | null;
  period?: { preset?: AnalyticsPeriodPresetKey; from?: string; to?: string } | null;
  compare?: AnalyticsCompareMode;
}

export interface AnalyticsReportColumn {
  key: string;
  label: string;
  kind: 'dimension' | 'measure' | 'comparison';
}

export interface AnalyticsReportResult {
  columns: AnalyticsReportColumn[];
  rows: Record<string, unknown>[];
  meta: {
    dataset: string;
    page: number;
    per_page: number;
    total: number;
    pages: number;
    truncated: boolean;
    row_limit: number;
    period: Record<string, unknown> | null;
    comparison_period: Record<string, unknown> | null;
  };
}

/** Body of `POST designer/run` and `POST designer/export` (`DesignerRequest`). */
export interface AnalyticsDesignerRequest {
  dataset: string;
  spec: AnalyticsReportSpec;
  page?: number;
  per_page?: number;
  format?: AnalyticsExportFormat;
}

export interface AnalyticsDesignedReport {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  dataset: string;
  spec: AnalyticsReportSpec;
  is_shared: boolean;
  shared_with: string[];
  is_owner: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/** Body of the designed report store and update (`SaveDesignedReportRequest`). */
export interface AnalyticsSaveDesignedReportRequest {
  name: string;
  description?: string | null;
  dataset: string;
  spec: AnalyticsReportSpec;
  is_shared?: boolean;
  shared_with?: string[];
}

export interface AnalyticsExportSchedule {
  id: string;
  user_id: string;
  designed_report_id: string;
  frequency: AnalyticsExportFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  format: AnalyticsExportFormat;
  delivery: AnalyticsExportDelivery;
  recipients: string[];
  is_active: boolean;
  next_run_on: string | null;
  last_run_at: string | null;
  last_status: 'ok' | 'failed' | null;
  last_error: string | null;
}

/** Body of the export schedule store and update (`SaveExportScheduleRequest`). */
export interface AnalyticsSaveExportScheduleRequest {
  designed_report_id: string;
  frequency: AnalyticsExportFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  format?: AnalyticsExportFormat;
  delivery: AnalyticsExportDelivery;
  recipients?: string[];
  is_active?: boolean;
}

export interface AnalyticsKpiSnapshot {
  kpi: string;
  snapshot_date: string;
  period_from: string;
  period_to: string;
  value: string | null;
  details: Record<string, unknown> | null;
  computed_at: string;
}

export interface AnalyticsKpiSnapshotParams {
  kpi?: string;
  from?: string;
  to?: string;
}
