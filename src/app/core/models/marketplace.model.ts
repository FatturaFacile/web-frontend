/** Connector marketplace. Mirrors the API FormRequests and resources of the Marketplace module. */

export type MarketplaceCategory = 'ecommerce' | 'shipping' | 'payment' | 'accounting_export' | 'automation';
export type MarketplaceInstallationStatus = 'pending_configuration' | 'disabled' | 'enabled';
export type MarketplaceHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';
export type MarketplaceRunStatus = 'running' | 'succeeded' | 'failed' | 'rate_limited';
export type MarketplaceFieldType = 'string' | 'url' | 'secret' | 'number' | 'boolean' | 'select';

export const MARKETPLACE_CATEGORIES: readonly MarketplaceCategory[] = ['ecommerce', 'shipping', 'payment', 'accounting_export', 'automation'];
export const MARKETPLACE_INSTALLATION_STATUSES: readonly MarketplaceInstallationStatus[] = ['pending_configuration', 'disabled', 'enabled'];
export const MARKETPLACE_RUN_STATUSES: readonly MarketplaceRunStatus[] = ['running', 'succeeded', 'failed', 'rate_limited'];

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface MarketplaceResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface MarketplaceConfigField {
  key: string;
  label: string;
  type: MarketplaceFieldType;
  required: boolean;
  options: string[];
  default: string | number | boolean | null;
  help: string | null;
}

export interface MarketplaceConnector {
  key: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  version: string;
  vendor: string | null;
  documentation_url: string | null;
  config_schema: MarketplaceConfigField[];
  required_scopes: string[];
  resources: string[];
  rate_limit_per_minute: number;
  max_rate_limit_per_minute: number;
  installations: number;
}

export interface MarketplaceInstallation {
  id: string;
  connector_key: string;
  connector_name: string | null;
  category: MarketplaceCategory | null;
  connector_version: string;
  latest_version: string | null;
  update_available: boolean;
  name: string;
  status: MarketplaceInstallationStatus;
  settings: Record<string, string | number | boolean>;
  /** Keys of the credentials that hold a value; the values are never returned. */
  credentials_set: string[];
  granted_scopes: string[];
  rate_limit_per_minute: number | null;
  effective_rate_limit_per_minute: number | null;
  configured_at: string | null;
  enabled_at: string | null;
  disabled_at: string | null;
  health: { status: MarketplaceHealthStatus; checked_at: string | null; message: string | null };
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceInstallRequest {
  connector_key: string;
  name: string;
  granted_scopes: string[];
}

export interface MarketplaceConfigureRequest {
  config: Record<string, string | number | boolean>;
  rate_limit_per_minute?: number | null;
}

export interface MarketplaceSyncRun {
  id: string;
  installation_id: string;
  installation_name?: string | null;
  resource: string;
  trigger: 'manual' | 'schedule';
  status: MarketplaceRunStatus;
  started_at: string;
  finished_at: string | null;
  records_processed: number;
  records_failed: number;
  message: string | null;
}

export interface MarketplaceHealthCheck {
  id: string;
  installation_id: string;
  status: Exclude<MarketplaceHealthStatus, 'unknown'>;
  latency_ms: number | null;
  message: string | null;
  checked_at: string;
}

export interface MarketplaceOverview {
  installations: number;
  by_status: Record<MarketplaceInstallationStatus, number>;
  unhealthy: MarketplaceInstallation[];
  updates_available: MarketplaceInstallation[];
  recent_problem_runs: MarketplaceSyncRun[];
}

/** The fields of a schema that hold credentials: they are write-only. */
export function marketplaceSecretFields(connector: Pick<MarketplaceConnector, 'config_schema'>): MarketplaceConfigField[] {
  return connector.config_schema.filter((field) => field.type === 'secret');
}
