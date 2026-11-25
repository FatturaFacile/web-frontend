/**
 * Technical-commercial CPQ configurator (Mod 230): product models, guided evaluation with constraints, super-BOM, routing,
 * pricing, configured instances and proposals. Every label and message comes from the API in the language of the request.
 */

/** A text stored in the four languages of the platform. */
export type CpqLocalizedText = Partial<Record<'it' | 'en' | 'de' | 'fr', string>>;

export type CpqCharacteristicType = 'list' | 'range' | 'boolean';
export type CpqModelStatus = 'draft' | 'published' | 'archived';
export type CpqSelectionValue = string | number | boolean | null;
export type CpqRuleType =
  'exclude_options' | 'force_value' | 'hide' | 'limit_range' | 'validate' | 'decision_table';
export type CpqSeverity = 'error' | 'warning' | 'info';
export type CpqPricingEffect =
  'add_cost' | 'add_price' | 'set_price' | 'multiply_price' | 'discount_percent';

export interface CpqConfiguratorEnvelope<T> {
  data: T;
  meta?: { reused?: boolean };
}

// --- Definition (management) ---

export interface CpqStepDefinition {
  code: string;
  title: CpqLocalizedText;
  description?: CpqLocalizedText | null;
}

export interface CpqOptionRecord {
  id: string;
  characteristic_id: string;
  code: string;
  label: CpqLocalizedText;
  description: CpqLocalizedText | null;
  display: string;
  part_number_code: string | null;
  is_default: boolean;
  is_active: boolean;
  properties: Record<string, unknown> | null;
  visual: Record<string, unknown> | null;
  sort_order: number;
}

export interface CpqCharacteristicRecord {
  id: string;
  model_id: string;
  code: string;
  step_code: string | null;
  type: CpqCharacteristicType;
  label: CpqLocalizedText;
  help: CpqLocalizedText | null;
  display: string;
  unit: string | null;
  range_min: string | null;
  range_max: string | null;
  range_step: string | null;
  default_value: string | null;
  is_required: boolean;
  part_number: Record<string, unknown> | null;
  visual: Record<string, unknown> | null;
  sort_order: number;
  options?: CpqOptionRecord[];
}

export interface CpqRuleRecord {
  id: string;
  model_id: string;
  code: string;
  rule_type: CpqRuleType;
  condition_expression: string | null;
  target_characteristic: string | null;
  target_options: string[] | null;
  forced_value: unknown;
  params: Record<string, unknown> | null;
  message: CpqLocalizedText | null;
  severity: CpqSeverity;
  priority: number;
  is_active: boolean;
}

export interface CpqBomMappingRecord {
  id: string;
  model_id: string;
  code: string;
  item_code: string;
  item_name: CpqLocalizedText;
  display: string;
  uom: string;
  condition_expression: string | null;
  quantity_formula: string;
  unit_cost: string;
  unit_cost_formula: string | null;
  lead_time_days: number;
  auto_include_message: CpqLocalizedText | null;
  sort_order: number;
  is_active: boolean;
}

export interface CpqRoutingMappingRecord {
  id: string;
  model_id: string;
  code: string;
  operation_name: CpqLocalizedText;
  display: string;
  work_center: string;
  condition_expression: string | null;
  setup_hours_formula: string;
  run_hours_formula: string;
  hourly_rate: string;
  sort_order: number;
  is_active: boolean;
}

export interface CpqPricingFormulaRecord {
  id: string;
  model_id: string;
  code: string;
  label: CpqLocalizedText;
  display: string;
  effect: CpqPricingEffect;
  condition_expression: string | null;
  formula: string;
  sort_order: number;
  is_active: boolean;
}

export interface CpqModelRecord {
  id: string;
  code: string;
  name: CpqLocalizedText;
  display: string;
  description: CpqLocalizedText | null;
  currency: string;
  base_price: string;
  base_cost: string;
  base_lead_time_days: number;
  target_margin_percent: string | null;
  max_discount_percent: string;
  part_number_prefix: string;
  part_number_sequence: number;
  steps: CpqStepDefinition[] | null;
  visual_base: Record<string, unknown> | null;
  proposal_texts: Record<string, unknown> | null;
  status: CpqModelStatus;
  version: number;
  published_at: string | null;
  characteristics?: CpqCharacteristicRecord[];
  rules?: CpqRuleRecord[];
  bom_mappings?: CpqBomMappingRecord[];
  routing_mappings?: CpqRoutingMappingRecord[];
  pricing_formulas?: CpqPricingFormulaRecord[];
}

/** Payload of a write: the columns of the record, texts as {it, en, de, fr} maps. */
export type CpqRecordPayload = Record<string, unknown>;

export interface CpqDiagnosticIssue {
  severity: 'error' | 'warning';
  code: string;
  scope: string;
  params: Record<string, unknown>;
}

export interface CpqDiagnostics {
  ok: boolean;
  issues: CpqDiagnosticIssue[];
}

export interface CpqExpressionCheck {
  valid: boolean;
  error: string | null;
  variables: string[];
  unknown: string[];
}

// --- Evaluation (guided configuration) ---

export interface CpqEvaluationRequest {
  selections: Record<string, CpqSelectionValue>;
  quantity?: number;
  discount_percent?: number;
  customer_reference?: string | null;
  include_breakdown?: boolean;
}

export interface CpqViolation {
  code: string;
  severity: CpqSeverity;
  characteristic: string | null;
  characteristic_label: string | null;
  rule: string | null;
  /** The explanation written in the rule, in the language of the request; null for the violations of the system. */
  message: string | null;
  params: Record<string, unknown>;
}

