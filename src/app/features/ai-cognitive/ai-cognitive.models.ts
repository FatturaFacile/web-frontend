import { ConfidenceBands } from '../ai-forecasting/ai-forecasting.models';

/** Models of the AI Services and Cognitive Automation Layer (Mod 093, `/api/v1/ai`). */

export type SuggestionKind =
  | 'sales_quote'
  | 'purchase_order'
  | 'support_ticket'
  | 'contact'
  | 'accounting_coding'
  | 'reconciliation_match'
  | 'anomaly'
  | 'late_payment_risk'
  | 'churn_risk'
  | 'reorder'
  | 'cash_flow_alert';

export type SuggestionStatus =
  'pending' | 'auto_approved' | 'approved' | 'edited_approved' | 'rejected' | 'expired' | 'failed';

export type Priority = 'low' | 'normal' | 'high';

export type ConfidenceBand = 'high' | 'medium' | 'low';

export type DataClassification = 'public' | 'internal' | 'confidential_pii';

export type AiProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'azure_openai';

export interface SuggestionCitation {
  type: string;
  reference: string | null;
}

/** An item of the review queue: a proposed ERP action with its evidence. */
export interface AiSuggestion {
  id: string;
  kind: SuggestionKind;
  workflow: string;
  source_type: string;
  source_reference: string | null;
  source_text: string | null;
  proposed_payload: Record<string, unknown>;
  field_confidences: Record<string, number>;
  confidence: number;
  amount: number | null;
  reasoning: string | null;
  citations: SuggestionCitation[];
  status: SuggestionStatus;
  priority: Priority;
  provider_used: string | null;
  model_used: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_feedback: string | null;
  final_payload: Record<string, unknown> | null;
  resulting_entity_type: string | null;
  resulting_entity_id: string | null;
  expires_at: string | null;
  created_at: string | null;
}

export interface QueueMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  open_by_kind: Partial<Record<SuggestionKind, number>>;
}

export interface Envelope<T, M = undefined> {
  success: boolean;
  message: string;
  data: T;
  meta?: M;
}

export interface ProviderSetting {
  id: string;
  provider: AiProvider;
  label: string | null;
  is_enabled: boolean;
  is_default: boolean;
  is_local: boolean;
  endpoint: string | null;
  model: string | null;
  light_model: string | null;
  embedding_model: string | null;
  has_api_key: boolean;
  extra: Record<string, unknown>;
  max_data_classification: DataClassification;
  pii_masking_enabled: boolean;
  latency_sla_ms: number | null;
  monthly_token_budget: number | null;
  rate_limit_per_minute: number | null;
}

/** The body of `PUT /ai/settings/providers/{provider}`; a null key keeps the stored one. */
export interface ProviderForm {
  is_enabled: boolean;
  is_default: boolean;
  endpoint: string | null;
  model: string | null;
  light_model: string | null;
  embedding_model: string | null;
  api_key: string | null;
  extra: Record<string, string>;
  max_data_classification: DataClassification;
  pii_masking_enabled: boolean;
  monthly_token_budget: number | null;
  rate_limit_per_minute: number | null;
}

export interface AutomationRule {
  workflow: string;
  is_enabled: boolean;
  auto_approve_enabled: boolean;
  auto_approve_min_confidence: number;
  max_auto_amount: number | null;
  data_classification: DataClassification;
  preferred_provider: AiProvider | null;
  configured?: boolean;
}

export interface SupportedProvider {
  provider: AiProvider;
  is_local: boolean;
  endpoint: string | null;
  model: string | null;
  light_model: string | null;
  embedding_model: string | null;
}

export interface AiSettings {
  external_providers_allowed: boolean;
  providers: ProviderSetting[];
  rules: AutomationRule[];
  supported_providers: SupportedProvider[];
  data_classifications: DataClassification[];
}

export interface PaymentRiskRow {
  customer_id: string;
  customer_name: string | null;
  average_days_late: number;
  on_time_payment_probability: number;
  payment_risk_tier: 'low' | 'moderate' | 'high' | 'critical';
  predicted_collection_date_offset_days: number;
}

export interface PredictiveDashboard {
  cash_flow: ConfidenceBands | null;
  payment_risk: PaymentRiskRow[];
  recommendations: AiSuggestion[];
  anomalies: AiSuggestion[];
}

export interface UsageByProvider {
  provider: string;
  calls: number;
  total_tokens: number;
  cost_usd: number;
  cache_hits: number;
  failures: number;
}

export interface UsageAudit {
  period: { from: string; to: string };
  usage: { by_provider: UsageByProvider[]; total_tokens: number; total_cost_usd: number };
  chain: { valid: boolean; checked: number; broken_at: number | null } | null;
}

export interface QueueFilters {
  status?: SuggestionStatus | null;
  kind?: SuggestionKind | null;
  priority?: Priority | null;
  page?: number;
  perPage?: number;
}
