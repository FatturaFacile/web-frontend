import { CpqFieldDef, CpqFieldOption } from './cpq-entity-drawer.component';

const option = (group: string, value: string): CpqFieldOption => ({
  value,
  labelKey: `CPQ_CONFIGURATOR.${group}.${value.toUpperCase()}`,
});

export const CPQ_CHARACTERISTIC_TYPES = ['list', 'range', 'boolean'] as const;
export const CPQ_RULE_TYPES = [
  'exclude_options',
  'force_value',
  'hide',
  'limit_range',
  'validate',
  'decision_table',
] as const;
export const CPQ_SEVERITIES = ['error', 'warning', 'info'] as const;
export const CPQ_EFFECTS = [
  'add_cost',
  'add_price',
  'set_price',
  'multiply_price',
  'discount_percent',
] as const;

/** The forms of the definition of a model. The label of a field is `CPQ_CONFIGURATOR.FIELD.<KEY>`, served by the API. */
export const CPQ_MODEL_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 40 },
  { key: 'name', type: 'i18n', required: true },
  { key: 'description', type: 'i18n', multiline: true },
  { key: 'part_number_prefix', type: 'text', required: true, max: 12 },
  { key: 'currency', type: 'text', max: 3 },
  { key: 'base_price', type: 'number', min: 0 },
  { key: 'base_cost', type: 'number', min: 0 },
  { key: 'base_lead_time_days', type: 'number', min: 0, max: 3650 },
  { key: 'target_margin_percent', type: 'number', min: 0, max: 99.99, step: 0.5 },
  { key: 'max_discount_percent', type: 'number', min: 0, max: 100, step: 0.5 },
  { key: 'steps', type: 'json' },
  { key: 'visual_base', type: 'json' },
  { key: 'proposal_texts', type: 'json' },
];

export const CPQ_NEW_MODEL_FIELDS: CpqFieldDef[] = CPQ_MODEL_FIELDS.filter(
  (field) => !['steps', 'visual_base', 'proposal_texts'].includes(field.key),
);

export const CPQ_CHARACTERISTIC_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 40, createOnly: true },
  {
    key: 'type',
    type: 'select',
    required: true,
    createOnly: true,
    options: CPQ_CHARACTERISTIC_TYPES.map((value) => option('TYPE', value)),
  },
  { key: 'step_code', type: 'text', max: 40 },
  { key: 'label', type: 'i18n', required: true },
  { key: 'help', type: 'i18n', multiline: true },
  { key: 'unit', type: 'text', max: 20 },
  { key: 'range_min', type: 'number' },
  { key: 'range_max', type: 'number' },
  { key: 'range_step', type: 'number', min: 0 },
  { key: 'default_value', type: 'text', max: 100 },
  { key: 'is_required', type: 'switch' },
  { key: 'part_number', type: 'json' },
  { key: 'visual', type: 'json' },
  { key: 'sort_order', type: 'number', min: 0 },
];

export const CPQ_OPTION_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 40, createOnly: true },
  { key: 'label', type: 'i18n', required: true },
  { key: 'description', type: 'i18n', multiline: true },
  { key: 'part_number_code', type: 'text', max: 12 },
  { key: 'is_default', type: 'switch' },
  { key: 'is_active', type: 'switch' },
  { key: 'properties', type: 'json' },
  { key: 'visual', type: 'json' },
  { key: 'sort_order', type: 'number', min: 0 },
];

export const CPQ_RULE_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 60, createOnly: true },
  {
    key: 'rule_type',
    type: 'select',
    required: true,
    options: CPQ_RULE_TYPES.map((value) => option('RULE_TYPE', value)),
  },
  { key: 'condition_expression', type: 'expression' },
  { key: 'target_characteristic', type: 'text', max: 40 },
  { key: 'target_options', type: 'json' },
  { key: 'forced_value', type: 'json' },
  { key: 'params', type: 'json' },
  { key: 'message', type: 'i18n', multiline: true },
  {
    key: 'severity',
    type: 'select',
    options: CPQ_SEVERITIES.map((value) => option('SEVERITY', value)),
  },
  { key: 'priority', type: 'number', min: 0 },
  { key: 'is_active', type: 'switch' },
];

export const CPQ_BOM_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 60, createOnly: true },
  { key: 'item_code', type: 'text', required: true, max: 50 },
  { key: 'item_name', type: 'i18n', required: true },
  { key: 'uom', type: 'text', max: 20 },
  { key: 'condition_expression', type: 'expression' },
  { key: 'quantity_formula', type: 'expression' },
  { key: 'unit_cost', type: 'number', min: 0 },
  { key: 'unit_cost_formula', type: 'expression' },
  { key: 'lead_time_days', type: 'number', min: 0 },
  { key: 'auto_include_message', type: 'i18n', multiline: true },
  { key: 'sort_order', type: 'number', min: 0 },
  { key: 'is_active', type: 'switch' },
];

export const CPQ_ROUTING_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 60, createOnly: true },
  { key: 'operation_name', type: 'i18n', required: true },
  { key: 'work_center', type: 'text', required: true, max: 50 },
  { key: 'condition_expression', type: 'expression' },
  { key: 'setup_hours_formula', type: 'expression' },
  { key: 'run_hours_formula', type: 'expression' },
  { key: 'hourly_rate', type: 'number', min: 0 },
  { key: 'sort_order', type: 'number', min: 0 },
  { key: 'is_active', type: 'switch' },
];

export const CPQ_PRICING_FIELDS: CpqFieldDef[] = [
  { key: 'code', type: 'text', required: true, max: 60, createOnly: true },
  { key: 'label', type: 'i18n', required: true },
  {
    key: 'effect',
    type: 'select',
    required: true,
    options: CPQ_EFFECTS.map((value) => option('EFFECT', value)),
  },
  { key: 'condition_expression', type: 'expression' },
  { key: 'formula', type: 'expression', required: true },
  { key: 'sort_order', type: 'number', min: 0 },
  { key: 'is_active', type: 'switch' },
];
