/**
 * Configure-price-quote (module `configurator`). Field names, enums and decimal strings mirror the FormRequests and
 * Resources of modules/46_Configurator in web-api; amounts travel as decimal strings.
 */

export type ConfiguratorModelStatus = 'draft' | 'published' | 'archived';

export type ConfiguratorGroupType = 'single' | 'multi' | 'range' | 'boolean';

export type ConfiguratorRuleType = 'requires' | 'excludes' | 'default' | 'price_rule';

export type ConfiguratorRuleOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

export type ConfiguratorPriceEffectType = 'amount' | 'percent';

export type ConfiguratorConfigurationStatus =
  | 'draft'
  | 'validated'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'converted';

export type ConfiguratorViolationCode =
  | 'unknown_group'
  | 'duplicate_group'
  | 'unknown_option'
  | 'option_not_in_group'
  | 'inactive_option'
  | 'single_choice_exceeded'
  | 'range_not_numeric'
  | 'range_out_of_bounds'
  | 'range_step_mismatch'
  | 'required_group_missing'
  | 'multi_below_min'
  | 'multi_above_max'
  | 'requires'
  | 'excludes';

export interface ConfiguratorEnvelope<T> {
  data: T;
}

export interface ConfiguratorVolumeBreak {
  min_quantity: number | string;
  discount_percent: number | string;
}

export interface ConfiguratorModel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  base_product_id: string | null;
  base_price_from_product: boolean;
  base_price: string;
  base_cost: string;
  currency: string;
  tax_rate: string;
  min_margin_percent: string | null;
  volume_breaks: ConfiguratorVolumeBreak[];
  status: ConfiguratorModelStatus;
  version: number;
  published_at: string | null;
  created_at: string;
  groups?: ConfiguratorGroup[];
  rules?: ConfiguratorRule[];
}

export interface ConfiguratorModelRequest {
  code?: string;
  name?: string;
  description?: string | null;
  base_product_id?: string | null;
  base_price_from_product?: boolean;
  base_price?: number | string;
  base_cost?: number | string;
  currency?: string;
  tax_rate?: number | string;
  min_margin_percent?: number | string | null;
  volume_breaks?: ConfiguratorVolumeBreak[] | null;
}

