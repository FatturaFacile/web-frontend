import type { AbacConditionDto, AbacRuleDto } from '@core';

/** Parses a typed value: a number stays a number, `a, b` becomes a list for the `in` operators. */
export function parseAbacValue(raw: string, operator: AbacConditionDto['operator']): AbacConditionDto['value'] {
  const text = raw.trim();
  const scalar = (part: string): string | number => (part !== '' && !Number.isNaN(Number(part)) ? Number(part) : part);

  return operator === 'in' || operator === 'not_in'
    ? text
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .map(scalar)
    : scalar(text);
}

export function formatAbacValue(value: AbacConditionDto['value']): string {
  return Array.isArray(value) ? `[${value.join(', ')}]` : String(value);
}

/** Live text preview of a rule, e.g. `DENY invoicing.invoices.approve WHEN document.total > 10000`. */
export function previewAbacRule(rule: AbacRuleDto): string {
  const conditions = rule.conditions
    .filter((c) => c.attribute && c.operator)
    .map((c) => `${c.attribute} ${c.operator.replace('_', ' ')} ${formatAbacValue(c.value)}`)
    .join(' AND ');

  return `${rule.effect.toUpperCase()} ${rule.permission || '…'}${conditions === '' ? '' : ` WHEN ${conditions}`}`;
}
