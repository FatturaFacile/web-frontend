import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Mirrors the Laravel `decimal:0,N` rule on a text control: digits with at most `scale` decimals.
 * An empty value passes (combine with Validators.required where the field is mandatory).
 */
export function decimalPattern(scale: number, maxIntegerDigits = 13): ValidatorFn {
  const pattern = new RegExp(`^\\d{1,${maxIntegerDigits}}(\\.\\d{1,${scale}})?$`);
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return pattern.test(String(value).trim()) ? null : { decimal: true };
  };
}

/** Mirrors the Laravel `gt:0` rule: the value, when filled, must be greater than zero. */
export function positiveNumber(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? null : { positive: true };
}

/**
 * Mirrors `gte:<other>`: the control must not be below the control `otherKey` of the same group. Empty values pass.
 * The error is `{ belowMin: true }`; pair it with `revalidateOnStartChange`-style re-validation of the dependent control.
 */
export function atLeastField(otherKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherKey)?.value;
    const value = control.value;
    if (value === null || value === undefined || value === '' || other === null || other === undefined || other === '') {
      return null;
    }
    return Number(value) >= Number(other) ? null : { belowMin: true };
  };
}

/** Mirrors `lte:<limit>` where the limit is known at run time (a delivered quantity, a balance): `{ exceedsMax: true }`. */
export function atMostLimit(limit: () => number | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    const max = limit();
    if (value === null || value === undefined || value === '' || max === null || max === undefined) {
      return null;
    }
    return Number(value) <= max ? null : { exceedsMax: true };
  };
}
