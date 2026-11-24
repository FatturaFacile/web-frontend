import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { I18nService } from '@core';
import { differentFrom, endsNotBefore, inFuture, notInFuture, toTimestamp } from '@shared/utils/date-validators';
import { positiveNumber } from '@shared/utils/decimal-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { decimalStringValidator } from '../hr-decimal.validator';
import { CrudField } from './crud.types';

function isFilled(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return String(value ?? '').trim() !== '';
}

/** Required that also rejects whitespace-only text (the payload trims it away, the API would see nothing). */
function requiredValidator(control: AbstractControl): ValidationErrors | null {
  return isFilled(control.value) ? null : { required: true };
}

/** Conditional required: `requiredIf` = the other field is filled/checked, `requiredWithout` = the other field is empty. */
function conditionalRequired(field: CrudField): ValidatorFn {
  return (control) => {
    const other = (key: string): unknown => control.parent?.get(key)?.value;
    const needed =
      (field.requiredIf !== undefined && isFilled(other(field.requiredIf))) ||
      (field.requiredWithout !== undefined && !isFilled(other(field.requiredWithout)));
    return needed ? requiredValidator(control) : null;
  };
}

/** Required whenever `field.requiredWhen` holds for the values of the form (re-checked on every change). */
function requiredWhenValidator(field: CrudField, editing: boolean): ValidatorFn {
  return (control) => {
    const values = (control.parent?.getRawValue() ?? {}) as Record<string, unknown>;
    return field.requiredWhen?.(values, editing) ? requiredValidator(control) : null;
  };
}

function numericBound(kind: 'min' | 'max', bound: number): ValidatorFn {
  return (control) => {
    const text = String(control.value ?? '').trim();
    if (text === '') {
      return null;
    }
    const value = Number(text);
    if (Number.isNaN(value)) {
      return null;
    }
    const bad = kind === 'min' ? value < bound : value > bound;
    return bad ? { outOfRange: { min: kind === 'min' ? bound : null, max: kind === 'max' ? bound : null } } : null;
  };
}

/** Validators mirroring the flags of a field (required, lengths, range, format, decimal/integer). */
export function fieldValidators(field: CrudField, editing = false): ValidatorFn[] {
  const list: ValidatorFn[] = [];
  if (field.required) {
    list.push(requiredValidator);
  }
  if (field.requiredWhen) {
    list.push(requiredWhenValidator(field, editing));
  }
  if (field.requiredIf !== undefined || field.requiredWithout !== undefined) {
    list.push(conditionalRequired(field));
  }
  if (field.maxLength) {
    list.push((c) => (String(c.value ?? '').length > field.maxLength! ? { maxlength: { requiredLength: field.maxLength } } : null));
  }
  if (field.minLength) {
    list.push((c) => {
      const length = String(c.value ?? '').trim().length;
      return length > 0 && length < field.minLength! ? { minlength: { requiredLength: field.minLength } } : null;
    });
  }
  if (field.type === 'decimal') {
    list.push(decimalStringValidator);
  }
  if (field.type === 'integer') {
    list.push((c) => (/^\d*$/.test(String(c.value ?? '').trim()) ? null : { integer: true }));
  }
  if (field.pattern) {
    const regex = new RegExp(field.pattern);
    list.push((c) => {
      const text = String(c.value ?? '').trim();
      return text === '' || regex.test(text) ? null : { format: true };
    });
  }
  if (field.min !== undefined) {
    list.push(numericBound('min', field.min));
  }
  if (field.max !== undefined) {
    list.push(numericBound('max', field.max));
  }
  if (field.notBefore) {
    list.push(endsNotBefore(field.notBefore, { strict: field.strictlyAfter }));
  }
  if (field.notInFuture) {
    list.push(notInFuture);
  }
  if (field.inFuture) {
    list.push(inFuture);
  }
  if (field.maxMonthsAhead !== undefined) {
    const months = field.maxMonthsAhead;
    list.push((c) => {
      const time = toTimestamp(c.value as string);
      const limit = new Date();
      limit.setMonth(limit.getMonth() + months);
      return time === null || time <= limit.getTime() ? null : { futureDate: true };
    });
  }
  if (field.differentFrom) {
    list.push(differentFrom(field.differentFrom));
  }
  if (field.positive) {
    list.push(positiveNumber);
  }
  if (field.prohibits) {
    const other = field.prohibits;
    list.push((c) => (isFilled(c.value) && isFilled(c.parent?.get(other)?.value) ? { prohibited: true } : null));
  }
  if (field.uuid) {
    list.push(uuidFormat);
  }
  return list;
}

