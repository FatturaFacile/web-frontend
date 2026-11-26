import type {
  WorkflowApprovalMatrix,
  WorkflowApproverType,
  WorkflowMatrixCondition,
  WorkflowMatrixOperator,
  WorkflowMatrixTier,
  WorkflowSaveMatrixRequest,
} from '@core';

export const MATRIX_OPERATORS: readonly WorkflowMatrixOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in', 'between'];
export const MATRIX_FIELDS: readonly string[] = [
  'amount',
  'currency',
  'cost_center_id',
  'category',
  'new_supplier',
  'discount_percent',
  'company_id',
];
export const APPROVER_TYPES: readonly WorkflowApproverType[] = ['role', 'user', 'reporting_manager'];
export const APPROVAL_TYPES = ['single', 'and_parallel', 'or_parallel', 'majority'] as const;

/** A condition as the editor holds it: the value stays a text until the matrix is saved. */
export interface EditableCondition {
  field: string;
  operator: WorkflowMatrixOperator;
  valueText: string;
}

export interface EditableMatrix {
  id: string | null;
  code: string;
  name: string;
  subject_type: string;
  currency: string;
  priority: number;
  is_active: boolean;
  is_default: boolean;
  auto_approve_below: number | null;
  /** Fallback approver, used when no approver of the tiers can be resolved (null type: none). */
  fallbackType: WorkflowApproverType | null;
  fallbackValue: string;
  conditions: EditableCondition[];
  tiers: WorkflowMatrixTier[];
}

const LIST_OPERATORS: readonly WorkflowMatrixOperator[] = ['in', 'not_in', 'between'];

export function emptyTier(level: number): WorkflowMatrixTier {
  return {
    tier_level: level,
    threshold_min: null,
    threshold_max: null,
    approver_type: 'role',
    approver_value: '',
    approval_type: 'single',
  };
}

export function emptyCondition(): EditableCondition {
  return { field: 'amount', operator: 'gte', valueText: '' };
}

/** Next free priority: matrices are evaluated by ascending priority, so a new one goes last. */
export function nextPriority(matrices: readonly { priority: number }[]): number {
  return matrices.reduce((max, matrix) => Math.max(max, matrix.priority), 0) + 10;
}

export function emptyMatrix(subjectType = '', priority = 10, currency = 'CHF'): EditableMatrix {
  return {
    id: null,
    code: '',
    name: '',
    subject_type: subjectType,
    currency,
    priority,
    is_active: true,
    is_default: false,
    auto_approve_below: null,
    fallbackType: null,
    fallbackValue: '',
    conditions: [emptyCondition()],
    tiers: [emptyTier(1)],
  };
}

/** Level of the next tier: a new level runs after the existing ones. */
export function nextTierLevel(tiers: readonly WorkflowMatrixTier[]): number {
  return tiers.reduce((max, tier) => Math.max(max, tier.tier_level), 0) + 1;
}

/** Parses the text of a condition value: a list for in / not_in / between, numbers where they look like numbers. */
export function parseConditionValue(operator: WorkflowMatrixOperator, text: string): WorkflowMatrixCondition['value'] {
  const scalar = (raw: string): string | number => {
    const trimmed = raw.trim();
    return trimmed !== '' && Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed;
  };
  if (LIST_OPERATORS.includes(operator)) {
    return text
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
      .map(scalar);
  }
  const trimmed = text.trim();
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed === 'true';
  }
  return scalar(text);
}

export function conditionValueText(condition: WorkflowMatrixCondition): string {
  return Array.isArray(condition.value) ? condition.value.join(', ') : String(condition.value);
}

export function toEditable(matrix: WorkflowApprovalMatrix): EditableMatrix {
  return {
    id: matrix.id,
    code: matrix.code,
    name: matrix.name,
    subject_type: matrix.subject_type,
    currency: matrix.currency,
    priority: matrix.priority,
    is_active: matrix.is_active,
    is_default: matrix.is_default,
    auto_approve_below: matrix.auto_approve_below ?? null,
    fallbackType: matrix.fallback_approver?.approver_type ?? null,
    fallbackValue: matrix.fallback_approver?.approver_value ?? '',
    conditions: matrix.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      valueText: conditionValueText(condition),
    })),
    tiers: matrix.tiers.map((tier) => ({ ...tier })),
  };
}

function cleanTier(tier: WorkflowMatrixTier): WorkflowMatrixTier {
  return {
    ...(tier.id ? { id: tier.id } : {}),
    tier_level: tier.tier_level,
    threshold_min: tier.threshold_min ?? null,
    threshold_max: tier.threshold_max ?? null,
    approver_type: tier.approver_type,
    approver_value: tier.approver_type === 'reporting_manager' ? 'reporting_manager' : tier.approver_value.trim(),
    approval_type: tier.approval_type,
  };
}

export function toRequest(matrix: EditableMatrix): WorkflowSaveMatrixRequest {
  return {
    code: matrix.code.trim(),
    name: matrix.name.trim(),
    subject_type: matrix.subject_type,
    currency: matrix.currency.trim().toUpperCase(),
    priority: matrix.priority,
    is_active: matrix.is_active,
    is_default: matrix.is_default,
    auto_approve_below: matrix.auto_approve_below,
    fallback_approver: matrix.fallbackType
      ? {
          approver_type: matrix.fallbackType,
          approver_value: matrix.fallbackType === 'reporting_manager' ? 'reporting_manager' : matrix.fallbackValue.trim(),
        }
      : null,
    conditions: matrix.conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: parseConditionValue(condition.operator, condition.valueText),
    })),
    tiers: [...matrix.tiers].sort((a, b) => a.tier_level - b.tier_level).map(cleanTier),
  };
}

/** Translation keys of every problem that stops the matrix from being saved (deduplicated, empty when valid). */
export function validateMatrix(matrix: EditableMatrix): string[] {
  const errors: string[] = [];
  if (matrix.code.trim() === '' || matrix.name.trim() === '' || matrix.subject_type === '') {
    errors.push('workflows.matrix.error.nameRequired');
  }
  if (!/^[A-Za-z]{3}$/.test(matrix.currency.trim())) {
    errors.push('workflows.matrix.error.currency');
  }
  if (!(matrix.priority >= 1)) {
    errors.push('workflows.matrix.error.priority');
  }
  for (const condition of matrix.conditions) {
    const value = parseConditionValue(condition.operator, condition.valueText);
    if (Array.isArray(value) ? value.length === 0 : value === '') {
      errors.push('workflows.matrix.error.conditionValue');
    } else if (condition.operator === 'between' && Array.isArray(value) && value.length !== 2) {
      errors.push('workflows.matrix.error.between');
    }
  }
  if (matrix.tiers.length === 0) {
    errors.push('workflows.matrix.error.tiersRequired');
  }
  for (const tier of matrix.tiers) {
    if (!(tier.tier_level >= 1)) {
      errors.push('workflows.matrix.error.tierLevel');
    }
    if (tier.approver_type !== 'reporting_manager' && tier.approver_value.trim() === '') {
      errors.push('workflows.matrix.error.approverRequired');
    }
    if (tier.threshold_min !== null && tier.threshold_max !== null && tier.threshold_min > tier.threshold_max) {
      errors.push('workflows.matrix.error.thresholdRange');
    }
  }
  if (matrix.fallbackType && matrix.fallbackType !== 'reporting_manager' && matrix.fallbackValue.trim() === '') {
    errors.push('workflows.matrix.error.fallbackRequired');
  }
  return [...new Set(errors)];
}
