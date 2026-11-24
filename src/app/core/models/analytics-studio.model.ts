/**
 * Report and pivot studio of the Analytics module (`modules/20_Analytics`): the governed catalog with its options, the
 * pivot matrix, the saved report definition and the cron schedules. The API is the contract.
 */
import {
  AnalyticsReportSpec,
  AnalyticsSemanticDataset,
  AnalyticsSpecFilter,
} from './analytics-designer.model';

export type StudioExportFormat = 'xlsx' | 'pdf' | 'csv' | 'excel_csv' | 'json';
export type StudioLocale = 'it-CH' | 'de-CH' | 'fr-CH' | 'it-IT' | 'en';
export type StudioVisibility = 'private' | 'role_shared' | 'tenant_public';
export type StudioChartType = 'bar' | 'stacked_bar' | 'line' | 'area' | 'pie' | 'donut' | 'combo';
export type StudioValueFormat = 'currency' | 'number' | 'percentage' | 'integer';

export interface StudioCatalogOptions {
  filter_logic: string[];
  filter_max_depth: number;
  measure_operators: string[];
  granularities: string[];
  period_presets: string[];
  max_dimensions: number;
  max_measures: number;
  formats: StudioExportFormat[];
  locales: StudioLocale[];
  chart_types: StudioChartType[];
  formatting_operators: string[];
  background_tokens: string[];
  text_tokens: string[];
  calculated: { functions: string[]; formats: StudioValueFormat[]; max_fields: number };
  visibilities: StudioVisibility[];
  delivery_channels: string[];
  schedule_modes: string[];
}

export interface StudioCatalog {
  datasets: AnalyticsSemanticDataset[];
  options: StudioCatalogOptions;
}

/** A group of conditions of the nested filter expression (`filter_tree`). */
export interface StudioFilterGroup {
  logic: 'and' | 'or';
  conditions: (AnalyticsSpecFilter | StudioFilterGroup)[];
}

export interface StudioCalculatedField {
  key: string;
  label: string;
  formula: string;
  format: StudioValueFormat;
}

export interface StudioFormattingRule {
  target: string;
  operator: string;
  value: string;
  value2?: string | null;
  background: string;
  text: string;
}

export interface StudioChartConfig {
  enabled: boolean;
  chartType: StudioChartType;
  xAxis: string | null;
  series: string[];
  showLegend: boolean;
  showDataLabels: boolean;
}

export interface StudioPivotLayout {
  rows: string[];
  columns: string[];
  subtotals: boolean;
  grand_totals: boolean;
}

/** The definition the studio runs, exports and saves. */
export interface StudioDefinition {
  dataset: string;
  spec: AnalyticsReportSpec & { filter_tree?: StudioFilterGroup | null };
  pivot: StudioPivotLayout;
  calculated_fields: StudioCalculatedField[];
  conditional_formatting: StudioFormattingRule[];
  chart_config: StudioChartConfig;
}

export interface StudioRunRequest extends StudioDefinition {
  format?: StudioExportFormat;
  locale?: StudioLocale;
}

export interface PivotDimensionColumn {
  key: string;
  label: string;
  type: string;
  granularity: string | null;
}

export interface PivotValueColumn {
  key: string;
  label: string;
  unit: string;
  format: StudioValueFormat;
  calculated: boolean;
}

export interface PivotCell {
  values: Record<string, string | number | null>;
  styles: Record<string, { background: string; text: string }>;
}

export interface PivotRow {
  type: 'data' | 'subtotal' | 'grand_total';
  level: number;
  keys: (string | null)[];
  label: string;
  cells: (PivotCell | null)[];
  total: PivotCell | null;
}

export interface PivotChart {
  type: StudioChartType;
  categories: string[];
  series: { name: string; data: (string | number | null)[] }[];
  show_legend: boolean;
  show_data_labels: boolean;
}

export interface PivotResult {
  row_dimensions: PivotDimensionColumn[];
  column_dimensions: PivotDimensionColumn[];
  values: PivotValueColumn[];
  column_headers: { index: number; tuple: (string | null)[]; label: string }[];
  has_total_column: boolean;
  rows: PivotRow[];
  chart: PivotChart | null;
  meta: { dataset: string; truncated: boolean; layout: StudioPivotLayout };
}

export interface StudioSavedReport {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  dataset: string;
  spec: StudioDefinition['spec'];
  pivot: Partial<StudioPivotLayout>;
  calculated_fields: StudioCalculatedField[];
  conditional_formatting: StudioFormattingRule[];
  chart_config: Partial<StudioChartConfig>;
  visibility: StudioVisibility;
  shared_role_ids: string[];
  is_shared: boolean;
  shared_with: string[];
  is_owner: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface StudioSaveReportRequest extends StudioDefinition {
  name: string;
  description?: string | null;
  visibility: StudioVisibility;
  shared_role_ids?: string[];
}

export interface StudioDeliveryChannels {
  email: boolean;
  telegram_chat_ids: string[];
  dms_folder_id: string | null;
  webhook_url: string | null;
}

export interface StudioSftpConfig {
  host: string;
  port?: number;
  username: string;
  password?: string;
  private_key?: string;
  path?: string;
}

export interface StudioSchedule {
  id: string;
  designed_report_id: string;
  name: string | null;
  frequency: string;
  cron_expression: string | null;
  timezone: string;
  locale: StudioLocale | null;
  format: StudioExportFormat;
  recipient_user_ids: string[];
  external_emails: string[];
  delivery_channels: StudioDeliveryChannels;
  sftp: { host: string; port: number; username: string; path: string; secret_set: boolean } | null;
  webhook_secret_set: boolean;
  is_active: boolean;
  next_run_at: string | null;
  next_run_on: string | null;
  last_run_at: string | null;
  last_status: 'ok' | 'failed' | null;
  last_error: string | null;
}

export interface StudioSaveScheduleRequest {
  designed_report_id: string;
  name?: string | null;
  cron_expression: string;
  timezone: string;
  locale: StudioLocale;
  format: StudioExportFormat;
  recipient_user_ids: string[];
  external_emails: string[];
  delivery_channels: StudioDeliveryChannels;
  sftp?: StudioSftpConfig | null;
  is_active: boolean;
}

export interface StudioScheduleOutcome {
  schedule: StudioSchedule;
  webhook_secret: string | null;
}

export interface StudioExecutionLog {
  id: string;
  designed_report_id: string | null;
  schedule_id: string | null;
  dataset: string;
  format: string;
  locale: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  row_count: number;
  truncated: boolean;
  duration_ms: number | null;
  size_bytes: number;
  error_message: string | null;
  executed_at: string | null;
}