/** True while the asterisk must show: always-required, or the condition of `requiredIf` / `requiredWithout` holds now. */
export function isFieldRequired(field: CrudField, form: FormGroup, editing = false): boolean {
  if (field.required) {
    return true;
  }
  if (field.requiredWhen?.(form.getRawValue() as Record<string, unknown>, editing)) {
    return true;
  }
  const filled = (key: string): boolean => isFilled(form.get(key)?.value);
  return (
    (field.requiredIf !== undefined && filled(field.requiredIf)) ||
    (field.requiredWithout !== undefined && !filled(field.requiredWithout))
  );
}

/** Re-validates a control whenever a field it depends on changes (conditional required, date order, different). */
export function wireConditionalRequired(form: FormGroup, fields: CrudField[]): void {
  for (const field of fields) {
    const control = form.get(field.key);
    if (!control) {
      continue;
    }
    const dependencies = [field.requiredIf ?? field.requiredWithout, field.notBefore, field.differentFrom, field.prohibits].filter(
      (key): key is string => key !== undefined,
    );
    for (const dependency of dependencies) {
      form.get(dependency)?.valueChanges.subscribe(() => control.updateValueAndValidity({ emitEvent: false }));
    }
    if (field.requiredWhen) {
      form.valueChanges.subscribe(() => control.updateValueAndValidity({ emitEvent: false }));
    }
    if (dependencies.length > 0 || field.requiredWhen) {
      control.updateValueAndValidity({ emitEvent: false });
    }
  }
}

/** The translated message of the first error of a control (server message first). */
export function fieldErrorTip(control: AbstractControl | null, i18n: I18nService): string {
  const errors = control?.errors;
  if (errors?.['serverError']) {
    return String(errors['serverError']);
  }
  if (errors?.['decimal']) {
    return i18n.translate('hrmCommon.invalidDecimal');
  }
  if (errors?.['integer']) {
    return i18n.translate('hrmCommon.invalidInteger');
  }
  if (errors?.['maxlength']) {
    return i18n.translate('hrmCommon.tooLong', { max: errors['maxlength'].requiredLength });
  }
  if (errors?.['minlength']) {
    return i18n.translate('hrmCommon.tooShort', { min: errors['minlength'].requiredLength });
  }
  if (errors?.['endsBeforeStart']) {
    return i18n.translate('COMMON.VALIDATION.END_AFTER_START');
  }
  if (errors?.['futureDate']) {
    return i18n.translate('COMMON.VALIDATION.DATE_NOT_IN_FUTURE');
  }
  if (errors?.['pastDate']) {
    return i18n.translate('COMMON.VALIDATION.DATE_MUST_BE_FUTURE');
  }
  if (errors?.['sameAsOther']) {
    return i18n.translate('COMMON.VALIDATION.MUST_DIFFER');
  }
  if (errors?.['prohibited']) {
    return i18n.translate('COMMON.VALIDATION.ONLY_ONE_OF');
  }
  if (errors?.['positive']) {
    return i18n.translate('COMMON.VALIDATION.MUST_BE_POSITIVE');
  }
  if (errors?.['uuid']) {
    return i18n.translate('hrmCommon.invalidFormat');
  }
  if (errors?.['format']) {
    return i18n.translate('hrmCommon.invalidFormat');
  }
  if (errors?.['outOfRange']) {
    const { min, max } = errors['outOfRange'] as { min: number | null; max: number | null };
    return i18n.translate(min !== null ? 'hrmCommon.tooSmall' : 'hrmCommon.tooBig', { limit: min ?? max ?? 0 });
  }
  return i18n.translate('hrmCommon.required');
}