export interface CpqAutoIncluded {
  characteristic: string;
  characteristic_label: string;
  value: CpqSelectionValue;
  value_label: string | null;
  rule: string;
  message: string;
  overridden: boolean;
}

export interface CpqEvalOption {
  code: string;
  label: string;
  description: string | null;
  disabled: boolean;
  reasons: string[];
  selected: boolean;
  properties: Record<string, unknown>;
}

export interface CpqEvalCharacteristic {
  code: string;
  step: string | null;
  type: CpqCharacteristicType;
  label: string;
  help: string | null;
  unit: string | null;
  required: boolean;
  visible: boolean;
  value: CpqSelectionValue;
  min: number | null;
  max: number | null;
  step_size: number | null;
  forced: boolean;
  forced_message: string | null;
  options: CpqEvalOption[];
}

export interface CpqEvalStep {
  code: string;
  title: string | null;
  description: string | null;
  characteristics: string[];
  status: 'complete' | 'incomplete' | 'error';
}

export interface CpqBomLine {
  code: string;
  item_code: string;
  name: string;
  uom: string;
  quantity: number;
  /** Cost fields are absent for who may not see the industrial figures. */
  unit_cost?: number;
  line_cost?: number;
  lead_time_days: number;
  auto_include_message: string | null;
}

export interface CpqRoutingStep {
  code: string;
  operation: string;
  work_center: string;
  setup_hours: number;
  run_hours: number;
  hours: number;
  hourly_rate?: number;
  cost?: number;
}

export interface CpqPricingComponent {
  code: string;
  label: string;
  effect: CpqPricingEffect;
  value: number;
}

export interface CpqTotals {
  currency: string;
  quantity: number;
  list_price: number;
  discount_percent: number;
  selling_price: number;
  total_selling_price: number;
  lead_time_days: number;
  routing_hours: number;
  base_cost?: number;
  bom_cost?: number;
  routing_cost?: number;
  industrial_cost?: number;
  margin_amount?: number;
  margin_percent?: number;
  target_margin_applied?: boolean;
}

export interface CpqVisualLayer {
  id: string;
  characteristic: string;
  option: string | null;
  label: string | null;
  kind: string;
  shape: string;
  color: string;
  z: number;
  slot: number | null;
  auto_included: boolean;
  visible: boolean;
}

export interface CpqVisualBase {
  shape?: string;
  color?: string;
  label?: string;
  scale_factor?: number;
}

export interface CpqVisual {
  base: CpqVisualBase;
  layers: CpqVisualLayer[];
  views: string[];
}

export interface CpqEvaluation {
  model: { id: string; code: string; name: string; version: number; currency: string };
  valid: boolean;
  complete: boolean;
  missing: string[];
  values: Record<string, CpqSelectionValue>;
  violations: CpqViolation[];
  auto_included: CpqAutoIncluded[];
  steps: CpqEvalStep[];
  characteristics: CpqEvalCharacteristic[];
  bom: CpqBomLine[];
  routing: CpqRoutingStep[];
  pricing: { components: CpqPricingComponent[]; errors: { code: string; message: string }[] };
  totals: CpqTotals;
  visual: CpqVisual;
  configuration_hash: string;
  part_number_preview: string;
  deduplication: {
    hash: string;
    existing: boolean;
    part_number: string | null;
    instance_id: string | null;
  };
}

// --- Instances and proposals ---

export interface CpqInstance {
  id: string;
  model_id: string;
  model_version: number;
  configuration_hash: string;
  part_number: string;
  configuration: { model: string; version: number; values: Record<string, string> };
  currency: string;
  list_price: string;
  selling_price: string;
  lead_time_days: number;
  status: string;
  mfg_item_id: string | null;
  mfg_bom_id: string | null;
  customer_reference: string | null;
  reuse_count: number;
  confirmed_at: string | null;
  created_at: string | null;
  industrial_cost?: string;
  margin_amount?: string;
  margin_percent?: string;
}

export interface CpqProposalDossier {
  document: {
    reference: string | null;
    generated_at: string;
    valid_days: number;
    locale: string;
    currency: string;
    customer: string | null;
    confirmed: boolean;
  };
  product: {
    model_code: string;
    model_name: string;
    description: string | null;
    part_number: string | null;
    version: number;
    hash: string | null;
  };
  texts: {
    title: string | null;
    intro: string | null;
    warranty: string | null;
    terms: string | null;
    delivery: string | null;
    installation: string | null;
  };
  specification: {
    step: string | null;
    rows: { label: string; value: string | null; unit: string | null; auto_included: boolean }[];
  }[];
  auto_included: { characteristic_label: string; value_label: string | null; message: string }[];
  visual: {
    layers: {
      id: string;
      label: string | null;
      kind: string;
      color: string;
      z: number;
      auto_included: boolean;
    }[];
  };
  dimensional_notes: string[];
  bom: { item_code: string; name: string; quantity: number; uom: string }[];
  commercial: {
    quantity: number;
    list_price: number;
    discount_percent: number;
    unit_price: number;
    total_price: number;
    lead_time_days: number;
  };
  breakdown: {
    industrial_cost: number;
    bom_cost: number;
    routing_cost: number;
    margin_amount: number;
    margin_percent: number;
  } | null;
}

export interface CpqProposal {
  dossier: CpqProposalDossier;
  html: string;
}
