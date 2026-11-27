import {
  ObsConnector,
  ObsNoisyNeighbor,
  ObsProfilerSettings,
  ObsSlowEndpoint,
  ObsSlowQuery,
  ObsStatements,
} from '../app/core/models/observability.model';

export const obsConnector = (overrides: Partial<ObsConnector> = {}): ObsConnector => ({
  key: 'sdi',
  name_code: 'OBSERVABILITY.CONNECTOR.SDI',
  country: 'IT',
  group: 'fiscal',
  status: 'operational',
  uptime_24h: 100,
  uptime_7d: 99.9,
  avg_latency_ms: 120,
  last_latency_ms: 95,
  last_checked_at: '2027-07-10T10:00:00Z',
  last_error: null,
  tls_days_remaining: 80,
  maintenance_message: null,
  history: Array.from({ length: 24 }, (_, hour) => ({
    bucket: `2027-07-09T${String(hour).padStart(2, '0')}:00:00Z`,
    status: 'operational' as const,
  })),
  ...overrides,
});

export const obsSlowQuery = (overrides: Partial<ObsSlowQuery> = {}): ObsSlowQuery => ({
  fingerprint: 'fp-1',
  sql: 'select * from invoices where tenant_id = ? and status = ?',
  kind: 'slow',
  executions: 12,
  avg_ms: 410.5,
  max_ms: 980,
  last_captured_at: '2027-07-10T09:30:00Z',
  tenant_id: null,
  trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
  origin_type: 'route',
  origin: 'GET /api/v1/sales/invoices',
  n_plus_one: false,
  n_plus_one_count: 0,
  plan_status: 'available',
  plan: [
    {
      Plan: {
        'Node Type': 'Sort',
        'Total Cost': 120.5,
        'Plan Rows': 40,
        Plans: [
          {
            'Node Type': 'Seq Scan',
            'Relation Name': 'invoices',
            'Total Cost': 95.2,
            'Plan Rows': 1200,
            Filter: '(status = ?)',
          },
        ],
      },
    },
  ],
  suggested_indexes: [
    {
      table: 'invoices',
      columns: ['tenant_id', 'status'],
      sql: 'CREATE INDEX CONCURRENTLY idx_invoices_tenant_id_status ON invoices (tenant_id, status);',
      reason: 'Seq Scan on invoices filtered by tenant_id, status',
    },
  ],
  ...overrides,
});

export const obsSlowEndpoint = (overrides: Partial<ObsSlowEndpoint> = {}): ObsSlowEndpoint => ({
  method: 'GET',
  route: '/api/v1/sales/invoices',
  requests: 340,
  avg_ms: 220,
  p50_ms: 180,
  p95_ms: 640,
  p99_ms: 990,
  avg_db_queries: 14.2,
  avg_db_ms: 90,
  error_rate: 0.012,
  last_trace_id: null,
  ...overrides,
});

export const obsStatements = (overrides: Partial<ObsStatements> = {}): ObsStatements => ({
  available: true,
  reason: null,
  hint: null,
  statements: [{ query: 'select 1', calls: 10, mean_ms: 1.2, total_ms: 12, rows: 10 }],
  ...overrides,
});

export const obsNoisy = (overrides: Partial<ObsNoisyNeighbor> = {}): ObsNoisyNeighbor => ({
  tenant_id: 't-1',
  tenant_name: 'Alfa Srl',
  requests: 900,
  db_ms: 52000,
  share_pct: 61.5,
  flagged: true,
  ...overrides,
});

export const obsSettings = (overrides: Partial<ObsProfilerSettings> = {}): ObsProfilerSettings => ({
  slow_query_threshold_ms: 250,
  n_plus_one_threshold: 10,
  explain_enabled: true,
  alert_endpoint_p95_ms: 1000,
  alert_tenant_share_pct: 50,
  alert_connector_latency_ms: 3000,
  retention_days: 14,
  ...overrides,
});

export const obsEnvelope = <T>(data: T) => ({ success: true, message: '', data });
