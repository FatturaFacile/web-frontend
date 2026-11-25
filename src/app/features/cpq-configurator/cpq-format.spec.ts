import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CpqViolation } from '@core';
import { cpqEvaluation } from '../../../testing/cpq-fixtures';
import {
  characteristicsOfStep,
  failureOf,
  formatMoney,
  modelStatusColor,
  numberOrNull,
  selectionsOf,
  severityAlert,
  trimNumber,
  violationKey,
  violationParams,
} from './cpq-format';

const violation = (overrides: Partial<CpqViolation>): CpqViolation => ({
  code: 'option_blocked',
  severity: 'error',
  characteristic: 'material',
  characteristic_label: 'Material',
  rule: null,
  message: null,
  params: {},
  ...overrides,
});

describe('cpq-format', () => {
  it('formats money and numbers for display only', () => {
    expect(formatMoney(null, 'EUR')).toBe('-');
    expect(formatMoney('', 'EUR')).toBe('-');
    expect(formatMoney(12.5, 'EUR')).toContain('12');
    expect(trimNumber(40)).toBe('40');
    expect(trimNumber('40.5000')).toBe('40.5');
    expect(trimNumber(0.1 + 0.2)).toBe('0.3');
    expect(trimNumber(null)).toBe('');
  });

  it('colours the status of a model and the severity of a notice', () => {
    expect(modelStatusColor('draft')).toBe('default');
    expect(modelStatusColor('published')).toBe('green');
    expect(modelStatusColor('archived')).toBe('red');
    expect(severityAlert('error')).toBe('error');
    expect(severityAlert('warning')).toBe('warning');
    expect(severityAlert('info')).toBe('info');
    expect(severityAlert('anything')).toBe('info');
  });

  it('keys the violations of the engine and falls back to the generic text for the ones of a rule', () => {
    expect(violationKey(violation({ code: 'out_of_range' }))).toBe(
      'CPQ_CONFIGURATOR.VIOLATION.OUT_OF_RANGE',
    );
    expect(violationKey(violation({ code: 'single-phase-flow' }))).toBe(
      'CPQ_CONFIGURATOR.VIOLATION.GENERIC',
    );
  });

  it('keeps only the scalar parameters of a violation, numbers rounded', () => {
    expect(
      violationParams(
        violation({
          params: { value: 1 / 3, min: null, label: 'Flow', nested: { a: 1 }, step: 5 },
        }),
      ),
    ).toEqual({ value: 0.3333, label: 'Flow', step: 5 });
  });

  it('sends back the answers of every visible characteristic', () => {
    const evaluation = cpqEvaluation();
    evaluation.characteristics[2].visible = false;

    expect(selectionsOf(evaluation)).toEqual({
      destination_country: 'CH',
      material: 'AISI_316',
      safety_kit: true,
    });
  });

  it('lists the characteristics of a step in the order of the step', () => {
    const evaluation = cpqEvaluation();

    expect(
      characteristicsOfStep(evaluation, 'hydraulics').map((characteristic) => characteristic.code),
    ).toEqual(['material', 'flow_rate', 'safety_kit']);
    expect(characteristicsOfStep(evaluation, 'missing')).toEqual([]);
  });

  it('reads the translation key, the field errors and the detail of a failed request', () => {
    const keyed = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          message: 'CPQ_CONFIGURATOR.ERR.MODEL_HAS_ISSUES',
          errors: { status: ['CPQ_CONFIGURATOR.ERR.MODEL_HAS_ISSUES'] },
        },
      }),
    );
    const fields = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: {
          message: 'The code has already been taken.',
          errors: { code: ['The code has already been taken.'] },
        },
      }),
    );
    const unknown = failureOf(new Error('boom'));

    expect(keyed.key).toBe('CPQ_CONFIGURATOR.ERR.MODEL_HAS_ISSUES');
    expect(fields.key).toBeNull();
    expect(fields.errors['code']).toEqual(['The code has already been taken.']);
    expect(fields.detail).toBe('The code has already been taken.');
    expect(unknown).toEqual({ key: null, detail: null, errors: {} });
  });

  it('reads an input number: a cleared field is null', () => {
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('abc')).toBeNull();
    expect(numberOrNull('42')).toBe(42);
    expect(numberOrNull(0)).toBe(0);
  });
});
