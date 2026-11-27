/** Wire contracts of the observability module (issue #448): performance profiler (platform admin) and connector health. */

export interface ObsEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export type ObsConnectorStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';
export type ObsHistoryStatus = ObsConnectorStatus | 'unknown';
export type ObsConnectorKey =
  | 'sdi'
  | 'sts'
  | 'swissdec_elm'
  | 'zefix'
  | 'uid_register'
  | 'vies'
  | 'snb'
  | 'ecb'
  | 'ebill';
export type ObsConnectorGroup = 'fiscal' | 'registry' | 'rates' | 'payments';

export const OBS_CONNECTOR_STATUSES: readonly ObsConnectorStatus[] = [
  'operational',
  'degraded',
  'outage',
  'maintenance',
];
export const OBS_CONNECTOR_KEYS: readonly ObsConnectorKey[] = [
  'sdi',
  'sts',
  'swissdec_elm',
  'zefix',
  'uid_register',
  'vies',
  'snb',
  'ecb',
  'ebill',
];
export const OBS_CONNECTOR_GROUPS: readonly ObsConnectorGroup[] = ['fiscal', 'registry', 'rates', 'payments'];
export const OBS_PLAN_STATUSES = ['available', 'unsupported', 'skipped', 'failed'] as const;
export const OBS_STATEMENT_REASONS = ['not_postgres', 'extension_missing', 'permission_denied'] as const;
export const OBS_ORIGIN_TYPES = ['route', 'job', 'console'] as const;

export interface ObsHistoryBucket {
  bucket: string;
  status: ObsHistoryStatus;
}

export interface ObsConnector {
  key: ObsConnectorKey;
  name_code: string;
  country: 'IT' | 'CH' | 'EU';
  group: ObsConnectorGroup;
  status: ObsConnectorStatus;
  uptime_24h: number;
  uptime_7d: number;
  avg_latency_ms: number | null;
  last_latency_ms: number | null;
  last_checked_at: string | null;
  last_error: string | null;
  tls_days_remaining: number | null;
  maintenance_message: string | null;
  history: ObsHistoryBucket[];
}

export interface ObsConnectorStatusSummary {
  overall: ObsConnectorStatus;
  checked_at: string | null;
  connectors: ObsConnector[];
}

export interface ObsConnectorCheck {
  checked_at: string;
  status: ObsConnectorStatus;
  latency_ms: number | null;
  http_status: number | null;
  error: string | null;
}

export interface ObsConnectorHistory {
  connector: ObsConnector;
  checks: ObsConnectorCheck[];
}

export interface ObsSuggestedIndex {
  table: string;
  columns: string[];
  sql: string;
  reason: string;
}

/** A node of a PostgreSQL `EXPLAIN (FORMAT JSON)` plan. */
export interface ObsPlanNode {
  'Node Type'?: string;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Total Cost'?: number;
  'Plan Rows'?: number;
  Filter?: string;
  Plans?: ObsPlanNode[];
  [key: string]: unknown;
}

export interface ObsSlowQuery {
  fingerprint: string;
  sql: string;
  kind: 'slow' | 'n_plus_one';
  executions: number;
  avg_ms: number;
  max_ms: number;
  last_captured_at: string;
  tenant_id: string | null;
  trace_id: string | null;
  origin_type: (typeof OBS_ORIGIN_TYPES)[number] | null;
  origin: string | null;
  n_plus_one: boolean;
  n_plus_one_count: number;
  plan_status: (typeof OBS_PLAN_STATUSES)[number];
  plan: ObsPlanNode | { Plan?: ObsPlanNode }[] | { Plan?: ObsPlanNode } | null;
  suggested_indexes: ObsSuggestedIndex[];
}

export interface ObsSlowEndpoint {
  method: string;
  route: string;
  requests: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  avg_db_queries: number;
  avg_db_ms: number;
  error_rate: number;
  last_trace_id: string | null;
}

export interface ObsStatement {
  query: string;
  calls: number;
  mean_ms: number;
  total_ms: number;
  rows: number;
}

export interface ObsStatements {
  available: boolean;
  reason: (typeof OBS_STATEMENT_REASONS)[number] | null;
  hint: string | null;
  statements: ObsStatement[];
}

export interface ObsNoisyNeighbor {
  tenant_id: string;
  tenant_name: string | null;
  requests: number;
  db_ms: number;
  share_pct: number;
  flagged: boolean;
}

export interface ObsProfilerSettings {
  slow_query_threshold_ms: number;
  n_plus_one_threshold: number;
  explain_enabled: boolean;
  alert_endpoint_p95_ms: number;
  alert_tenant_share_pct: number;
  alert_connector_latency_ms: number;
  retention_days: number;
}
