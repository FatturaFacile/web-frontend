import { HttpErrorResponse } from '@angular/common/http';
import {
  CpqEvalCharacteristic,
  CpqEvaluation,
  CpqModelStatus,
  CpqSelectionValue,
  CpqViolation,
} from '@core';

/** Prefix of the translation keys the API sends as error messages (`CPQ_CONFIGURATOR.ERR.*`). */
export const CPQ_KEY_PREFIX = 'CPQ_CONFIGURATOR.';

/** Module key of the access map: read, evaluate, confirm (write), define the models (manager, enforced by the API). */
export const CPQ_MODULE = 'cpq_configurator';

/** Module key of the definition of models, rules, mappings and formulas: owners, administrators and sales managers. */
export const CPQ_ADMIN_MODULE = 'cpq_configurator_admin';

/** Amount in the currency given, for display only. */
export function formatMoney(value: string | number | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return Number(value).toLocaleString(undefined, { style: 'currency', currency });
}

/** A number without trailing zeros, for display only. */
export function trimNumber(value: string | number | null | undefined, digits = 4): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return String(Number(Number(value).toFixed(digits)));
}

export function modelStatusColor(status: CpqModelStatus): string {
  return { draft: 'default', published: 'green', archived: 'red' }[status];
}

export function stepStatusColor(status: string): string {
  return { complete: 'green', incomplete: 'default', error: 'red' }[status] ?? 'default';
}

export function severityColor(severity: string): string {
  return { error: 'red', warning: 'orange', info: 'blue' }[severity] ?? 'default';
}

/** Alert type of a violation, for the nz-alert component. */
export function severityAlert(severity: string): 'error' | 'warning' | 'info' {
  return severity === 'error' || severity === 'warning' ? severity : 'info';
}

/** The violations raised by the engine itself; any other code is a rule of the model, whose message is written in the rule. */
export const CPQ_SYSTEM_VIOLATIONS: readonly string[] = [
  'option_blocked',
  'unknown_option',
  'out_of_range',
  'step_mismatch',
  'invalid_value',
  'forced_value_blocked',
  'rule_error',
  'unstable_rules',
  'no_decision_row',
];

/** Translation key of a violation without a message written in a rule: its own text, or the generic one. */
export function violationKey(violation: CpqViolation): string {
  return CPQ_SYSTEM_VIOLATIONS.includes(violation.code)
    ? `${CPQ_KEY_PREFIX}VIOLATION.${violation.code.toUpperCase()}`
    : `${CPQ_KEY_PREFIX}VIOLATION.GENERIC`;
}

/** Parameters of a violation of the system, as the translation expects them. */
export function violationParams(violation: CpqViolation): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(violation.params ?? {})) {
    if (value !== null && value !== undefined && typeof value !== 'object') {
      params[key] = typeof value === 'number' ? Number(value.toFixed(4)) : String(value);
    }
  }
  return params;
}

/** The answers to send: every visible characteristic with its current value, so a rule never has to guess. */
export function selectionsOf(evaluation: CpqEvaluation): Record<string, CpqSelectionValue> {
  const selections: Record<string, CpqSelectionValue> = {};
  for (const characteristic of evaluation.characteristics) {
    if (
      characteristic.visible &&
      characteristic.value !== null &&
      characteristic.value !== undefined
    ) {
      selections[characteristic.code] = characteristic.value;
    }
  }
  return selections;
}

/** The characteristics of a step, in the order of the step. */
export function characteristicsOfStep(
  evaluation: CpqEvaluation,
  stepCode: string,
): CpqEvalCharacteristic[] {
  const step = evaluation.steps.find((candidate) => candidate.code === stepCode);
  if (!step) {
    return [];
  }
  const byCode = new Map(
    evaluation.characteristics.map((characteristic) => [characteristic.code, characteristic]),
  );

  return step.characteristics
    .map((code) => byCode.get(code))
    .filter(
      (characteristic): characteristic is CpqEvalCharacteristic => characteristic !== undefined,
    );
}

export interface CpqFailure {
  /** Translation key when the API sent one (`CPQ_CONFIGURATOR.ERR.*`), otherwise null. */
  key: string | null;
  /** Text of the API (validation message or problem detail) for what a key does not cover. */
  detail: string | null;
  errors: Record<string, string[]>;
}

/** What a failed request says: a translation key from the API, the field errors of a 422, or the plain detail. */
export function failureOf(error: unknown): CpqFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { key: null, detail: null, errors: {} };
  }
  const body = (error.error ?? {}) as {
    message?: string;
    detail?: string;
    errors?: Record<string, string[]>;
  };
  const errors = body.errors ?? {};
  const keyed = Object.values(errors)
    .flat()
    .find((message) => typeof message === 'string' && message.startsWith(CPQ_KEY_PREFIX));
  const message = body.message ?? body.detail ?? null;

  return {
    key: keyed ?? (message?.startsWith(CPQ_KEY_PREFIX) ? message : null),
    detail: message,
    errors,
  };
}

/** Value of an input-number event: null when it was cleared. */
export function numberOrNull(value: number | string | null): number | null {
  if (value === null || value === '' || Number.isNaN(Number(value))) {
    return null;
  }
  return Number(value);
}