export interface ConfiguratorOption {
  id: string;
  group_id: string;
  code: string;
  name: string;
  description: string | null;
  price_delta: string;
  price_multiplier: string;
  cost: string;
  product_id: string | null;
  price_from_product: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ConfiguratorOptionRequest {
  code?: string;
  name?: string;
  description?: string | null;
  price_delta?: number | string;
  price_multiplier?: number | string;
  cost?: number | string;
  product_id?: string | null;
  price_from_product?: boolean;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface ConfiguratorGroup {
  id: string;
  model_id: string;
  code: string;
  name: string;
  type: ConfiguratorGroupType;
  is_required: boolean;
  min_select: number | null;
  max_select: number | null;
  range_min: string | null;
  range_max: string | null;
  range_step: string | null;
  default_value: string | null;
  unit: string | null;
  unit_price_delta: string;
  unit_cost: string;
  product_id: string | null;
  sort_order: number;
  options?: ConfiguratorOption[];
}

export interface ConfiguratorGroupRequest {
  code?: string;
  name?: string;
  type?: ConfiguratorGroupType;
  is_required?: boolean;
  min_select?: number | null;
  max_select?: number | null;
  range_min?: number | string | null;
  range_max?: number | string | null;
  range_step?: number | string | null;
  default_value?: number | string | null;
  unit?: string | null;
  unit_price_delta?: number | string;
  unit_cost?: number | string;
  product_id?: string | null;
  sort_order?: number;
}

export interface ConfiguratorRuleCondition {
  type: 'option' | 'range';
  option?: string | null;
  negate?: boolean;
  group?: string | null;
  operator?: ConfiguratorRuleOperator | null;
  value?: number | string | null;
}

export interface ConfiguratorRule {
  id: string;
  model_id: string;
  name: string;
  type: ConfiguratorRuleType;
  match: 'all' | 'any';
  conditions: ConfiguratorRuleCondition[];
  target_options: string[];
  price_effect_type: ConfiguratorPriceEffectType | null;
  price_effect_value: string | null;
  message: string | null;
  priority: number;
  is_active: boolean;
}

export interface ConfiguratorRuleRequest {
  name?: string;
  type?: ConfiguratorRuleType;
  match?: 'all' | 'any';
  conditions?: ConfiguratorRuleCondition[] | null;
  target_options?: string[] | null;
  price_effect_type?: ConfiguratorPriceEffectType | null;
  price_effect_value?: number | string | null;
  message?: string | null;
  priority?: number;
  is_active?: boolean;
}

export interface ConfiguratorRuleProblem {
  code: string;
  message: string;
  rule_ids: string[];
}

export interface ConfiguratorRuleCheck {
  valid: boolean;
  problems: ConfiguratorRuleProblem[];
}

/** The answer to one group: option codes for single, multiple and boolean groups, a number for a range. */
export interface ConfiguratorSelection {
  group: string;
  options?: string[];
  value?: number | string | null;
}

export interface ConfiguratorConfigurationRequest {
  model_id?: string;
  name?: string | null;
  selections: ConfiguratorSelection[];
  quantity?: number | string;
  contact_id?: string | null;
  price_list_id?: string | null;
  discount_percent?: number | string;
  apply_defaults?: boolean;
}

export interface ConfiguratorViolation {
  code: ConfiguratorViolationCode;
  severity: string;
  group: string | null;
  option: string | null;
  rule_id: string | null;
  message: string;
  params: Record<string, string | number>;
}

export interface ConfiguratorPricingLine {
  kind: 'base' | 'option' | 'range' | 'adjustment';
  code: string;
  description: string;
  product_id: string | null;
  quantity: string;
  unit_price: string;
  discount_percentage: string;
  tax_rate: string;
  line_total: string;
  price_source: string;
}

export interface ConfiguratorPricing {
  currency: string;
  quantity: string;
  multiplier: string;
  unit_list_price: string;
  unit_net_price: string;
  unit_cost: string;
  subtotal: string;
  discount_total: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
  total_cost: string;
  margin_amount: string;
  margin_percent: string | null;
  min_margin_percent: string;
  below_minimum_margin: boolean;
  requires_approval: boolean;
  volume_discount_percent: string;
  extra_discount_percent: string;
  lines: ConfiguratorPricingLine[];
  applied_rules: { rule_id: string; name: string; amount: string }[];
}

export interface ConfiguratorEvaluation {
  valid: boolean;
  violations: ConfiguratorViolation[];
  selections: ConfiguratorSelection[];
  applied_defaults: { group: string; option: string | null; source: string }[];
  pricing: ConfiguratorPricing;
}

export interface ConfiguratorConfiguration {
  id: string;
  model_id: string;
  model?: { id: string; code: string; name: string; version: number };
  number: string;
  name: string | null;
  contact_id: string | null;
  contact?: { id: string; name: string } | null;
  price_list_id: string | null;
  quantity: string;
  discount_percent: string;
  currency: string;
  selections: ConfiguratorSelection[];
  pricing: ConfiguratorPricing | null;
  total_net: string;
  total_cost: string;
  margin_percent: string | null;
  min_margin_percent: string | null;
  requires_approval: boolean;
  status: ConfiguratorConfigurationStatus;
  model_version: number | null;
  created_by: string | null;
  validated_at: string | null;
  approval_requested_by: string | null;
  approval_requested_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  quote_id: string | null;
  quote_number?: string | null;
  converted_at: string | null;
  snapshot?: Record<string, unknown> | null;
  created_at: string;
}

export interface ConfiguratorQuoteRequest {
  date?: string | null;
  valid_until?: string | null;
  notes?: string | null;
}
